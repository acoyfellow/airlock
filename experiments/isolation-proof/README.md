# isolation-proof

Does the docs claim actually hold? `/docs` says:

> **Fanout backend**: napkin's localFanout runs every check in the orchestrator's
> own process — nothing is isolated yet. terrarium, a Workflow, or a Facet
> backend is where untrusted checks get quarantined.

That's a claim. This experiment tests it by running the same hostile intent —
"read whatever the orchestrator can see" — through both backends and recording
what actually happened, not what's supposed to happen.

## What's real here

- `worker/` is a real, deployed Cloudflare Worker + Durable Object
  (`https://airlock-checkrunner.coy.workers.dev`, account `Coeyman@gmail.com's
  Account`). Every check job gets a fresh `newUniqueId()` DO instance — a
  separate V8 isolate — never shared across jobs or calls.
- `src/ports/cloudflare-fanout.ts` is the real `RunFanout` port implementation
  that calls it over HTTP.
- `run.ts` plants a real secret in the orchestrator's own process
  (`process.env`, exactly where a real deploy/sign/promote credential would
  live), then runs the same "try to read it" intent through `localFanout` and
  through the Cloudflare DO backend.

## Reproduce it yourself

```sh
bun run isolation-proof
```

This calls the live Worker over the network — it is not mocked. Output prints
each finding and writes `RECEIPT.json` next to this file, overwriting the
committed one. Diff it against git to see if a run reproduced the same
verdict.

## What it found (see RECEIPT.json for the exact run)

- `local`: the hostile check reads `process.env.AIRLOCK_ORCHESTRATOR_SECRET`
  and gets the real secret back. Leaked, exactly as documented — this is not a
  surprise, it's confirmation the docs aren't overselling `local`'s safety.
- `cloudflare`: the equivalent check, run inside its own DO isolate, cannot see
  the orchestrator's secret, env, or bindings at all — it was never sent
  there. Contained.
- A second cloudflare check confirms two different jobs in the same fanout
  call get two different DO instances with independent storage — no
  cross-job leakage inside the "isolated" backend either.

## Limits of this proof

- This tests **one specific attack** (reading ambient process state) against
  **one specific real deployment**. It is not an exhaustive security audit of
  Durable Objects or of Cloudflare's isolate sandboxing.
- Cloudflare Workers disallow `new Function`/`eval` (confirmed by trying it —
  see git history of `worker/src/index.ts`), so "a check" in the cloudflare
  backend today is one of a small, fixed set of named check kinds the Worker
  ships (`http-200`, `read-do-storage`, `read-global-env`), not an arbitrary
  string a caller supplies. That is a real, narrower fanout than terrarium's
  free-form task or `local`'s arbitrary `run()` closure. Widening it to
  arbitrary user-supplied logic (e.g. via a real sandboxed sub-request or a
  Workers-for-Platforms dynamic dispatch) is follow-on work, not yet done.
- Network egress from inside a DO isolate is not blocked — a check can still
  `fetch()` anywhere. Isolation here means "cannot read the orchestrator's
  process/credentials/other jobs' state," not "has zero capabilities."
