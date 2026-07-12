import { createHash } from "node:crypto";
import { verifySignedProof, type SignedProof } from "keel";

export type RunMode = "baseline" | "fleet";
export type EventType =
  | "run.sealed"
  | "worker.spawned"
  | "worker.terminal"
  | "commit.produced"
  | "commit.dispositioned"
  | "collision.detected"
  | "collision.resolved"
  | "behavior.accepted"
  | "behavior.integrated"
  | "check.result"
  | "candidate.integrated"
  | "candidate.replayed"
  | "proof.verified"
  | "preview.verified"
  | "human.product-write"
  | "run.completed";

export type Event = {
  runId: string;
  seq: number;
  atMs: number;
  actor: string;
  type: EventType;
  payload: Record<string, unknown>;
  prevDigest: string | null;
  digest: string;
};

export type UnsignedEvent = Omit<Event, "prevDigest" | "digest">;

const EVENT_TYPES = new Set<EventType>([
  "run.sealed",
  "worker.spawned",
  "worker.terminal",
  "commit.produced",
  "commit.dispositioned",
  "collision.detected",
  "collision.resolved",
  "behavior.accepted",
  "behavior.integrated",
  "check.result",
  "candidate.integrated",
  "candidate.replayed",
  "proof.verified",
  "preview.verified",
  "human.product-write",
  "run.completed",
]);

export type RunReceipt = {
  runId: string;
  mode: RunMode;
  acceptanceHash: string;
  startCommit: string;
  provider: string;
  model: string;
  maxTokens: number;
  maxCostUsd: number;
  trustedProofKeyId: string;
  advertisedWorkers: number;
  qualifyingWorkers: number;
  terminalWorkers: number;
  commitsProduced: number;
  commitsDispositioned: number;
  collisionsDetected: number;
  collisionsResolved: number;
  checksPassed: number;
  sourceDigest: string;
  previewUrl: string;
  elapsedMs: number;
  retryMs: number;
  computeMs: number;
  totalTokens: number;
  totalCostUsd: number;
  finalEventDigest: string;
  claim: string;
};

export type ComparisonReceipt = {
  schema: "new-ai-sdlc/claim-oracle@1";
  baseline: RunReceipt;
  fleet: RunReceipt;
  speedup: number;
  claim: string;
};

export type VerificationContext = {
  artifacts: Record<string, string>;
  externalSeal: {
    expectedSourceDigest: string;
    cleanReplaySourceDigest: string;
    trustedProofKeyId: string;
    trustedProofPublicPem: string;
    productionChanged: boolean;
  };
};

export type Verdict = { ok: true } | { ok: false; reason: string };

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function eventDigest(event: Omit<Event, "digest">): string {
  return hash({
    runId: event.runId,
    seq: event.seq,
    atMs: event.atMs,
    actor: event.actor,
    type: event.type,
    payload: event.payload,
    prevDigest: event.prevDigest,
  });
}

export function sealEvents(unsigned: UnsignedEvent[]): Event[] {
  let previous: string | null = null;
  return unsigned.map((event, index) => {
    const withPrevious = { ...event, seq: index, prevDigest: previous };
    const sealed = { ...withPrevious, digest: eventDigest(withPrevious) };
    previous = sealed.digest;
    return sealed;
  });
}

function fail(reason: string): never {
  throw new Error(reason);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function artifact(context: VerificationContext, digest: unknown, label: string): string {
  if (!isSha256(digest)) fail(`${label}: invalid artifact digest`);
  const bytes = context.artifacts[digest];
  if (typeof bytes !== "string") fail(`${label}: referenced artifact missing`);
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== digest) fail(`${label}: artifact hash mismatch`);
  return bytes;
}

function one(events: Event[], type: EventType): Event {
  const found = events.filter((event) => event.type === type);
  if (found.length !== 1) fail(`${type}: expected exactly one event, got ${found.length}`);
  return found[0];
}

function strings(events: Event[], type: EventType, field: string): string[] {
  return events.filter((event) => event.type === type).map((event) => {
    const value = event.payload[field];
    if (typeof value !== "string" || value.length === 0) fail(`${type}.${field}: missing string`);
    return value;
  });
}

