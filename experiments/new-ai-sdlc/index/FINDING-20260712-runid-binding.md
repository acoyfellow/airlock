# Finding — authoritative usage accounting and injected run-ID binding (oracle items 2 + 7)

## What changed
`oracle.ts` worker qualification now parses the content-addressed `rawReceiptDigest`
and `usageDigest` artifacts. Both must bind their `runId` to the worker-terminal
`receiptId`; the usage artifact must additionally name the injected
`TERRARIUM_RUN_ID` authority. Parsed usage `totalTokens` and `costUsd` must exactly match
the worker terminal and aggregate into `run.completed`; provider, model, and status
assertions are bound whenever the artifact supplies them. A syntactically valid,
hash-correct artifact is therefore insufficient.

## Why
Review of run aomkje + finalizer design (q14kpi) required receipt/usage run-ID binding.
The follow-up found that a correct-runId, hash-correct usage artifact could still carry
contradictory resource totals after the receipt was regenerated. Separately, `pi-meter`
let a caller select an arbitrary CLI `--run-id`. Either gap could launder usage onto
another real Terrarium run.

## Proof
`bun run new-sdlc:oracle` -> control green; 39/39 mutations red (was 36).
Permanent mutations 37 through 39 are red for their exact reasons:
- "borrowed usage evidence not bound to worker rejected" -> usage run id not bound to worker receipt;
- "borrowed receipt evidence not bound to worker rejected" -> receipt run id not bound to worker receipt;
- "usage artifact totals and identity must bind to terminal and completed run" -> usage
  `totalTokens` not bound to worker terminal.

`node --test experiments/new-ai-sdlc/001-single-agent/pi-meter.test.mjs` covers a missing
injected id, matching injected/CLI ids, conflicting injected/CLI ids, and omitted CLI id
derivation. `bun run typecheck` exits 0.

## Conserved / not done
- `pi-meter` now requires `TERRARIUM_RUN_ID` for every invocation and emits it as both
  `runId` and `authority.terrariumRunId`; CLI `--run-id` is optional exact-match-only.
  Child-reported ids are corroboration only and cannot relabel the record.
- Remaining sequence: evidence-manifest proof binding (3), response-body marker (4),
  exact preview hostname (5), byte-safe artifacts (6), `finalize.ts` (8), `SEAL.v5` (9),
  baseline attempt 6 (10). Eight-agent tier + X remain locked.

## Hammer for next tick
The oracle now requires 001/finalize.ts to produce receipt+usage artifacts whose runId
and `authority.terrariumRunId` equal the produced worker receipt id, whose parsed usage
and identity assertions match `worker.terminal`, and whose sums match `run.completed`.
This constrains the finalizer contract concretely.
