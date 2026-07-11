#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

const rawArgs = process.argv.slice(2);
const optionNames = new Set([
  "--run-id",
  "--usage-output",
  "--provider",
  "--model",
  "--meter-retries",
  "--max-tokens",
  "--max-cost-usd",
]);
const failUsage = (message) => {
  console.error(`pi-meter: ${message}`);
  process.exit(64);
};
const option = (name) => {
  const indices = rawArgs.reduce((found, value, index) => value === name ? [...found, index] : found, []);
  if (indices.length > 1) failUsage(`${name} may be supplied only once`);
  if (indices.length === 0) return undefined;
  const value = rawArgs[indices[0] + 1];
  if (!value || value.startsWith("--")) failUsage(`${name} requires a value`);
  return value;
};
const preflight = rawArgs.includes("--preflight");
if (rawArgs.filter((argument) => argument === "--preflight").length > 1) failUsage("--preflight may be supplied only once");
const runId = option("--run-id");
const usageOutput = option("--usage-output");
const expectedProvider = option("--provider");
const expectedModel = option("--model");
const maxProviderRetries = Number(option("--meter-retries") ?? 0);
const maxTokens = Number(option("--max-tokens"));
const maxCostUsd = Number(option("--max-cost-usd"));

if (!expectedProvider || !expectedModel) failUsage("--provider and --model are both required");
if (!Number.isInteger(maxProviderRetries) || maxProviderRetries < 0 || maxProviderRetries > 3) {
  failUsage("--meter-retries must be an integer from 0 through 3");
}
if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0 || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
  failUsage("positive safe-integer --max-tokens and finite --max-cost-usd are required");
}
if (!preflight && !runId) failUsage("--run-id is required for a measured run");
if (!preflight && !usageOutput) failUsage("--usage-output is required for a measured run");
if (preflight && (runId || usageOutput)) failUsage("--preflight does not accept --run-id or --usage-output");

const piArgs = rawArgs.filter((argument, index) => {
  if (argument === "--preflight" || optionNames.has(argument)) return false;
  return !optionNames.has(rawArgs[index - 1]);
});

async function validateUsageOutput(path) {
  if (!isAbsolute(path)) throw new Error("--usage-output must be an absolute supervisor-owned path");
  const output = resolve(path);
  const cwd = await realpath(process.cwd());
  const fromCwd = relative(cwd, output);
  if (fromCwd === "" || (!fromCwd.startsWith("..") && !isAbsolute(fromCwd))) {
    throw new Error("--usage-output must be outside the candidate working directory");
  }
  let existing;
  try {
    existing = await lstat(output);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (existing) throw new Error("--usage-output must not already exist (including as a symlink)");
  const parent = await realpath(dirname(output));
  const parentStats = await stat(parent);
  if (!parentStats.isDirectory() || (parentStats.mode & 0o022) !== 0) {
    throw new Error("--usage-output parent must be a supervisor-owned non-group/world-writable directory");
  }
  return output;
}

if (preflight) {
  console.log("pi-meter: preflight passed; no worker was started and no usage record was written");
  process.exit(0);
}

let outputPath;
try {
  outputPath = await validateUsageOutput(usageOutput);
} catch (error) {
  console.error(`pi-meter: ${error.message}`);
  process.exit(64);
}

const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costUsd: 0, assistantMessages: 0 };
const providers = new Set();
const models = new Set();
const observedRunIds = new Set();
const attempts = [];
const startedAt = new Date().toISOString();
const sessionDir = await mkdtemp(join(tmpdir(), "airlock-pi-meter-"));
let finalText = "";
let childExitCode = 1;
let accountingInvalid = false;
let accountingErrors = [];

function addUsage(usage, attempt) {
  const tokenFields = ["input", "output", "cacheRead", "cacheWrite", "totalTokens"];
  for (const key of tokenFields) {
    if (!Number.isSafeInteger(usage?.[key]) || usage[key] < 0) {
      accountingInvalid = true;
      accountingErrors.push(`attempt ${attempt}: usage.${key} must be a non-negative safe integer`);
      return;
    }
  }
  if (!Number.isFinite(usage?.cost?.total) || usage.cost.total < 0) {
    accountingInvalid = true;
    accountingErrors.push(`attempt ${attempt}: usage.cost.total must be finite and non-negative`);
    return;
  }
  for (const key of tokenFields) totals[key] += usage[key];
  totals.costUsd += usage.cost.total;
  if (tokenFields.some((key) => !Number.isSafeInteger(totals[key])) || !Number.isFinite(totals.costUsd)) {
    accountingInvalid = true;
    accountingErrors.push(`attempt ${attempt}: aggregated usage is not finite`);
  }
}

