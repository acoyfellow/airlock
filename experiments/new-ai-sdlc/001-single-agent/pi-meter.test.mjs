import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const meter = new URL("./pi-meter.mjs", import.meta.url).pathname;
const usage = (overrides = {}) => ({ input: 2, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { total: 0.25 }, ...overrides });

async function fixture(scenario) {
  const dir = await mkdtemp(join(tmpdir(), "pi-meter-test-"));
  const fakePi = join(dir, "fake-pi.mjs");
  const calls = join(dir, "calls");
  await writeFile(fakePi, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const calls = process.env.FAKE_PI_CALLS;
const count = calls ? (appendFileSync(calls, "x"), (await import("node:fs/promises")).readFile(calls, "utf8").then(x => x.length)) : 1;
const usage = (overrides = {}) => ({ input: 2, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { total: 0.25 }, ...overrides });
const emit = (message, extra = {}) => console.log(JSON.stringify({ type: "message_end", message, ...extra }));
const n = await count;
switch (process.env.FAKE_PI_SCENARIO) {
  case "continuation":
    emit({ role: "assistant", provider: "sealed", model: "model", usage: usage(), stopReason: n === 1 ? "error" : "stop", errorMessage: n === 1 ? "stream ended before a terminal response event" : undefined });
    break;
  case "over-budget": emit({ role: "assistant", provider: "sealed", model: "model", usage: usage({ totalTokens: 99, cost: { total: 12 } }), stopReason: "stop" }); break;
  case "malformed": emit({ role: "assistant", provider: "sealed", model: "model", usage: usage({ totalTokens: null }), stopReason: "stop" }); break;
  case "run-id-mismatch": emit({ role: "assistant", provider: "sealed", model: "model", usage: usage(), stopReason: "stop" }, { runId: "other-run" }); break;
  default: emit({ role: "assistant", provider: "sealed", model: "model", usage: usage(), stopReason: "stop", content: [{ type: "text", text: "worker prose" }] });
}
`);
  await chmod(fakePi, 0o700);
  return { dir, fakePi, calls, scenario };
}

const INJECTED_RUN_ID = "terrarium-run";

function invoke({ fakePi, calls, scenario }, output, { runId = INJECTED_RUN_ID, extra = [], env = {} } = {}) {
  const childEnv = {
    ...process.env,
    PI_BIN: fakePi,
    FAKE_PI_SCENARIO: scenario,
    FAKE_PI_CALLS: calls,
    TERRARIUM_RUN_ID: INJECTED_RUN_ID,
    ...env,
  };
  if (Object.hasOwn(env, "TERRARIUM_RUN_ID") && env.TERRARIUM_RUN_ID === undefined) delete childEnv.TERRARIUM_RUN_ID;
  const runIdArgs = runId === null ? [] : ["--run-id", runId];
  return spawnSync(process.execPath, [meter, ...runIdArgs, "--usage-output", output, "--provider", "sealed", "--model", "model", "--max-tokens", "10", "--max-cost-usd", "1", ...extra], {
    encoding: "utf8",
    env: childEnv,
  });
}

async function readRecord(path) { return JSON.parse(await readFile(path, "utf8")); }

test("accepts a CLI run id only when it exactly matches the injected Terrarium id", async () => {
  const f = await fixture("success");
  const output = join(f.dir, "supervisor", "usage.json");
  await (await import("node:fs/promises")).mkdir(join(f.dir, "supervisor"));
  const result = invoke(f, output, { runId: INJECTED_RUN_ID });
  assert.equal(result.status, 0, result.stderr);
  const record = await readRecord(output);
  assert.equal(record.runId, INJECTED_RUN_ID);
  assert.deepEqual(record.authority, { source: "TERRARIUM_RUN_ID", terrariumRunId: INJECTED_RUN_ID });
  assert.equal(record.terminal.status, "succeeded");
  assert.equal(record.accounting.totalTokens, 5);
  assert.equal(record.attempts.count, 1);
  assert.equal(record.budget.verdict, "within_budget");
  assert.match(record.startedAt, /^\d{4}-\d\d-\d\dT/);
});

test("accounts for the one allowed stream continuation in the same record", async () => {
  const f = await fixture("continuation");
  const output = join(f.dir, "usage.json");
  const result = invoke(f, output, { extra: ["--meter-retries", "1"] });
  assert.equal(result.status, 0, result.stderr);
  const record = await readRecord(output);
  assert.equal(record.attempts.count, 2);
  assert.equal(record.attempts.continuationsUsed, 1);
  assert.equal(record.accounting.totalTokens, 10);
});

test("records a budget violation rather than accepting the child exit", async () => {
  const f = await fixture("over-budget");
  const output = join(f.dir, "usage.json");
  const result = invoke(f, output);
  assert.notEqual(result.status, 0);
  const record = await readRecord(output);
  assert.equal(record.terminal.status, "budget_exceeded");
  assert.equal(record.budget.verdict, "exceeded_or_invalid");
});

test("rejects malformed or non-finite-compatible usage values and records the refusal", async () => {
  const f = await fixture("malformed");
  const output = join(f.dir, "usage.json");
  const result = invoke(f, output);
  assert.notEqual(result.status, 0);
  const record = await readRecord(output);
  assert.equal(record.terminal.status, "malformed_usage");
  assert.equal(record.accounting.valid, false);
});

test("fails closed when TERRARIUM_RUN_ID is missing", async () => {
  const f = await fixture("success");
  const output = join(f.dir, "missing-env.json");
  const result = invoke(f, output, { env: { TERRARIUM_RUN_ID: undefined } });
  assert.equal(result.status, 64);
  assert.match(result.stderr, /injected TERRARIUM_RUN_ID is required/);
  await assert.rejects(readFile(output, "utf8"));
});

test("fails closed when CLI and injected Terrarium run ids conflict", async () => {
  const f = await fixture("success");
  const output = join(f.dir, "conflicting-id.json");
  const result = invoke(f, output, { runId: "another-real-run" });
  assert.equal(result.status, 64);
  assert.match(result.stderr, /must exactly match injected TERRARIUM_RUN_ID/);
  await assert.rejects(readFile(output, "utf8"));
});

test("derives the record run id from TERRARIUM_RUN_ID when CLI --run-id is omitted", async () => {
  const f = await fixture("success");
  const output = join(f.dir, "derived-id.json");
  const result = invoke(f, output, { runId: null });
  assert.equal(result.status, 0, result.stderr);
  const record = await readRecord(output);
  assert.equal(record.runId, INJECTED_RUN_ID);
  assert.equal(record.authority.terrariumRunId, INJECTED_RUN_ID);
});

test("refuses conflicting child-reported run ids without changing injected authority", async () => {
  const f = await fixture("run-id-mismatch");
  const output = join(f.dir, "usage.json");
  const result = invoke(f, output);
  assert.notEqual(result.status, 0);
  const record = await readRecord(output);
  assert.equal(record.runId, INJECTED_RUN_ID);
  assert.equal(record.terminal.status, "run_id_mismatch");
});

test("refuses output collisions and symlinks before a candidate starts", async () => {
  const f = await fixture("success");
  const collision = join(f.dir, "collision.json");
  await writeFile(collision, "old record");
  const collisionResult = invoke(f, collision);
  assert.equal(collisionResult.status, 64);
  assert.equal(await readFile(collision, "utf8"), "old record");

  const link = join(f.dir, "usage-link.json");
  await symlink(join(f.dir, "target.json"), link);
  const linkResult = invoke(f, link);
  assert.equal(linkResult.status, 64);
});

test("documents a no-worker preflight mode under injected Terrarium authority", () => {
  const result = spawnSync(process.execPath, [meter, "--preflight", "--provider", "sealed", "--model", "model", "--max-tokens", "10", "--max-cost-usd", "1"], {
    encoding: "utf8",
    env: { ...process.env, TERRARIUM_RUN_ID: INJECTED_RUN_ID },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no worker was started/);
});
