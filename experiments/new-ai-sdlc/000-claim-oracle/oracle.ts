import { createHash } from "node:crypto";

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

export function deriveRunReceipt(events: Event[]): RunReceipt {
  if (events.length === 0) fail("event chain: empty");
  const runId = events[0].runId;
  let previous: string | null = null;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!EVENT_TYPES.has(event.type)) fail(`event type: unknown ${String(event.type)}`);
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
  const advertisedWorkers = sealed.payload.advertisedWorkers;
  if (mode !== "baseline" && mode !== "fleet") fail("run.sealed.mode: unknown");
  if (
    typeof acceptanceHash !== "string" ||
    typeof startCommit !== "string" ||
    typeof provider !== "string" ||
    typeof model !== "string"
  ) fail("run.sealed: missing comparison identity");
  if (!Number.isInteger(advertisedWorkers) || (advertisedWorkers as number) < 1) fail("run.sealed.advertisedWorkers: invalid");

  const spawnedIds = strings(events, "worker.spawned", "workerId");
  const terminalEvents = events.filter((event) => event.type === "worker.terminal");
  const terminalIds = terminalEvents.map((event) => String(event.payload.workerId));
  const spawned = unique(spawnedIds, "worker.spawned");
  unique(terminalIds, "worker.terminal");
  if (spawned.size !== advertisedWorkers) fail("worker conservation: advertised count differs from spawned receipts");
  if (terminalIds.length !== spawned.size || terminalIds.some((id) => !spawned.has(id))) fail("worker conservation: every spawn needs one terminal receipt");
  const allowedTerminal = new Set(["success", "no_change", "blocked", "failed", "timed_out", "cancelled"]);
  for (const event of terminalEvents) {
    if (!allowedTerminal.has(String(event.payload.status))) fail("worker.terminal.status: unknown");
    if (event.payload.kind !== "model") fail("worker qualification: deterministic script counted as model worker");
    if (event.payload.provider !== provider || event.payload.model !== model) {
      fail("worker qualification: provider or model differs from sealed invocation");
    }
    if (typeof event.payload.receiptId !== "string") fail("worker qualification: durable task receipt missing");
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
    if (event.payload.ok !== true) fail("checks: acceptance failed");
  }

  const candidate = one(events, "candidate.integrated");
  const sourceDigest = candidate.payload.sourceDigest;
  if (typeof sourceDigest !== "string" || !sourceDigest.startsWith("sha256:")) fail("candidate: source-tree digest missing");
  const proof = one(events, "proof.verified");
  if (proof.payload.admitted !== true || proof.payload.sourceDigest !== sourceDigest) fail("proof binding: proof does not admit candidate source-tree digest");
  const preview = one(events, "preview.verified");
  if (preview.payload.sourceDigest !== sourceDigest || preview.payload.noLiveTraffic !== true || typeof preview.payload.url !== "string") fail("preview: unverifiable candidate or live-traffic boundary missing");

  const completed = one(events, "run.completed");
  const completionIndex = events.indexOf(completed);
  if (completionIndex < events.indexOf(proof) || completionIndex < events.indexOf(preview)) fail("completion time: clock stopped before proof and preview verification");
  const elapsedMs = completed.payload.elapsedMs;
  const retryMs = completed.payload.retryMs;
  const computeMs = completed.payload.computeMs;
  if (typeof elapsedMs !== "number" || elapsedMs < Math.max(proof.atMs, preview.atMs)) fail("completion time: elapsed time excludes verified completion");
  const derivedRetryMs = terminalEvents.reduce((sum, event) => sum + Number(event.payload.retryMs ?? 0), 0);
  const derivedComputeMs = terminalEvents.reduce((sum, event) => sum + Number(event.payload.computeMs ?? 0), 0);
  if (retryMs !== derivedRetryMs || computeMs !== derivedComputeMs) fail("resource accounting: retry or compute totals omitted");

  const receiptWithoutClaim = {
    runId,
    mode,
    acceptanceHash,
    startCommit,
    provider,
    model,
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
    finalEventDigest: events.at(-1)!.digest,
  } as Omit<RunReceipt, "claim">;
  return { ...receiptWithoutClaim, claim: runClaim(receiptWithoutClaim) };
}

function runClaim(receipt: Omit<RunReceipt, "claim">): string {
  return `${receipt.mode} reached verified preview in ${receipt.elapsedMs}ms with ${receipt.qualifyingWorkers}/${receipt.advertisedWorkers} qualifying workers`;
}

export function generateComparisonReceipt(baselineEvents: Event[], fleetEvents: Event[]): ComparisonReceipt {
  const baseline = deriveRunReceipt(baselineEvents);
  const fleet = deriveRunReceipt(fleetEvents);
  if (baseline.mode !== "baseline" || fleet.mode !== "fleet") fail("comparison fairness: baseline/fleet modes required");
  if (baseline.acceptanceHash !== fleet.acceptanceHash) fail("comparison fairness: acceptance contracts differ");
  if (baseline.startCommit !== fleet.startCommit) fail("comparison fairness: initial commits differ");
  if (baseline.provider !== fleet.provider || baseline.model !== fleet.model) {
    fail("comparison fairness: provider or model differs");
  }
  const speedup = baseline.elapsedMs / fleet.elapsedMs;
  return {
    schema: "new-ai-sdlc/claim-oracle@1",
    baseline,
    fleet,
    speedup,
    claim: `fleet reached an equivalent verified preview ${speedup.toFixed(2)}x faster than baseline`,
  };
}

export function verifyComparisonReceipt(receipt: ComparisonReceipt, baselineEvents: Event[], fleetEvents: Event[]): Verdict {
  try {
    const expected = generateComparisonReceipt(baselineEvents, fleetEvents);
    if (JSON.stringify(receipt) !== JSON.stringify(expected)) return { ok: false, reason: "receipt integrity: claim or derived values differ from events" };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
