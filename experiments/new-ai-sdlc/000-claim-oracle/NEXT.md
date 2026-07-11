# Next intake

Do not start the eight-agent tier.

## Remaining 000 stop gates

1. Preserve the observed 15-second startup-watchdog failures as machine-readable challenge fixtures.
2. Land a clean, public Terrarium startup-watchdog fix; the local wrapper is only a hotfix.
3. Re-run the complete Airlock check and fresh-clone oracle after experiment 000 lands.

Completed intake:

- two live `gpt-5.6-terra` reviewers returned valid task receipts and durable callbacks;
- the second reviewer added an independent completion-after-proof/before-preview mutation;
- model identity is taken from the supervisor's sealed invocation, not child self-report;
- seven focused Terrarium runtime tests passed for cancel, timeout, orphan/crash recovery,
  finish-before-subscribe, launcher exit, single callback, and callback linkage.

## Hammer produced

`oracle.ts` plus `verify.ts` is the first load-bearing hammer. Experiment 001 must use it
to refuse unfair baseline/fleet comparisons and event-derived receipt drift.
