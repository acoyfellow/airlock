# New AI SDLC experiment 000 — claim oracle

The first checkpoint is not a large fleet. It is proving that the measurement turns red
when a fleet run cheats, loses evidence, or stops the clock early.

```sh
bun run new-sdlc:oracle
```

The command builds two synthetic hash-chained event streams: a one-worker baseline and a
two-worker fleet control. It derives the comparison receipt from those streams, verifies
the control, then applies the frozen mutations in [`ACCEPTANCE.md`](./ACCEPTANCE.md). Reviewer
counterexamples append new mutations without weakening existing ones.
The command passes only when the control remains green and every mutation turns red for
its named reason.

Generated evidence:

- [`EVENTS.baseline.jsonl`](./EVENTS.baseline.jsonl)
- [`EVENTS.fleet.jsonl`](./EVENTS.fleet.jsonl)
- [`RECEIPT.json`](./RECEIPT.json)

## Current result

- control comparison: accepted;
- challenge mutations: 39/39 refused.
- Airlock TypeScript check: passed.

## Limits

This is a synthetic oracle test. It does not count as a model fleet, scaling result,
Cloudflare deployment, or proof that the mutation corpus is complete. Real Terrarium task
receipts are a separate runtime-preflight gate before experiment 001.