function unique(values: string[], label: string): Set<string> {
  const result = new Set(values);
  if (result.size !== values.length) fail(`${label}: duplicate identity`);
  return result;
}

type ArtifactObject = Record<string, unknown>;

function isArtifactObject(value: unknown): value is ArtifactObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArtifact(bytes: string, label: string): ArtifactObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    fail(`worker qualification: ${label} artifact is not JSON`);
  }
  if (!isArtifactObject(parsed)) fail(`worker qualification: ${label} artifact is not an object`);
  return parsed;
}

function usageAccounting(usage: ArtifactObject): ArtifactObject {
  if (usage.accounting === undefined) return usage;
  if (!isArtifactObject(usage.accounting)) fail("worker qualification: usage accounting is not an object");
  return usage.accounting;
}

function normalizedUsageStatus(status: string): string {
  // pi-meter's terminal vocabulary is more specific than the event ledger's terminal
  // vocabulary. Its terminal output remains authoritative after this one-way mapping.
  if (status === "succeeded") return "success";
  if (["malformed_usage", "run_id_mismatch", "identity_mismatch", "stream_incomplete", "budget_exceeded", "child_failed"].includes(status)) {
    return "failed";
  }
  return status;
}

function bindUsageString(value: unknown, expected: unknown, label: string, normalize = (input: string) => input): void {
  if (value === undefined) return;
  if (typeof value !== "string" || value.length === 0 || normalize(value) !== expected) {
    fail(`worker qualification: usage ${label} not bound to worker terminal`);
  }
}

function bindUsageTotals(accounting: ArtifactObject, payload: Record<string, unknown>): { totalTokens: number; costUsd: number } {
  const totalTokens = accounting.totalTokens;
  const costUsd = accounting.costUsd;
  if (!isSafeInteger(totalTokens) || totalTokens < 0 || !isFiniteNumber(costUsd) || costUsd < 0) {
    fail("worker qualification: usage artifact totals are missing, negative, or non-finite");
  }
  if (totalTokens !== payload.totalTokens) fail("worker qualification: usage totalTokens not bound to worker terminal");
  if (costUsd !== payload.costUsd) fail("worker qualification: usage costUsd not bound to worker terminal");
  return { totalTokens, costUsd };
}

function bindUsageIdentity(usage: ArtifactObject, payload: Record<string, unknown>): void {
  bindUsageString(usage.provider, payload.provider, "provider");
  bindUsageString(usage.model, payload.model, "model");
  bindUsageString(usage.status, payload.status, "status", normalizedUsageStatus);

  if (usage.identity !== undefined) {
    if (!isArtifactObject(usage.identity)) fail("worker qualification: usage identity is not an object");
    bindUsageString(usage.identity.expectedProvider, payload.provider, "provider");
    bindUsageString(usage.identity.expectedModel, payload.model, "model");
    for (const [field, expected] of [["providers", payload.provider], ["models", payload.model]] as const) {
      const values = usage.identity[field];
      if (values === undefined) continue;
      if (!Array.isArray(values) || values.length === 0) fail(`worker qualification: usage ${field} is not a non-empty array`);
      for (const value of values) bindUsageString(value, expected, field.slice(0, -1));
    }
  }

  if (usage.terminal !== undefined) {
    if (!isArtifactObject(usage.terminal)) fail("worker qualification: usage terminal is not an object");
    bindUsageString(usage.terminal.status, payload.status, "status", normalizedUsageStatus);
  }
}

