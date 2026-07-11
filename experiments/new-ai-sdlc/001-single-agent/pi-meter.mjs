#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const rawArgs = process.argv.slice(2);
const flag = (name) => {
  const index = rawArgs.indexOf(name);
  return index >= 0 ? rawArgs[index + 1] : undefined;
};
const expectedProvider = flag("--provider");
const expectedModel = flag("--model");
const maxProviderRetries = Number(flag("--meter-retries") ?? 0);
if (!expectedProvider || !expectedModel) {
  console.error("pi-meter: --provider and --model are both required");
  process.exit(64);
}
if (!Number.isInteger(maxProviderRetries) || maxProviderRetries < 0 || maxProviderRetries > 3) {
  console.error("pi-meter: --meter-retries must be an integer from 0 through 3");
  process.exit(64);
}

const piArgs = rawArgs.filter((_, index) => rawArgs[index - 1] !== "--meter-retries" && rawArgs[index] !== "--meter-retries");
const totals = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  costUsd: 0,
  assistantMessages: 0,
};
const providers = new Set();
const models = new Set();
const sessionDir = await mkdtemp(join(tmpdir(), "airlock-pi-meter-"));
let finalText = "";
let providerRetries = 0;
let childExitCode = 1;
let terminalStreamError = false;

async function runAttempt(attempt) {
  terminalStreamError = false;
  const args = attempt === 0
    ? ["-p", "--session-dir", sessionDir, "--mode", "json", ...piArgs]
    : [
        "-p",
        "--session-dir",
        sessionDir,
        "--continue",
        "--mode",
        "json",
        "--provider",
        expectedProvider,
        "--model",
        expectedModel,
        "Continue the interrupted task from the durable session. Do not redo completed work. Finish checks, commit, and emit the exact required receipt.",
      ];
  const child = spawn(process.env.PI_BIN || "pi", args, { stdio: ["ignore", "pipe", "inherit"] });

  for await (const line of createInterface({ input: child.stdout })) {
    process.stderr.write(`PI_EVENT attempt=${attempt} ${line}\n`);
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "message_end" || event.message?.role !== "assistant") continue;

    const message = event.message;
    const text = Array.isArray(message.content)
      ? message.content.filter((part) => part?.type === "text").map((part) => part.text).join("")
      : "";
    if (text) finalText = text;
    if (typeof message.provider === "string") providers.add(message.provider);
    if (typeof message.model === "string") models.add(message.model);
    const usage = message.usage ?? {};
    for (const key of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]) {
      if (Number.isFinite(usage[key])) totals[key] += usage[key];
    }
    if (Number.isFinite(usage.cost?.total)) totals.costUsd += usage.cost.total;
    totals.assistantMessages += 1;
    terminalStreamError =
      message.stopReason === "error" &&
      typeof message.errorMessage === "string" &&
      message.errorMessage.includes("stream ended before a terminal response event");
  }
  return await new Promise((resolve) => child.once("close", (code) => resolve(code ?? 1)));
}

try {
  for (let attempt = 0; attempt <= maxProviderRetries; attempt += 1) {
    childExitCode = await runAttempt(attempt);
    if (!terminalStreamError || childExitCode !== 0 || attempt === maxProviderRetries) break;
    providerRetries += 1;
  }
} finally {
  await rm(sessionDir, { recursive: true, force: true });
}

const identity = {
  expectedProvider,
  expectedModel,
  providers: [...providers].sort(),
  models: [...models].sort(),
};
const identityOk =
  totals.assistantMessages > 0 &&
  identity.providers.length === 1 &&
  identity.providers[0] === expectedProvider &&
  identity.models.length === 1 &&
  identity.models[0] === expectedModel;
if (finalText) process.stdout.write(`${finalText.trimEnd()}\n`);
process.stdout.write(
  `TERRARIUM_USAGE ${JSON.stringify({ ...totals, ...identity, identityOk, providerRetries, terminalStreamError })}\n`,
);
if (!identityOk) console.error("pi-meter: resolved provider/model differs from sealed invocation");
if (terminalStreamError) console.error("pi-meter: provider stream remained incomplete after bounded continuation");
process.exitCode = childExitCode === 0 && identityOk && !terminalStreamError ? 0 : childExitCode || 65;
