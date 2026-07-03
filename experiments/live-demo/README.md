# live-demo

A high-speed, real streaming demo: open a browser tab, run the real pipeline
from a terminal, and watch each real step land in the tab as it happens —
then watch the same tab's embedded "live app" flip to the new candidate the
instant a real promotion occurs. No canned transcript, no replay.

**Watch it:** https://airlock-live-demo.coy.workers.dev

## What's real here

- `broadcast-worker/` is a real, deployed Cloudflare Worker with two Durable
  Objects:
  - `Broadcast` — holds real WebSocket connections; `/emit` fans an event out
    to every connected browser the instant it's called.
  - `LivePointer` — the actual state a demo "live app" serves at
    `/live-app`. `/set` really changes what it returns.
- `run.ts` runs the REAL airlock pipeline — the same ports this repo ships
  elsewhere, not stand-ins — and POSTs each real step to `/emit` as it
  happens:
  1. a real content-addressed candidate (`digestBundle`)
  2. a real ed25519 signed proof (`keel`)
  3. a real fanout check against the real Durable Object checkrunner
     (`experiments/isolation-proof/worker`, isolated per check)
  4. a real compare-and-swap promotion against the real swarm registry
     (`experiments/swarm/registry-worker`)
  5. a real flip of `LivePointer`, which the open tab is already watching

## Reproduce it yourself

1. Open https://airlock-live-demo.coy.workers.dev in a browser.
2. In a terminal:
   ```sh
   bun run live-demo
   ```
3. Watch the page. Every line printed to your terminal also lands in the
   browser tab within the same network round trip, and the embedded "live
   app" iframe reloads the instant the real promotion happens.

Run the deliberate failure path to see a real refusal instead:

```sh
bun run live-demo -- --fail
```

This points the fanout check at `this-domain-does-not-resolve.invalid` (a
real DNS failure, not a fake `ok: false`), so the check genuinely fails, the
proof is genuinely marked `result: fail`, verification is genuinely refused,
and the live app is confirmed to stay exactly as it was.

## Verified runs

Confirmed by opening a real WebSocket listener and running the pipeline
against it (see git history / session log for the raw transcript): every
step — `start`, `candidate`, `sign`, `fanout`, `verify`, `promoted` —
arrived over the live socket in real time, in order, matching exactly what
the terminal printed. The failure path was independently verified: a real
unresolvable domain produced a real `530`, a real refused proof, and the
live app's served candidate was confirmed unchanged afterward.

## Limits of this proof

- One shared demo app (`LivePointer` under `idFromName("the-one-app")`) — 
  this is a single-viewer-experience demo, not a multi-tenant product. Two
  people running `bun run live-demo` at the same time will race each other
  on the SAME live app, which is itself a real (if small-scale) instance of
  the swarm behavior already measured in `experiments/swarm`.
- The fanout check kinds available are the same fixed set as
  `experiments/isolation-proof` (`http-200`, `read-do-storage`,
  `read-global-env`) — see that experiment's README for why arbitrary
  caller-supplied check code isn't possible on Workers today.
- `/emit` fires without retry; a dropped delivery does not fail the
  pipeline run (the real airlock decision doesn't depend on whether anyone
  was watching), so a flaky viewer connection can miss an event without the
  underlying promotion decision being affected.
