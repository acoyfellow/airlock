#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn(process.env.PI_BIN || "pi", ["-p", "--no-session", "--mode", "json", ...process.argv.slice(2)], {
  stdio: ["ignore", "pipe", "inherit"],
});

const totals = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  costUsd: 0,
  assistantMessages: 0,
};
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

  const usage = message.usage ?? {};
  for (const key of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]) {
    if (Number.isFinite(usage[key])) totals[key] += usage[key];
  }
  const cost = usage.cost ?? {};
  for (const value of Object.values(cost)) {
    if (Number.isFinite(value)) totals.costUsd += value;
  }
  totals.assistantMessages += 1;
}

const exitCode = await new Promise((resolve) => child.once("close", (code) => resolve(code ?? 1)));
if (finalText) process.stdout.write(`${finalText.trimEnd()}\n`);
process.stdout.write(`TERRARIUM_USAGE ${JSON.stringify(totals)}\n`);
process.exitCode = exitCode;
