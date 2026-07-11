# Acceptance contract

Freeze this contract and the held-out idea before the measured run starts. Later fleet
tiers may not weaken either.

## Fair comparison

- one starting commit and one target repository;
- one held-out `IDEA.md` and one acceptance contract, identified by SHA-256;
- `gpt-5.6-terra` for every model worker;
- the same child command, tools, network policy, global token/compute budget, and release
  boundary used by later tiers;
- no human product write between `run.started` and `preview.verified`;
- failures, timeouts, retries, and rejected commits remain in the denominator;
- elapsed wall time starts before the worker launch and stops only after independent proof
  and preview verification.

## Successful baseline

The run must produce all of the following from one real model process:

1. a supervisor-sealed worker invocation and durable terminal receipt;
2. a commit descended from the frozen starting commit;
3. an explicit disposition for every produced commit;
4. independently executed acceptance checks whose commands, exit codes, duration, and
   output digests are recorded;
5. an Airlock proof bound to the final source-tree digest;
6. a preview URL with no live traffic, verified after deployment;
7. one hash-chained event stream from which `RECEIPT.json` is derived;
8. complete wall-time, model-token/compute, retry, failure, human-intervention, and cost
   accounting;
9. `bun run new-sdlc:oracle` accepting the derived run without policy edits.

A worker's prose claim, clean process exit, commit existence, or deployed URL alone is not
success.

## Stop gate

Do not start the eight-agent tier until the baseline has been independently reproduced
from the frozen public starting commit and has no open must-fix review finding.
