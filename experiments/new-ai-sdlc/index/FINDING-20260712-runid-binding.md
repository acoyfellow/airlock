# Finding — worker receipt/usage run-ID content binding (oracle item 2 + 7)

## What changed
oracle.ts worker-qualification now parses the content-addressed `rawReceiptDigest`
and `usageDigest` artifacts and requires each artifact's `runId` to equal the
worker.terminal `receiptId`. A syntactically valid, hash-correct artifact is no longer
sufficient — its CONTENT must be bound to this worker's Terrarium run id.

## Why
Review of run aomkje + finalizer design (q14kpi) required receipt/usage run-ID binding:
without it, a fake fleet could attach ANY run's real usage/receipt blob (borrowed
evidence) to inflate qualifying-worker counts while passing every prior check.

## Proof
`bun run new-sdlc:oracle` -> control green; 38/38 mutations red (was 36).
Two new permanent mutations, both red for their exact reasons:
- "borrowed usage evidence not bound to worker rejected" -> usage run id not bound to worker receipt
- "borrowed receipt evidence not bound to worker rejected" -> receipt run id not bound to worker receipt
Repo `bun run typecheck` exit 0.

## Conserved / not done
- pi-meter already writes `runId` into its raw usage record (schemaVersion 1), so the
  finalizer can emit a bound usage artifact directly. Binding the pi-meter output to the
  INJECTED TERRARIUM_RUN_ID (vs the supervisor --run-id arg) remains handoff item 7,
  tracked for the finalize.ts tick.
- Remaining sequence unchanged: evidence-manifest proof binding (3), response-body
  marker (4), exact preview hostname (5), byte-safe artifacts (6), finalize.ts (8),
  SEAL.v5 (9), baseline 6 (10). Eight-agent tier + X LOCKED.

## Hammer for next tick
The oracle now enforces bound worker evidence, so 001/finalize.ts must PRODUCE
receipt+usage artifacts whose runId == the produced worker receipt id, or the run
fails the oracle. This constrains the finalizer contract concretely.
