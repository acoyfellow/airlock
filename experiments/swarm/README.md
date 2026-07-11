# swarm

Does the "concurrent candidates" story actually hold when a real swarm of
agents pushes at once? Round 1 of the docs red-team loop shipped a guess
about this (later found wrong in round 2 — see git history of
`site/src/routes/docs/+page.svelte`). This experiment replaces the guess with
a real, repeatable, adversarial test.

## What's real here

- `registry-worker/` is a real, deployed Cloudflare Worker + Durable Object
  (`https://airlock-swarm.coey.dev`). `/admit` does a real
  compare-and-swap inside `state.storage.transaction`, relying on the
  Cloudflare runtime's guarantee that one DO instance processes one request
  at a time — not a lock this repo implements itself.
- `agent.ts` is one swarm agent's real work: it produces a genuinely unique
  content-addressed candidate, signs a real ed25519 proof with keel, verifies
  it, then races to `/admit`.
- `run.ts` spawns N agents as N **separate OS processes**
  (`node:child_process.spawn`, not `Promise.all` over in-process functions),
  all launched in the same tick, all hitting the same live network endpoint
  at close to the same instant.

## Reproduce it yourself

```sh
bun run experiments/swarm/run.ts 25
```

Any N works. This calls the live registry Worker over the network — not
mocked, not simulated. Prints per-agent outcomes and writes
`RECEIPT.json`, overwriting the committed one.

## What it found (see RECEIPT.json for the exact run)

Two independent runs, 12 and 25 real concurrent agents:

| agents | admitted | refused | wall clock | double-admits |
| ------ | -------- | ------- | ---------- | -------------- |
| 12     | 1        | 11      | 933ms      | 0              |
| 25     | 1        | 24      | 962ms      | 0              |

In both runs, exactly one agent won and every other agent was refused with
`stale-version`, not silently overwritten — the registry's own admit log
(not any agent's self-report) confirms no two agents were ever admitted to
the same version. Wall clock barely changed from 12 to 25 agents, because
Cloudflare's per-DO-instance serialization is the actual bottleneck, not
this script.

## Limits of this proof

- One shared DO instance is a single point of serialization by design (that
  is what makes the CAS real and cheap). It also means throughput for ONE
  app's promotion decisions is bounded by one DO instance's request rate,
  not by however many agents you spawn. This experiment does not test
  fan-out across many DIFFERENT apps/registries, only many agents racing for
  ONE app.
- Every agent here signs with the same shared trusted key (this repo's own
  dogfood bootstrap key) to isolate the concurrency question from the trust
  question. A hostile agent forging a bad proof is a different, already-
  covered case (see `src/ports/ports.test.ts` sign-port tests).
- This does not deploy N real preview Cloudflare Workers per run (that would
  cost real time/quota per agent for no additional signal on the CAS
  question). The candidate produced by each agent is real and unique
  content-addressed data; only the "deploy a preview Worker" step is skipped here
  because it's already covered by `examples/self-deliver` and
  `experiments/isolation-proof`.
