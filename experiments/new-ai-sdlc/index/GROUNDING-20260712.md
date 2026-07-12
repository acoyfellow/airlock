# Orchestrator grounding — 2026-07-12

Loop file: experiments/new-ai-sdlc/TERRALOOP.md (canonical .context/TERRALOOP.md untouched).

## Verified mutable state
- Airlock HEAD eb42565; public chain 26f7b95, 2ff3d8b, 13be9b3, eb42565 present.
- Oracle gate GREEN: `bun run new-sdlc:oracle` -> control green; 36/36 mutations red.
- SEAL.v1..v4 present; SEAL.v5 NOT yet sealed; 001 finalize.ts NOT yet implemented.
- "Active" handoff run ter_20260711205422580_8n9a51: on-disk running/ok:true BUT
  terrarium_status reports ORPHANED/ok:false (stale log, no live child). It is a
  dev-oracle-hardening metered worker, NOT baseline 6. Treated as terminal/orphaned.
- Five single-agent baselines remain non-qualifying and stay in the denominator:
  qi3ru8 (wrong provider), mnsnzz + 98cpx9 (stream incomplete), wefbw9 (over budget /
  Infinity), aomkje (.terrarium-workspace digest contamination).

## Locks honored
- Eight-agent tier + X launch LOCKED. No fleet, no prod traffic, no X, no exposing
  prior candidate patches to a new baseline, no discounting failures.

## Remaining sequence (handoff)
1 exact sealed oracle checks; 2 receipt/usage run-ID binding; 3 evidence-manifest proof
binding; 4 response-body source marker; 5 exact preview hostname; 6 byte-safe artifacts;
7 bind pi-meter to injected TERRARIUM_RUN_ID; 8 implement+test 001 finalize.ts;
9 seal SEAL.v5; 10 baseline attempt 6 (only after clean detached replay, budget, proof,
preview, independent review all pass).

## This tick
Item 2 (+7): bind worker usage artifact CONTENT runId -> worker.terminal bound runId.
Add oracle check + one permanent mutation; keep control green.
