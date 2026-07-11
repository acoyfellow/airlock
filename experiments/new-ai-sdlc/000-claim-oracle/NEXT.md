# Next intake

Experiment 000 is complete. Do not start the eight-agent tier.

## 001 is unlocked

Build the strongest frozen single-agent baseline against a sealed idea and acceptance
contract. The baseline must consume this oracle and produce the event schema that later
fleet tiers inherit without policy edits.

Completed intake:

- two live `gpt-5.6-terra` reviewers returned valid task receipts and durable callbacks;
- the second reviewer added an independent completion-after-proof/before-preview mutation;
- model identity is taken from the supervisor's sealed invocation, not child self-report;
- seven focused Terrarium runtime tests passed for cancel, timeout, orphan/crash recovery,
  finish-before-subscribe, launcher exit, single callback, and callback linkage;
- public Terrarium commit `befd22c` makes the startup watchdog configurable and defaults it
  to 60 seconds; 40/40 focused core tests passed;
- public Airlock commit `61fa039` reproduced from a fresh clone: its original 19/19
  mutations were red and the full Airlock check was green;
- experiment 001 exposed a provider/model alias collision, appended as mutation 20.

## Hammer produced

`oracle.ts` plus `verify.ts` is the first load-bearing hammer. Experiment 001 must use it
to refuse unfair baseline/fleet comparisons and event-derived receipt drift.