export function deriveRunReceipt(events: Event[], context: VerificationContext): RunReceipt {
  if (events.length === 0) fail("event chain: empty");
  const runId = events[0].runId;
  let previous: string | null = null;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!EVENT_TYPES.has(event.type)) fail(`event type: unknown ${String(event.type)}`);
    if (!Number.isFinite(event.atMs) || event.atMs < 0 || (index > 0 && event.atMs < events[index - 1].atMs)) {
      fail("event time: timestamp must be finite, non-negative, and monotonic");
    }
    if (event.runId !== runId) fail("event chain: cross-run replay");
    if (event.seq !== index) fail("event chain: sequence mismatch");
    if (event.prevDigest !== previous) fail("event chain: previous digest mismatch");
    if (event.digest !== eventDigest({ ...event, digest: undefined } as never)) fail("event chain: digest mismatch");
    previous = event.digest;
  }

  const sealed = one(events, "run.sealed");
  const mode = sealed.payload.mode;
  const acceptanceHash = sealed.payload.acceptanceHash;
  const startCommit = sealed.payload.startCommit;
  const provider = sealed.payload.provider;
  const model = sealed.payload.model;
  const maxTokens = sealed.payload.maxTokens;
  const maxCostUsd = sealed.payload.maxCostUsd;
  const trustedProofKeyId = sealed.payload.trustedProofKeyId;
  const advertisedWorkers = sealed.payload.advertisedWorkers;
  if (mode !== "baseline" && mode !== "fleet") fail("run.sealed.mode: unknown");
  if (
    typeof acceptanceHash !== "string" ||
    typeof startCommit !== "string" ||
    typeof provider !== "string" ||
    typeof model !== "string" ||
    typeof trustedProofKeyId !== "string" || trustedProofKeyId.length === 0
  ) fail("run.sealed: missing comparison identity");
  if (!isSafeInteger(maxTokens) || maxTokens <= 0 || !isFiniteNumber(maxCostUsd) || maxCostUsd <= 0) {
    fail("run.sealed: invalid resource budget");
  }
  if (!Number.isSafeInteger(advertisedWorkers) || (advertisedWorkers as number) < 1) fail("run.sealed.advertisedWorkers: invalid");
  if (
    trustedProofKeyId !== context.externalSeal.trustedProofKeyId ||
    context.externalSeal.productionChanged !== false ||
    !isSha256(context.externalSeal.expectedSourceDigest) ||
    context.externalSeal.cleanReplaySourceDigest !== context.externalSeal.expectedSourceDigest
  ) fail("external seal: source replay or trusted signer differs");

  const spawnedIds = strings(events, "worker.spawned", "workerId");
  const terminalEvents = events.filter((event) => event.type === "worker.terminal");
  const terminalIds = terminalEvents.map((event) => String(event.payload.workerId));
  const spawned = unique(spawnedIds, "worker.spawned");
  unique(terminalIds, "worker.terminal");
  if (spawned.size !== advertisedWorkers) fail("worker conservation: advertised count differs from spawned receipts");
  if (terminalIds.length !== spawned.size || terminalIds.some((id) => !spawned.has(id))) fail("worker conservation: every spawn needs one terminal receipt");
  const allowedTerminal = new Set(["success", "no_change", "blocked", "failed", "timed_out", "cancelled"]);
  const parsedUsageTotals: Array<{ totalTokens: number; costUsd: number }> = [];
  for (const event of terminalEvents) {
    if (!allowedTerminal.has(String(event.payload.status))) fail("worker.terminal.status: unknown");
    if (event.payload.kind !== "model") fail("worker qualification: deterministic script counted as model worker");
    if (event.payload.provider !== provider || event.payload.model !== model) {
      fail("worker qualification: provider or model differs from sealed invocation");
    }
    if (typeof event.payload.receiptId !== "string") fail("worker qualification: durable task receipt missing");
    if (!isSha256(event.payload.rawReceiptDigest) || !isSha256(event.payload.usageDigest)) {
      fail("worker qualification: content-addressed raw receipt or usage evidence missing");
    }
    const receiptId = event.payload.receiptId;
    const boundReceipt = parseArtifact(artifact(context, event.payload.rawReceiptDigest, "worker receipt"), "receipt");
    const boundUsage = parseArtifact(artifact(context, event.payload.usageDigest, "worker usage"), "usage");
    // The usage record is emitted by pi-meter under the injected TERRARIUM_RUN_ID.
    // Its run id and authority evidence must name this terminal receipt, not a caller
    // argument, and all parsed accounting/identity assertions must agree with the
    // terminal event that feeds the run aggregate.
    if (boundReceipt.runId !== receiptId) fail("worker qualification: receipt run id not bound to worker receipt");
    if (boundUsage.runId !== receiptId) fail("worker qualification: usage run id not bound to worker receipt");
    if (!isArtifactObject(boundUsage.authority) || boundUsage.authority.source !== "TERRARIUM_RUN_ID" || boundUsage.authority.terrariumRunId !== receiptId) {
      fail("worker qualification: usage run id is not bound to injected Terrarium authority");
    }
    const boundAccounting = usageAccounting(boundUsage);
    const usageTotals = bindUsageTotals(boundAccounting, event.payload);
    // A meter-shaped artifact carries totals in accounting; if it also makes direct
    // root-level total assertions, they are independently bound rather than ignored.
    if (boundUsage.accounting !== undefined && (boundUsage.totalTokens !== undefined || boundUsage.costUsd !== undefined)) {
      bindUsageTotals(boundUsage, event.payload);
    }
    bindUsageIdentity(boundUsage, event.payload);
    parsedUsageTotals.push(usageTotals);
    if (
      !Number.isSafeInteger(event.payload.totalTokens) || (event.payload.totalTokens as number) < 0 ||
      !Number.isFinite(event.payload.costUsd) || (event.payload.costUsd as number) < 0 ||
      !Number.isFinite(event.payload.retryMs) || (event.payload.retryMs as number) < 0 ||
      !Number.isFinite(event.payload.computeMs) || (event.payload.computeMs as number) < 0
    ) fail("resource accounting: worker usage is missing, negative, or non-finite");
  }
  const qualifyingStatuses = new Set(["success", "no_change", "blocked"]);
  const qualifyingWorkers = terminalEvents.filter(
    (event) => event.payload.kind === "model" && qualifyingStatuses.has(String(event.payload.status)),
  ).length;
  if (qualifyingWorkers !== advertisedWorkers) fail("worker qualification: advertised count differs from qualifying receipts");

  if (events.some((event) => event.type === "human.product-write")) fail("measurement contamination: hidden human product write");

  const produced = strings(events, "commit.produced", "commit");
  const dispositions = events.filter((event) => event.type === "commit.dispositioned");
  const dispositionCommits = strings(events, "commit.dispositioned", "commit");
  unique(produced, "commit.produced");
  unique(dispositionCommits, "commit.dispositioned");
  const allowedDispositions = new Set(["accepted", "rejected", "superseded", "duplicate", "reconciled", "blocked"]);
  for (const event of dispositions) if (!allowedDispositions.has(String(event.payload.disposition))) fail("commit disposition: unknown");
  if (produced.length !== dispositionCommits.length || produced.some((commit) => !dispositionCommits.includes(commit))) fail("commit conservation: produced commit missing final disposition");

  const acceptedBehaviors = unique(strings(events, "behavior.accepted", "behaviorId"), "behavior.accepted");
  const integratedBehaviors = unique(strings(events, "behavior.integrated", "behaviorId"), "behavior.integrated");
  for (const behavior of acceptedBehaviors) if (!integratedBehaviors.has(behavior)) fail("behavior conservation: accepted behavior silently lost");

  const collisions = unique(strings(events, "collision.detected", "collisionId"), "collision.detected");
  const resolutions = unique(strings(events, "collision.resolved", "collisionId"), "collision.resolved");
  for (const collision of collisions) if (!resolutions.has(collision)) fail("collision conservation: collision has no resolution");
  if (resolutions.size !== collisions.size) fail("collision conservation: resolution without collision");

  const checks = events.filter((event) => event.type === "check.result");
  if (checks.length === 0) fail("checks: no declared results");
  for (const event of checks) {
    if (event.payload.contractHash !== acceptanceHash) fail("comparison fairness: check used different acceptance contract");
    if (event.payload.ok !== true || event.payload.exitCode !== 0) fail("checks: acceptance failed");
    if (!isSha256(event.payload.outputDigest) || !Number.isFinite(event.payload.durationMs) || (event.payload.durationMs as number) < 0) {
      fail("checks: content-addressed output or duration evidence missing");
    }
    artifact(context, event.payload.outputDigest, "check output");
  }

  const candidate = one(events, "candidate.integrated");
  const sourceDigest = candidate.payload.sourceDigest;
  if (!isSha256(sourceDigest)) fail("candidate: valid source-tree SHA-256 digest missing");
  if (sourceDigest !== context.externalSeal.expectedSourceDigest) fail("external seal: integrated source differs from recomputed source tree");
  const replay = one(events, "candidate.replayed");
  if (
    replay.payload.sourceDigest !== sourceDigest || replay.payload.cleanCheckout !== true ||
    !isSha256(replay.payload.replayTranscriptDigest)
  ) fail("candidate replay: clean checkout digest differs from integrated candidate");
  artifact(context, replay.payload.replayTranscriptDigest, "clean replay transcript");
  const proof = one(events, "proof.verified");
  if (
    proof.payload.admitted !== true || proof.payload.sourceDigest !== sourceDigest ||
    proof.payload.keyId !== trustedProofKeyId || !isSha256(proof.payload.proofArtifactDigest)
  ) fail("proof binding: proof does not admit candidate source-tree digest with sealed signer");
  const proofBytes = artifact(context, proof.payload.proofArtifactDigest, "signed proof");
  let signedProof: SignedProof;
  try { signedProof = JSON.parse(proofBytes) as SignedProof; } catch { fail("proof binding: signed proof artifact is not JSON"); }
  const proofDecision = verifySignedProof(
    signedProof!,
    sourceDigest,
    { [context.externalSeal.trustedProofKeyId]: context.externalSeal.trustedProofPublicPem },
  );
  if (!proofDecision.admitted) fail(`proof binding: cryptographic verification failed: ${proofDecision.reason}`);
  const preview = one(events, "preview.verified");
  if (
    preview.payload.sourceDigest !== sourceDigest || preview.payload.servedSourceDigest !== sourceDigest ||
    preview.payload.noLiveTraffic !== true ||
    preview.payload.productionChanged !== context.externalSeal.productionChanged ||
    typeof preview.payload.url !== "string" || preview.payload.url.length === 0 ||
    typeof preview.payload.versionId !== "string" || preview.payload.versionId.length === 0 ||
    !isSha256(preview.payload.responseDigest) || !isSha256(preview.payload.deployTranscriptDigest)
  ) fail("preview: source marker, version, evidence, or no-live-traffic boundary missing");
  artifact(context, preview.payload.responseDigest, "preview response");
  artifact(context, preview.payload.deployTranscriptDigest, "deploy transcript");

  const completed = one(events, "run.completed");
  const completionIndex = events.indexOf(completed);
  if (completionIndex < events.indexOf(proof) || completionIndex < events.indexOf(preview)) fail("completion time: clock stopped before proof and preview verification");
  if (completed.payload.promotionState !== "requested" && completed.payload.promotionState !== "none") {
    fail("promotion boundary: baseline cannot claim production promotion");
  }
  const elapsedMs = completed.payload.elapsedMs;
  const retryMs = completed.payload.retryMs;
  const computeMs = completed.payload.computeMs;
  const totalTokens = completed.payload.totalTokens;
  const totalCostUsd = completed.payload.totalCostUsd;
  if (!Number.isFinite(elapsedMs) || (elapsedMs as number) < 0 || (elapsedMs as number) < Math.max(proof.atMs, preview.atMs)) fail("completion time: elapsed time excludes verified completion");
  if (
    !Number.isFinite(retryMs) || (retryMs as number) < 0 ||
    !Number.isFinite(computeMs) || (computeMs as number) < 0 ||
    !Number.isSafeInteger(totalTokens) || (totalTokens as number) < 0 ||
    !Number.isFinite(totalCostUsd) || (totalCostUsd as number) < 0
  ) fail("resource accounting: completed usage is missing, negative, or non-finite");
  const derivedRetryMs = terminalEvents.reduce((sum, event) => sum + Number(event.payload.retryMs ?? 0), 0);
  const derivedComputeMs = terminalEvents.reduce((sum, event) => sum + Number(event.payload.computeMs ?? 0), 0);
  const derivedTotalTokens = terminalEvents.reduce((sum, event) => sum + Number(event.payload.totalTokens), 0);
  const derivedTotalCostUsd = terminalEvents.reduce((sum, event) => sum + Number(event.payload.costUsd), 0);
  const derivedUsageTotalTokens = parsedUsageTotals.reduce((sum, usage) => sum + usage.totalTokens, 0);
  const derivedUsageCostUsd = parsedUsageTotals.reduce((sum, usage) => sum + usage.costUsd, 0);
  if (
    retryMs !== derivedRetryMs || computeMs !== derivedComputeMs ||
    totalTokens !== derivedTotalTokens || totalCostUsd !== derivedTotalCostUsd
  ) fail("resource accounting: retry, compute, token, or cost totals omitted");
  if (totalTokens !== derivedUsageTotalTokens || totalCostUsd !== derivedUsageCostUsd) {
    fail("resource accounting: usage artifact totals not bound to completed run");
  }
  if (totalTokens > maxTokens || totalCostUsd > maxCostUsd) fail("resource budget: sealed token or cost ceiling exceeded");

  const receiptWithoutClaim = {
    runId,
    mode,
    acceptanceHash,
    startCommit,
    provider,
    model,
    maxTokens,
    maxCostUsd,
    trustedProofKeyId,
    advertisedWorkers,
    qualifyingWorkers,
    terminalWorkers: terminalEvents.length,
    commitsProduced: produced.length,
    commitsDispositioned: dispositions.length,
    collisionsDetected: collisions.size,
    collisionsResolved: resolutions.size,
    checksPassed: checks.length,
    sourceDigest,
    previewUrl: preview.payload.url,
    elapsedMs,
    retryMs,
    computeMs,
    totalTokens,
    totalCostUsd,
    finalEventDigest: events.at(-1)!.digest,
  } as Omit<RunReceipt, "claim">;
  return { ...receiptWithoutClaim, claim: runClaim(receiptWithoutClaim) };
}

