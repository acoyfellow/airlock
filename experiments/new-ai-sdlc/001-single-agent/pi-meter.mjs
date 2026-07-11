#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn(process.env.PI_BIN || "pi", ["-p", "--no-session", "--mode", "json", ...process.argv.slice(2)], {
  stdio: ["ignore", "pipe", "inherit"],
});

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const expectedProvider = flag("--provider");
const expectedModel = flag("--model");
if (!expectedProvider || !expectedModel) {
  console.error("pi-meter: --provider and --model are both required");
  process.exit(64);
}

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
let finalText = "";

for await (const line of createInterface({ input: child.stdout })) {
  // Preserve the original provider event stream as machine-readable evidence on stderr.
  process.stderr.write(`PI_EVENT ${line}\n`);
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
}

const childExitCode = await new Promise((resolve) => child.once("close", (code) => resolve(code ?? 1)));
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
process.stdout.write(`TERRARIUM_USAGE ${JSON.stringify({ ...totals, ...identity, identityOk })}\n`);
if (!identityOk) console.error("pi-meter: resolved provider/model differs from sealed invocation");
process.exitCode = childExitCode === 0 && identityOk ? 0 : childExitCode || 65;