async function runAttempt(attempt) {
  let terminalStreamError = false;
  let assistantMessages = 0;
  const args = attempt === 0
    ? ["-p", "--session-dir", sessionDir, "--mode", "json", ...piArgs]
    : [
        "-p", "--session-dir", sessionDir, "--continue", "--mode", "json",
        "--provider", expectedProvider, "--model", expectedModel,
        "Continue the interrupted task from the durable session. Do not redo completed work. Finish checks, commit, and emit the exact required receipt.",
      ];
  const child = spawn(process.env.PI_BIN || "pi", args, { stdio: ["ignore", "pipe", "inherit"] });
  // Register this before consuming stdout: a fast fake or failed child can close before
  // the readline iterator finishes, and a late close listener would otherwise hang.
  const close = new Promise((resolveExit) => child.once("close", (code) => resolveExit(code ?? 1)));
  for await (const line of createInterface({ input: child.stdout })) {
    process.stderr.write(`PI_EVENT attempt=${attempt} ${line}\n`);
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type !== "message_end" || event.message?.role !== "assistant") continue;
    const message = event.message;
    const text = Array.isArray(message.content)
      ? message.content.filter((part) => part?.type === "text").map((part) => part.text).join("")
      : "";
    if (text) finalText = text;
    if (typeof event.runId === "string") observedRunIds.add(event.runId);
    if (typeof message.runId === "string") observedRunIds.add(message.runId);
    if (typeof message.provider === "string") providers.add(message.provider);
    if (typeof message.model === "string") models.add(message.model);
    addUsage(message.usage, attempt);
    totals.assistantMessages += 1;
    assistantMessages += 1;
    terminalStreamError = message.stopReason === "error" &&
      typeof message.errorMessage === "string" &&
      message.errorMessage.includes("stream ended before a terminal response event");
  }
  const exitCode = await close;
  attempts.push({ attempt, continuation: attempt > 0, exitCode, assistantMessages, terminalStreamError });
  return { exitCode, terminalStreamError };
}

try {
  for (let attempt = 0; attempt <= maxProviderRetries; attempt += 1) {
    const result = await runAttempt(attempt);
    childExitCode = result.exitCode;
    if (!result.terminalStreamError || childExitCode !== 0 || attempt === maxProviderRetries) break;
  }
} finally {
  await rm(sessionDir, { recursive: true, force: true });
}

const identity = { expectedProvider, expectedModel, providers: [...providers].sort(), models: [...models].sort() };
// A child-supplied run id is only a consistency check. The supervisor argument remains
// the sole authority for the record's runId, and absent child ids are permitted.
const runIdOk = ![...observedRunIds].some((observedRunId) => observedRunId !== runId);
const identityOk = totals.assistantMessages > 0 && identity.providers.length === 1 && identity.providers[0] === expectedProvider && identity.models.length === 1 && identity.models[0] === expectedModel;
const terminalStreamError = attempts.at(-1)?.terminalStreamError ?? false;
const budgetOk = !accountingInvalid && totals.totalTokens <= maxTokens && totals.costUsd <= maxCostUsd;
const terminalStatus = accountingInvalid ? "malformed_usage"
  : !runIdOk ? "run_id_mismatch"
  : !identityOk ? "identity_mismatch"
  : terminalStreamError ? "stream_incomplete"
  : !budgetOk ? "budget_exceeded"
  : childExitCode !== 0 ? "child_failed"
  : "succeeded";
const record = {
  schemaVersion: 1,
  runId,
  startedAt,
  completedAt: new Date().toISOString(),
  identity,
  accounting: { ...totals, valid: !accountingInvalid, errors: accountingErrors },
  attempts: { count: attempts.length, continuationsUsed: Math.max(0, attempts.length - 1), maxProviderRetries, records: attempts },
  budget: { maxTokens, maxCostUsd, verdict: budgetOk ? "within_budget" : "exceeded_or_invalid" },
  terminal: { status: terminalStatus, childExitCode, identityOk, runIdOk, terminalStreamError },
};

try {
  const handle = await open(outputPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
} catch (error) {
  console.error(`pi-meter: failed to atomically create raw usage record: ${error.message}`);
  process.exit(65);
}

if (finalText) process.stdout.write(`${finalText.trimEnd()}\n`);
process.stdout.write(`TERRARIUM_USAGE ${JSON.stringify({ runId, terminalStatus, ...record.accounting, ...identity, identityOk, budgetOk, continuationsUsed: record.attempts.continuationsUsed })}\n`);
if (!runIdOk) console.error("pi-meter: child output contained a conflicting run id");
if (!identityOk) console.error("pi-meter: resolved provider/model differs from sealed invocation");
if (terminalStreamError) console.error("pi-meter: provider stream remained incomplete after bounded continuation");
if (!budgetOk) console.error("pi-meter: sealed token or cost budget exceeded or usage was malformed");
process.exitCode = terminalStatus === "succeeded" ? 0 : childExitCode || 65;