function runClaim(receipt: Omit<RunReceipt, "claim">): string {
  return `${receipt.mode} reached verified preview in ${receipt.elapsedMs}ms with ${receipt.qualifyingWorkers}/${receipt.advertisedWorkers} qualifying workers`;
}

export function generateComparisonReceipt(
  baselineEvents: Event[],
  fleetEvents: Event[],
  baselineContext: VerificationContext,
  fleetContext: VerificationContext,
): ComparisonReceipt {
  const baseline = deriveRunReceipt(baselineEvents, baselineContext);
  const fleet = deriveRunReceipt(fleetEvents, fleetContext);
  if (baseline.mode !== "baseline" || fleet.mode !== "fleet") fail("comparison fairness: baseline/fleet modes required");
  if (baseline.acceptanceHash !== fleet.acceptanceHash) fail("comparison fairness: acceptance contracts differ");
  if (baseline.startCommit !== fleet.startCommit) fail("comparison fairness: initial commits differ");
  if (baseline.provider !== fleet.provider || baseline.model !== fleet.model) {
    fail("comparison fairness: provider or model differs");
  }
  if (baseline.maxTokens !== fleet.maxTokens || baseline.maxCostUsd !== fleet.maxCostUsd) {
    fail("comparison fairness: resource budgets differ");
  }
  if (baseline.trustedProofKeyId !== fleet.trustedProofKeyId) fail("comparison fairness: proof signer differs");
  const speedup = baseline.elapsedMs / fleet.elapsedMs;
  return {
    schema: "new-ai-sdlc/claim-oracle@1",
    baseline,
    fleet,
    speedup,
    claim: `fleet reached an equivalent verified preview ${speedup.toFixed(2)}x faster than baseline`,
  };
}

export function verifyComparisonReceipt(
  receipt: ComparisonReceipt,
  baselineEvents: Event[],
  fleetEvents: Event[],
  baselineContext: VerificationContext,
  fleetContext: VerificationContext,
): Verdict {
  try {
    const expected = generateComparisonReceipt(baselineEvents, fleetEvents, baselineContext, fleetContext);
    if (JSON.stringify(receipt) !== JSON.stringify(expected)) return { ok: false, reason: "receipt integrity: claim or derived values differ from events" };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
