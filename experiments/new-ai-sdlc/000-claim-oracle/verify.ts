import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeProof, signProof } from "keel";
import {
  generateComparisonReceipt,
  sealEvents,
  verifyComparisonReceipt,
  type ComparisonReceipt,
  type Event,
  type RunMode,
  type UnsignedEvent,
  type VerificationContext,
} from "./oracle.ts";

const ACCEPTANCE_HASH = "sha256:acceptance-v1";
const START_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PROVIDER = "opencode.cloudflare.dev";
const MODEL = "gpt-5.6-terra";
const MAX_TOKENS = 1_000_000;
const MAX_COST_USD = 10;
const TRUSTED_PROOF_KEY_ID = "d110158d54a51757";
const TRUSTED_PROOF_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIDnQrY4Hlg4IDfm7gFX0+6GeV1kWDLfMwhIXJvTk9VFF
-----END PRIVATE KEY-----
`;
const TRUSTED_PROOF_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAtD+3qcituSjeP3Pn4HBCN+CND01ryq88hHz30v5VLsU=
-----END PUBLIC KEY-----
`;
const SOURCE_DIGEST = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const artifactDigest = (bytes: string) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const RAW_BYTES = "synthetic raw worker/check/deploy evidence\n";
const RAW_DIGEST = artifactDigest(RAW_BYTES);
const SIGNED_PROOF_BYTES = JSON.stringify(signProof(
  makeProof({ artifactDigest: SOURCE_DIGEST, verifier: TRUSTED_PROOF_KEY_ID, policy: "oracle/control@1", result: "pass", evidence: "synthetic control" }),
  TRUSTED_PROOF_KEY_ID,
  TRUSTED_PROOF_PRIVATE_PEM,
));
const SIGNED_PROOF_DIGEST = artifactDigest(SIGNED_PROOF_BYTES);
const context: VerificationContext = {
  artifacts: { [RAW_DIGEST]: RAW_BYTES, [SIGNED_PROOF_DIGEST]: SIGNED_PROOF_BYTES },
  externalSeal: {
    expectedSourceDigest: SOURCE_DIGEST,
    cleanReplaySourceDigest: SOURCE_DIGEST,
    trustedProofKeyId: TRUSTED_PROOF_KEY_ID,
    trustedProofPublicPem: TRUSTED_PROOF_PUBLIC_PEM,
    productionChanged: false,
  },
};

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
    maxTokens: MAX_TOKENS,
    maxCostUsd: MAX_COST_USD,
    trustedProofKeyId: TRUSTED_PROOF_KEY_ID,
    advertisedWorkers: workers,
  });
  for (let index = 0; index < workers; index++) {
    const workerId = `${mode}-worker-${index}`;
    const commit = `${mode}-commit-${index}`;
    const receiptId = `receipt-${workerId}`;
    // Receipt and usage artifacts are content-addressed. The usage artifact records the
    // injected Terrarium authority and exactly mirrors the terminal accounting and
    // identity, so the oracle can reject borrowed or contradictory evidence.
    const receiptBytes = JSON.stringify({ runId: receiptId, kind: "terrarium-receipt", workerId });
    const usageBytes = JSON.stringify({
      runId: receiptId,
      authority: { source: "TERRARIUM_RUN_ID", terrariumRunId: receiptId },
      kind: "terrarium-usage",
      totalTokens: 1_000,
      costUsd: 0.1,
      provider: PROVIDER,
      model: MODEL,
      status: "success",
    });
    const receiptDigest = artifactDigest(receiptBytes);
    const usageDigest = artifactDigest(usageBytes);
    context.artifacts[receiptDigest] = receiptBytes;
    context.artifacts[usageDigest] = usageBytes;
    add(10 + events.length, "root", "worker.spawned", { workerId, role: index === 0 ? "builder" : "critic" });
    add(10 + events.length, workerId, "commit.produced", { workerId, commit });
    add(10 + events.length, "integrator", "commit.dispositioned", { commit, disposition: index === 0 ? "accepted" : "rejected" });
    add(10 + events.length, workerId, "worker.terminal", {
      workerId,
      kind: "model",
      provider: PROVIDER,
      model: MODEL,
      status: "success",
      receiptId,
      rawReceiptDigest: receiptDigest,
      usageDigest,
      retryMs: 10,
      computeMs: 100,
      totalTokens: 1_000,
      costUsd: 0.1,
    });
  }
  add(55, "oracle", "behavior.accepted", { behaviorId: "visible-feature" });
  add(56, "oracle", "behavior.integrated", { behaviorId: "visible-feature" });
  if (mode === "fleet") {
    add(57, "integrator", "collision.detected", { collisionId: "collision-1" });
    add(58, "integrator", "collision.resolved", { collisionId: "collision-1", resolution: "reconciled" });
  }
  add(60, "checker", "check.result", {
    checkId: "acceptance",
    contractHash: ACCEPTANCE_HASH,
    ok: true,
    exitCode: 0,
    durationMs: 10,
    outputDigest: RAW_DIGEST,
  });
  add(70, "integrator", "candidate.integrated", { sourceDigest: SOURCE_DIGEST });
  add(75, "clean-replay", "candidate.replayed", {
    sourceDigest: SOURCE_DIGEST,
    cleanCheckout: true,
    replayTranscriptDigest: RAW_DIGEST,
  });
  add(80, "keel", "proof.verified", {
    sourceDigest: SOURCE_DIGEST,
    admitted: true,
    keyId: TRUSTED_PROOF_KEY_ID,
    proofArtifactDigest: SIGNED_PROOF_DIGEST,
  });
  add(90, "airlock", "preview.verified", {
    sourceDigest: SOURCE_DIGEST,
    servedSourceDigest: SOURCE_DIGEST,
    url: `local://preview/${mode}`,
    versionId: `version-${mode}`,
    noLiveTraffic: true,
    productionChanged: false,
    responseDigest: RAW_DIGEST,
    deployTranscriptDigest: RAW_DIGEST,
  });
  add(elapsedMs, "root", "run.completed", {
    elapsedMs,
    retryMs: workers * 10,
    computeMs: workers * 100,
    totalTokens: workers * 1_000,
    totalCostUsd: workers * 0.1,
    promotionState: "requested",
  });
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
const receipt = generateComparisonReceipt(baseline, fleet, context, context);
const control = verifyComparisonReceipt(receipt, baseline, fleet, context, context);
if (!control.ok) throw new Error(`control failed: ${control.reason}`);

