# new-sdlc

new-sdlc is a small pipeline: you push a candidate version, it runs the tests,
and it makes that version live only if the tests pass.

## What it is

A push names a candidate by its content digest. The pipeline deploys that
candidate to a slot that serves no traffic, runs the test jobs against it, and
checks a signed proof that the tests passed. If the proof checks out, it flips
the live pointer to that candidate. If a test fails, the live pointer does not
move and the previous version keeps serving.

The orchestration is one pure function, `runPipeline`, in `src/pipeline.ts`. It
does no deploying, signing, or promoting itself. The caller passes those in as
functions (the ports).

## How to use it

```sh
bun install
bun test       # 29 pass: pipeline, napkin, ports, site copy
bun run napkin # pushes two candidates through runPipeline
```

`bun run napkin` is file-backed under `.data/` and needs no Cloudflare account.
It pushes two candidates:

- Candidate `A` has all-passing tests, so it is promoted and the webapp serves
  `A`.
- Candidate `B` has a failing integration test, so it is blocked. The webapp
  keeps serving `A`.

The run prints a receipt for each candidate. `B`'s receipt:

```text
agent push B: bundle 'app@B — integration fails'
--- receipt: B ---
  evidence       unit=pass,lint=pass,integration=fail
  admitted       false
  promoted       false
  reason         verifier reported failure
  served before  sha256:39133bff70cf057dc4bd813d05697ac8cff6c40cb2a9ec6757a08d63ae749952
  served after   sha256:39133bff70cf057dc4bd813d05697ac8cff6c40cb2a9ec6757a08d63ae749952
  webapp serves  [200] sha256:39133bff70...: "app@A — all tests pass"

PASS: A served, B blocked, prior version held
```

It writes two signed decisions to an audit log under `.data/napkin-run/`:
`approve` for `A`, `deny` for `B`.

## How it's built

`runPipeline(event, jobs, ports)` runs these steps in order. Each step is in
`src/pipeline.ts`.

1. The candidate is named by its content digest. Two builds with the same bytes
   get the same name.
2. `deploy(candidate)` puts the candidate on a slot that serves no traffic and
   returns the URL that slot answers on.
3. `runFanout(jobs, slot)` runs the test jobs in parallel against that slot and
   collects the results. The evidence string is `name=pass|fail` joined across
   every job.
4. `sign(candidate, evidence, passed)` produces a signed proof that the tests
   passed, bound to that exact candidate digest. `verifySignedProof` then checks
   the signature and the digest binding against the trusted keys. That check is
   the keel library new-sdlc imports.
5. If the proof verifies, `setFeatureGate(candidate, true)` flips the live
   pointer to the candidate. If it does not, the pointer is left where it is.
6. The web handler serves whatever the live pointer names.

Content addressing holds this together: the deploy, the proof, and the promote
all name the same bytes, so a proof for one candidate cannot promote a different
one.

### Ports

Every effect with a side effect is a function the caller supplies. The core
calls these and nothing else.

| Port | Type | What it does |
|---|---|---|
| `runFanout` | `(jobs, slot) => Promise<TestResult[]>` | Runs the test jobs in parallel against the deployed slot and returns the results. |
| `deploy` | `(candidate) => Promise<DeploySlot>` | Puts the candidate on a slot that serves no traffic; returns the URL it answers on. |
| `setFeatureGate` | `(candidate, on) => Promise<void>` | Flips the live pointer. This is the only way a candidate goes live. |
| `sign` | `(candidate, evidence, pass) => SignedProof` | Signs the test result, bound to the candidate. |
| `trusted` | `TrustedKeys` | The set of keys a proof is checked against. |

The default `runFanout` is `localFanout`, a `Promise.all` that records a thrown
test as a failure instead of crashing the run. Other implementations of the
ports live in [`src/ports/`](./src/ports).

## Limits

- new-sdlc does not deploy, sign, or decide which keys to trust on its own.
  Every effect is a port the caller supplies.
- `localFanout` runs the test jobs in-process. Isolating untrusted jobs is the
  job of a different backend.
- The napkin is file-backed under `.data/`, not a real deployment.
  `new-sdlc.coey.dev` is not pointed at a pipeline-promoted candidate; that flip
  is a human decision.

See [DESIGN.md](./DESIGN.md) for the candidate, proof, and promote flow. MIT,
version `0.0.1`.
