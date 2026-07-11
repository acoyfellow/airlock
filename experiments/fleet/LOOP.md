# Fleet terraloop contract

Follow `/Users/jcoeyman/cloudflare/.context/TERRALOOP.md` and
`/Users/jcoeyman/cloudflare/.context/BUILD-BACKWARDS.md`.

## North Star

A skeptic can watch independent coding agents propose commits against one real
application, inspect every collision and reconciliation decision, independently
recompute the final candidate, and verify that no candidate reached live traffic
without a signed proof covering the union of accepted task contracts.

## Backward checkpoints

Work backward; do not turn these into a forward feature roadmap.

1. **Live fleet proof:** a non-trivial fleet-built application is deployed to a
   preview URL, independently verified, and promoted or refused by airlock. Real
   model agents, real commits, injected failures, public event stream.
2. **Arbitrary-code reconciliation proof:** clean, textual, semantic, stale, and
   impossible collisions are all observed in real repositories. Reconciliation
   proves retained intent with executable acceptance checks or blocks explicitly.
3. **Protocol spike (current):** independent worker processes make real commits
   from one base; a real textual collision is forced; compatible declared
   contracts are combined; incompatible contracts are blocked; the combined
   candidate passes a signed airlock gate.

The current checkpoint is intentionally smaller than the North Star. Its exhaust
(`RECEIPT.json`, preserved patches, collision records, and limits) is intake for
the next loop.

## Driver shape

- Spawn at least two adversarial children before expanding the checkpoint:
  one builder and one critic, or competing designs.
- Children receive one bounded objective and may not deploy.
- The parent verifies receipts itself with `bun run fleet:verify`.
- Failed runs and rejected contracts remain in the receipt; do not clean away
  evidence.
- A model-agent round must use Terrarium children in isolated worktrees. A child
  completion is only a claim until its commit, parent, patch, and acceptance
  checks are independently inspected.

## Current binary PASS gate

`bun run fleet` followed by `bun run fleet:verify` exits zero, and the receipt
proves all of the following:

- five distinct OS processes made five distinct commits from the same base;
- naive cherry-picking observed a real `app.json` conflict;
- the `banner`, `currency`, and `docs` contracts survived in one candidate;
- incompatible timeout contracts were both blocked with an explicit reason;
- blocked behavior retained the base value rather than choosing a winner;
- all combined checks passed;
- the signed proof independently verifies for the recomputed candidate digest;
- every limit remains present in the receipt.

## Stop gate

Stop this checkpoint when the binary PASS gate holds and adversarial review has
zero objections to what the receipt claims. Do not call it autonomous fleet
proof. The next loop begins only after its falsifiable question is sharpened
from this run's exhaust.
