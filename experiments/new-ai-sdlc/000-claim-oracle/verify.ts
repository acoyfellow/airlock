import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateComparisonReceipt,
  sealEvents,
  verifyComparisonReceipt,
  type ComparisonReceipt,
  type Event,
  type RunMode,
  type UnsignedEvent,
} from "./oracle.ts";

const ACCEPTANCE_HASH = "sha256:acceptance-v1";
const START_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PROVIDER = "opencode.cloudflare.dev";
const MODEL = "gpt-5.6-terra";
const SOURCE_DIGEST = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function makeRun(mode: RunMode, workers: number, elapsedMs: number): Event[] {
  const runId = `oracle-${mode}`;
  const events: UnsignedEvent[] = [];
  const add = (atMs: number, actor: string, type: UnsignedEvent["type"], payload: Record<string, unknown>) =>
    events.push({ runId, seq: events.length, atMs, actor, type, payload });

  add(0, "root", "run.sealed", {
    mode,
    acceptanceHash: ACCEPTANCE_HASH,
    startCommit: START_COMMIT,
    provider: PROVIDER,
    model: MODEL,
    advertisedWorkers: workers,
  });
  for (let index = 0; index < workers; index++) {
    const workerId = `${mode}-worker-${index}`;
    const commit = `${mode}-commit-${index}`;
    add(10 + index, "root", "worker.spawned", { workerId, role: index === 0 ? "builder" : "critic" });
    add(20 + index, workerId, "commit.produced", { workerId, commit });
    add(30 + index, "integrator", "commit.dispositioned", { commit, disposition: index === 0 ? "accepted" : "rejected" });
    add(40 + index, workerId, "worker.terminal", {
      workerId,
      kind: "model",
      provider: PROVIDER,
      model: MODEL,
      status: "success",
      receiptId: `receipt-${workerId}`,
      retryMs: 10,
      computeMs: 100,
    });
  }
  add(55, "oracle", "behavior.accepted", { behaviorId: "visible-feature" });
  add(56, "oracle", "behavior.integrated", { behaviorId: "visible-feature" });
  if (mode === "fleet") {
    add(57, "integrator", "collision.detected", { collisionId: "collision-1" });
    add(58, "integrator", "collision.resolved", { collisionId: "collision-1", resolution: "reconciled" });
  }
  add(60, "checker", "check.result", { checkId: "acceptance", contractHash: ACCEPTANCE_HASH, ok: true });
  add(70, "integrator", "candidate.integrated", { sourceDigest: SOURCE_DIGEST });
  add(80, "keel", "proof.verified", { sourceDigest: SOURCE_DIGEST, admitted: true });
  add(90, "airlock", "preview.verified", { sourceDigest: SOURCE_DIGEST, url: `local://preview/${mode}`, noLiveTraffic: true });
  add(elapsedMs, "root", "run.completed", { elapsedMs, retryMs: workers * 10, computeMs: workers * 100 });
  return sealEvents(events);
}

function unsigned(events: Event[]): UnsignedEvent[] {
  return events.map(({ prevDigest: _prev, digest: _digest, ...event }) => structuredClone(event));
}

function reseal(events: Event[], mutate: (draft: UnsignedEvent[]) => void): Event[] {
  const draft = unsigned(events);
  mutate(draft);
  return sealEvents(draft);
}

const baseline = makeRun("baseline", 1, 1_000);
const fleet = makeRun("fleet", 2, 100);
const receipt = generateComparisonReceipt(baseline, fleet);
const control = verifyComparisonReceipt(receipt, baseline, fleet);
if (!control.ok) throw new Error(`control failed: ${control.reason}`);

const cases: Array<{
  name: string;
  baseline?: Event[];
  fleet?: Event[];
  receipt?: ComparisonReceipt;
  expected: string;
}> = [];

const mutateFleet = (name: string, mutate: (draft: UnsignedEvent[]) => void, expected: string) =>
  cases.push({ name, fleet: reseal(fleet, mutate), expected });
const event = (draft: UnsignedEvent[], type: UnsignedEvent["type"]) => {
  const found = draft.find((item) => item.type === type);
  if (!found) throw new Error(`fixture missing ${type}`);
  return found;
};