const cases: Array<{
  name: string;
  baseline?: Event[];
  fleet?: Event[];
  receipt?: ComparisonReceipt;
  baselineContext?: VerificationContext;
  fleetContext?: VerificationContext;
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
mutateFleet("unsafe advertised worker count rejected directly", (draft) => {
  event(draft, "run.sealed").payload.advertisedWorkers = Number.MAX_SAFE_INTEGER + 1;
}, "run.sealed.advertisedWorkers: invalid");
mutateFleet("scripts cannot count as model workers", (draft) => { event(draft, "worker.terminal").payload.kind = "script"; }, "deterministic script");
mutateFleet("post-hoc worker values without raw evidence rejected", (draft) => {
  delete event(draft, "worker.terminal").payload.rawReceiptDigest;
}, "content-addressed raw receipt or usage evidence missing");
mutateFleet("syntactically valid ghost artifact digest rejected", (draft) => {
  event(draft, "worker.terminal").payload.rawReceiptDigest = `sha256:${"f".repeat(64)}`;
}, "referenced artifact missing");
// Borrowed-evidence mutations: a real, content-addressed artifact whose bound runId
// belongs to a DIFFERENT run cannot launder qualifying work onto this worker.
const BORROWED_USAGE_BYTES = JSON.stringify({
  runId: "receipt-some-other-run",
  authority: { source: "TERRARIUM_RUN_ID", terrariumRunId: "receipt-some-other-run" },
  kind: "terrarium-usage",
  totalTokens: 1_000,
  costUsd: 0.1,
});
const BORROWED_USAGE_DIGEST = artifactDigest(BORROWED_USAGE_BYTES);
const BORROWED_RECEIPT_BYTES = JSON.stringify({ runId: "receipt-some-other-run", kind: "terrarium-receipt", workerId: "fleet-worker-0" });
const BORROWED_RECEIPT_DIGEST = artifactDigest(BORROWED_RECEIPT_BYTES);
context.artifacts[BORROWED_USAGE_DIGEST] = BORROWED_USAGE_BYTES;
context.artifacts[BORROWED_RECEIPT_DIGEST] = BORROWED_RECEIPT_BYTES;
mutateFleet("borrowed usage evidence not bound to worker rejected", (draft) => {
  event(draft, "worker.terminal").payload.usageDigest = BORROWED_USAGE_DIGEST;
}, "usage run id not bound to worker receipt");
mutateFleet("borrowed receipt evidence not bound to worker rejected", (draft) => {
  event(draft, "worker.terminal").payload.rawReceiptDigest = BORROWED_RECEIPT_DIGEST;
}, "receipt run id not bound to worker receipt");
// Mutation 39: a correct runId and content hash cannot launder accounting that disagrees
// with the terminal event and therefore with the completed-run aggregate.
const CONTRADICTORY_USAGE_BYTES = JSON.stringify({
  runId: "receipt-fleet-worker-0",
  authority: { source: "TERRARIUM_RUN_ID", terrariumRunId: "receipt-fleet-worker-0" },
  kind: "terrarium-usage",
  totalTokens: 9_999_999,
  costUsd: 999,
  provider: "attacker-provider",
  model: "attacker-model",
  status: "failed",
});
const CONTRADICTORY_USAGE_DIGEST = artifactDigest(CONTRADICTORY_USAGE_BYTES);
context.artifacts[CONTRADICTORY_USAGE_DIGEST] = CONTRADICTORY_USAGE_BYTES;
mutateFleet("usage artifact totals and identity must bind to terminal and completed run", (draft) => {
  event(draft, "worker.terminal").payload.usageDigest = CONTRADICTORY_USAGE_DIGEST;
}, "usage totalTokens not bound to worker terminal");
const TIMED_OUT_USAGE_BYTES = JSON.stringify({
  runId: "receipt-fleet-worker-0",
  authority: { source: "TERRARIUM_RUN_ID", terrariumRunId: "receipt-fleet-worker-0" },
  kind: "terrarium-usage",
  totalTokens: 1_000,
  costUsd: 0.1,
  provider: PROVIDER,
  model: MODEL,
  status: "timed_out",
});
const TIMED_OUT_USAGE_DIGEST = artifactDigest(TIMED_OUT_USAGE_BYTES);
const OVER_BUDGET_USAGE_BYTES = JSON.stringify({
  runId: "receipt-fleet-worker-0",
  authority: { source: "TERRARIUM_RUN_ID", terrariumRunId: "receipt-fleet-worker-0" },
  kind: "terrarium-usage",
  totalTokens: MAX_TOKENS + 1_000,
  costUsd: 0.1,
  provider: PROVIDER,
  model: MODEL,
  status: "success",
});
const OVER_BUDGET_USAGE_DIGEST = artifactDigest(OVER_BUDGET_USAGE_BYTES);
context.artifacts[TIMED_OUT_USAGE_DIGEST] = TIMED_OUT_USAGE_BYTES;
context.artifacts[OVER_BUDGET_USAGE_DIGEST] = OVER_BUDGET_USAGE_BYTES;
mutateFleet("duplicate worker receipt rejected", (draft) => {
  const terminals = draft.filter((item) => item.type === "worker.terminal");
  terminals[1].payload.workerId = terminals[0].payload.workerId;
}, "duplicate identity");
mutateFleet("omitted terminal worker rejected", (draft) => {
  const index = draft.findLastIndex((item) => item.type === "worker.terminal");
  draft.splice(index, 1);
}, "every spawn needs one terminal receipt");
mutateFleet("timed-out worker cannot count as qualifying", (draft) => {
  const terminal = event(draft, "worker.terminal");
  terminal.payload.status = "timed_out";
  terminal.payload.usageDigest = TIMED_OUT_USAGE_DIGEST;
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
mutateFleet("sealed token budget overrun rejected", (draft) => {
  const terminal = event(draft, "worker.terminal");
  const completed = event(draft, "run.completed");
  const increase = MAX_TOKENS;
  terminal.payload.totalTokens = Number(terminal.payload.totalTokens) + increase;
  terminal.payload.usageDigest = OVER_BUDGET_USAGE_DIGEST;
  completed.payload.totalTokens = Number(completed.payload.totalTokens) + increase;
}, "sealed token or cost ceiling exceeded");
cases.push({
  name: "non-finite sealed budget rejected",
  baseline: reseal(baseline, (draft) => { event(draft, "run.sealed").payload.maxTokens = Number.POSITIVE_INFINITY; }),
  fleet: reseal(fleet, (draft) => { event(draft, "run.sealed").payload.maxTokens = Number.POSITIVE_INFINITY; }),
  expected: "invalid resource budget",
});
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
mutateFleet("clean replay digest mismatch rejected", (draft) => {
  event(draft, "candidate.replayed").payload.sourceDigest = "sha256:workspace-marker-contaminated";
}, "clean checkout digest differs");
mutateFleet("malformed integrated source digest rejected", (draft) => {
  const malformed = "sha256:not-a-digest";
  for (const type of ["candidate.integrated", "candidate.replayed", "proof.verified", "preview.verified"] as const) {
    event(draft, type).payload.sourceDigest = malformed;
  }
  event(draft, "preview.verified").payload.servedSourceDigest = malformed;
}, "valid source-tree SHA-256 digest missing");
mutateFleet("jointly substituted source assertions rejected by external recomputation", (draft) => {
  const substituted = `sha256:${"c".repeat(64)}`;
  for (const type of ["candidate.integrated", "candidate.replayed", "proof.verified", "preview.verified"] as const) {
    event(draft, type).payload.sourceDigest = substituted;
  }
  event(draft, "preview.verified").payload.servedSourceDigest = substituted;
}, "integrated source differs from recomputed source tree");
mutateFleet("proof digest mismatch rejected", (draft) => { event(draft, "proof.verified").payload.sourceDigest = "sha256:wrong"; }, "proof does not admit");
mutateFleet("receipt-supplied unsealed proof signer rejected", (draft) => {
  event(draft, "proof.verified").payload.keyId = "self-supplied-key";
}, "sealed signer");
mutateFleet("self-sealed signer substitution rejected by external seal", (draft) => {
  event(draft, "run.sealed").payload.trustedProofKeyId = "attacker-key";
  event(draft, "proof.verified").payload.keyId = "attacker-key";
}, "source replay or trusted signer differs");
mutateFleet("missing preview rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "preview.verified");
  draft.splice(index, 1);
}, "preview.verified: expected exactly one");
mutateFleet("preview without matching served source marker rejected", (draft) => {
  event(draft, "preview.verified").payload.servedSourceDigest = "sha256:old-deployment";
}, "source marker, version, evidence");
mutateFleet("preview without a non-empty URL rejected", (draft) => {
  event(draft, "preview.verified").payload.url = "";
}, "source marker, version, evidence");
mutateFleet("preview without a non-empty deployment version rejected", (draft) => {
  event(draft, "preview.verified").payload.versionId = "";
}, "source marker, version, evidence");
mutateFleet("negative event clock rejected", (draft) => {
  event(draft, "proof.verified").atMs = -3;
  event(draft, "preview.verified").atMs = -2;
  event(draft, "run.completed").atMs = -1;
  event(draft, "run.completed").payload.elapsedMs = -1;
}, "timestamp must be finite, non-negative, and monotonic");
mutateFleet("completion before proof rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "run.completed");
  const [completed] = draft.splice(index, 1);
  completed.atMs = 75;
  const proofIndex = draft.findIndex((item) => item.type === "proof.verified");
  draft.splice(proofIndex, 0, completed);
}, "clock stopped before proof");
mutateFleet("completion after proof but before preview rejected", (draft) => {
  const index = draft.findIndex((item) => item.type === "run.completed");
  const [completed] = draft.splice(index, 1);
  completed.atMs = 85;
  const previewIndex = draft.findIndex((item) => item.type === "preview.verified");
  draft.splice(previewIndex, 0, completed);
}, "clock stopped before proof and preview");
mutateFleet("omitted retry accounting rejected", (draft) => { event(draft, "run.completed").payload.retryMs = 0; }, "retry, compute, token, or cost totals omitted");
mutateFleet("promotion request cannot be called production promotion", (draft) => {
  event(draft, "run.completed").payload.promotionState = "promoted";
}, "baseline cannot claim production promotion");
mutateFleet("observed refusal boundary cannot report production change", (draft) => {
  event(draft, "preview.verified").payload.productionChanged = true;
}, "no-live-traffic boundary missing");
cases.push({
  name: "receipt prose cannot drift from events",
  receipt: { ...structuredClone(receipt), claim: "1000 agents made software instantly" },
  expected: "claim or derived values differ",
});

const outcomes = cases.map((testCase) => {
  const verdict = verifyComparisonReceipt(
    testCase.receipt ?? receipt,
    testCase.baseline ?? baseline,
    testCase.fleet ?? fleet,
    testCase.baselineContext ?? context,
    testCase.fleetContext ?? context,
  );
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
