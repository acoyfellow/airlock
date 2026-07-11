# airlock

airlock is a small pipeline: you push a candidate version, it runs the tests,
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

## Setup

```sh
bun install
```

airlock checks its proof with **keel**, pulled in as a git dependency
(`keel: github:acoyfellow/keel`). keel is the proof-check building block; airlock
is the pipeline around it. Nothing else to clone.

## How to use it

```sh
bun install
bun test       # 30 pass: pipeline, napkin, ports, site copy
bun run napkin       # pushes two candidates through runPipeline
bun run launch-proof   # one success + three refusals across Airlock and real Keel APIs
bun run new-sdlc:oracle # control green; fake-fleet mutations must turn red
bun run fleet          # five worker commits, forced collision, reconcile/block, signed gate
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

## Repo map

Understand the whole thing from the layout, not by reading every line:

```text
src/
  pipeline.ts     the pure core: runPipeline(candidate, jobs, ports)
                  candidate -> deploy preview -> fanout tests -> proof -> promote|hold.
                  no side effects of its own; everything real is a port.
  ports/          the only place real things happen (inject these):
    deploy.ts       puts a candidate at a preview URL with no live traffic
    fanout.ts       runs the test jobs (local; terrarium / Workflow / Facet behind same type)
    sign.ts         signs the result, bound to the digest (the only key use)
    keys.ts         the trusted keys a proof is checked against
    gate.ts         the promote effect (flip the live pointer); human-gated for prod
    index.ts        assembles the ports
  serve.ts        the webapp: serves only the candidate the gate cleared.
                  feature = test + flag; a flag is on iff its test passed in the served candidate.
  artifacts.ts    content-addressed store: exact bytes by digest
  deploy.ts       preview deploy helper
  gate.ts         promote-gate wiring
  napkin.ts       the end-to-end demo, fully file-backed
examples/         hello-world, napkin, self-deliver (airlock shipping itself)
experiments/dogfood   the honesty gate: decides by LOOKING (re-derives digest, re-verifies proof)
experiments/fleet     multi-process commit/collision protocol spike with a verifiable receipt
experiments/launch-proof  one Airlock + Keel receipt for the launch claims
experiments/new-ai-sdlc   idea-to-verified-preview experiments, starting with the claim oracle
site/             the airlock.coey.dev site (light, AX-flavored)
```

keel (git dependency) is the proof-check primitive: `verifySignedProof`, `makeProof`,
`DecisionLog`. airlock is the pipeline that uses it.

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
   the keel library airlock imports.
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

## Reproduce the dogfood

`bun run napkin` is the local, file-backed demo. The real dogfood — airlock
delivering *itself* to a live (but non-serving) Cloudflare slot — is
`bun run self-deliver`, and `bun run gate` is the independent verifier.

```sh
# self-deliver deploys a preview Worker on a REAL Cloudflare account and fans tests
# out through a local terra CLI, so both must be set explicitly (no defaults):
export CLOUDFLARE_ACCOUNT_ID=<your account id>
export TERRA_CLI=/path/to/terrarium/src/cli.js
bun run self-deliver   # build -> preview deploy -> fanout -> sign -> RECEIPT.json

bun run gate           # independently verifies the preview Worker by LOOKING
```

`experiments/dogfood/gate.mjs` recomputes the source digest, refuses a dirty
worktree, derives the expected preview Worker URL from the digest, curls `/` and
`/docs` for 200 carrying that digest, and re-verifies the ed25519 proof against
the **pinned** public key in `experiments/dogfood/trusted-keys.json` (not the
keyring carried in the receipt). It exits non-zero on any red. The receipt it
checks is `experiments/dogfood/RECEIPT.json`.

On a corporate network the preview `*.workers.dev` URL is reached through the
Cloudflare WARP TLS proxy; the gate self-configures that CA (system store +
known WARP bundle) with TLS verification left on. Off-corp, that exact URL may
be unreachable — the local checks (digest recompute, proof verify against the
pin, receipt binding) still run.

## Limits

- airlock does not deploy, sign, or decide which keys to trust on its own.
  Every effect is a port the caller supplies.
- `localFanout` runs the test jobs in-process. Isolating untrusted jobs is the
  job of a different backend.
- The napkin is file-backed under `.data/`, not a real deployment.
  `airlock.coey.dev` is not pointed at a pipeline-promoted candidate; that flip
  is a human decision.
- The candidate digest is a content address of the **source** the build is
  produced from, not a hash of the deployed Worker bytes. See
  `experiments/dogfood/gate.mjs` for exactly what the gate does and does not
  prove.

See [DESIGN.md](./DESIGN.md) for the candidate, proof, and promote flow, and
[SECURITY.md](./SECURITY.md) for the trust model. MIT, version `0.0.1`.