cases.push({ name: "event deletion breaks chain", fleet: fleet.filter((item) => item.type !== "behavior.integrated"), expected: "sequence mismatch" });
mutateFleet("unknown event type fails closed", (draft) => {
  event(draft, "behavior.integrated").type = "unknown.event" as never;
}, "event type: unknown unknown.event");
mutateFleet("advertised workers must match receipts", (draft) => { event(draft, "run.sealed").payload.advertisedWorkers = 3; }, "advertised count differs");
mutateFleet("scripts cannot count as model workers", (draft) => { event(draft, "worker.terminal").payload.kind = "script"; }, "deterministic script");
mutateFleet("duplicate worker receipt rejected", (draft) => {
  const terminals = draft.filter((item) => item.type === "worker.terminal");
  terminals[1].payload.workerId = terminals[0].payload.workerId;
}, "duplicate identity");
mutateFleet("omitted terminal worker rejected", (draft) => {
  const index = draft.findLastIndex((item) => item.type === "worker.terminal");
  draft.splice(index, 1);
}, "every spawn needs one terminal receipt");
mutateFleet("timed-out worker cannot count as qualifying", (draft) => {
  event(draft, "worker.terminal").payload.status = "timed_out";
}, "advertised count differs from qualifying receipts");
cases.push({
  name: "acceptance contract drift rejected",
  baseline: reseal(baseline, (draft) => {
    event(draft, "run.sealed").payload.acceptanceHash = "sha256:other";
    event(draft, "check.result").payload.contractHash = "sha256:other";
  }),
  expected: "acceptance contracts differ",
});
cases.push({
  name: "initial commit drift rejected",
  baseline: reseal(baseline, (draft) => { event(draft, "run.sealed").payload.startCommit = "different"; }),
  expected: "initial commits differ",
});
mutateFleet("provider drift rejected even when model name matches", (draft) => {
  event(draft, "worker.terminal").payload.provider = "azure-openai-responses";
}, "provider or model differs from sealed invocation");
mutateFleet("hidden human product write rejected", (draft) => {
  draft.splice(-1, 0, { ...draft.at(-1)!, type: "human.product-write", actor: "human", payload: { file: "src/app.ts" } });
}, "hidden human product write");
mutateFleet("undispositioned commit rejected", (draft) => {
  const index = draft.findLastIndex((item) => item.type === "commit.dispositioned");
  draft.splice(index, 1);
}, "produced commit missing final disposition");
mutateFleet("accepted behavior loss rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "behavior.integrated");
  draft.splice(index, 1);
}, "accepted behavior silently lost");
mutateFleet("unresolved collision rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "collision.resolved");
  draft.splice(index, 1);
}, "collision has no resolution");
mutateFleet("proof digest mismatch rejected", (draft) => { event(draft, "proof.verified").payload.sourceDigest = "sha256:wrong"; }, "proof does not admit");
mutateFleet("missing preview rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "preview.verified");
  draft.splice(index, 1);
}, "preview.verified: expected exactly one");
mutateFleet("completion before proof rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "run.completed");
  const [completed] = draft.splice(index, 1);
  const proofIndex = draft.findIndex((item) => item.type === "proof.verified");
  draft.splice(proofIndex, 0, completed);
}, "clock stopped before proof");
mutateFleet("completion after proof but before preview rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "run.completed");
  const [completed] = draft.splice(index, 1);
  const previewIndex = draft.findIndex((item) => item.type === "preview.verified");
  draft.splice(previewIndex, 0, completed);
}, "clock stopped before proof and preview");
mutateFleet("omitted retry accounting rejected", (draft) => { event(draft, "run.completed").payload.retryMs = 0; }, "retry or compute totals omitted");
cases.push({
  name: "receipt prose cannot drift from events",
  receipt: { ...structuredClone(receipt), claim: "1000 agents made software instantly" },
  expected: "claim or derived values differ",
});

const outcomes = cases.map((testCase) => {
  const verdict = verifyComparisonReceipt(testCase.receipt ?? receipt, testCase.baseline ?? baseline, testCase.fleet ?? fleet);
  const ok = !verdict.ok && verdict.reason.includes(testCase.expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${testCase.name}${verdict.ok ? " — mutation was accepted" : ` — ${verdict.reason}`}`);
  return { name: testCase.name, ok, expected: testCase.expected, observed: verdict.ok ? "accepted" : verdict.reason };
});

const output = {
  schema: "new-ai-sdlc/claim-oracle-verification@1",
  generatedAt: new Date().toISOString(),
  control: { ok: true, comparison: receipt },
  mutations: outcomes,
  status: outcomes.every((outcome) => outcome.ok) ? "pass" : "fail",
  limits: [
    "The control ledger is synthetic; no model fleet is claimed.",
    "The first mutation corpus is necessary but not complete.",
    "Local preview evidence does not prove a Cloudflare deployment.",
  ],
};

writeFileSync(join(import.meta.dir, "EVENTS.baseline.jsonl"), baseline.map((item) => JSON.stringify(item)).join("\n") + "\n");
writeFileSync(join(import.meta.dir, "EVENTS.fleet.jsonl"), fleet.map((item) => JSON.stringify(item)).join("\n") + "\n");
writeFileSync(join(import.meta.dir, "RECEIPT.json"), JSON.stringify(output, null, 2) + "\n");

if (output.status !== "pass") {
  console.error(`\n${outcomes.filter((outcome) => !outcome.ok).length}/${outcomes.length} mutations failed to turn red`);
  process.exit(1);
}
console.log(`\nPASS control green; ${outcomes.length}/${outcomes.length} mutations red`);
