# fleet protocol spike

This is the logical home for airlock's multi-agent collision work. `examples/`
contains small runnable spikes that teach the API. `experiments/` contains
falsifiable claims with receipts. A fleet coordinating commits, reconciling
collisions, and producing one gated candidate is a system claim, so it belongs
here rather than in `examples/`.

## Run it

```sh
bun run fleet
bun run fleet:verify
```

The run creates a temporary git repository under `.data/fleet-run/`, gives five
independent OS processes five worktrees at the same base commit, and makes each
process produce a real commit.

The tasks deliberately produce:

- an independent docs change;
- two compatible changes to different keys in the same one-line JSON file;
- a real textual conflict when those two commits are naively cherry-picked;
- two incompatible requirements for the same timeout behavior.

The coordinator reads the task contracts rather than choosing a patch by arrival
order. Compatible contracts become one new candidate. Both incompatible timeout
requests are recorded as blocked, and the base timeout stays unchanged. The
combined candidate then goes through `runPipeline`: checks run, the result is
signed, the proof is verified, and only then is the local served pointer moved.

`RECEIPT.json` preserves the base, process IDs, commits, parent commits, patches,
collision, accepted and blocked contracts, final candidate, check results,
signed proof, trusted public key, and explicit limits. `verify.ts` rechecks the
receipt without trusting the run's PASS line.

## What this proves

- Independent processes can produce stale-by-construction commits from one base.
- A naive merge can collide even when the underlying requirements are compatible.
- Declared compatible contracts can be retained in one candidate.
- Declared incompatible contracts can stop explicitly instead of silently
  dropping one agent's intent.
- The resulting candidate can be bound to independently verifiable test evidence.

## What this does not prove

This first checkpoint uses deterministic worker scripts, not autonomous model
agents. Reconciliation understands declared key/value contracts, not arbitrary
program semantics. The preview is local and file-backed. It does not establish
that tests capture product intent, that arbitrary source conflicts can be solved,
or that a fleet-built application is safe for production.

See [`LOOP.md`](./LOOP.md) for the backward checkpoints and stop gate.
