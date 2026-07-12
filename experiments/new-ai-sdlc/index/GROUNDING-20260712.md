# Orchestrator grounding — 2026-07-12

Loop file: experiments/new-ai-sdlc/TERRALOOP.md (canonical .context/TERRALOOP.md untouched).

## Verified mutable state
- Airlock control is descended from c1d64d4; public chain 26f7b95, 2ff3d8b, 13be9b3,
  eb42565, and c1d64d4 are present.
- Oracle gate GREEN: `bun run new-sdlc:oracle` -> control green; 39/39 mutations red.
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
1 exact sealed oracle checks; 3 evidence-manifest proof binding; 4 response-body source
marker; 5 exact preview hostname; 6 byte-safe artifacts; 8 implement+test 001 finalize.ts;
9 seal SEAL.v5; 10 baseline attempt 6 (only after clean detached replay, budget, proof,
preview, independent review all pass).

## This tick
Items 2 (+7) completed: worker usage artifact CONTENT is bound to injected
`TERRARIUM_RUN_ID`, worker-terminal accounting/identity, and derived run-completed totals.
`pi-meter` derives its record `runId` only from the injected value and refuses missing or
conflicting CLI ids. Mutation 39 keeps the contradictory-totals bypass red.
