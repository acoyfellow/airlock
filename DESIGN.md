# Design

airlock makes a candidate version live only after a signed proof says its tests
passed, bound to that exact candidate. This page explains the flow and why the
side effects are ports.

## The flow

`runPipeline` in `src/pipeline.ts` runs four steps in order.

1. **Candidate.** A push names a candidate by its content digest. The candidate
   is deployed to a slot that serves no traffic. Deploying does not make it
   live.
2. **Tests.** The test jobs run in parallel against the deployed candidate. The
   results join into an evidence string, `name=pass|fail` across every job.
3. **Proof.** The signer signs the result, bound to the candidate digest. The
   pipeline then verifies that signed proof against the trusted keys. The
   verification is the keel library airlock imports.
4. **Promote.** If the proof verifies, the feature gate flips the live pointer
   to the candidate. If it does not, the pointer stays where it is.

Content addressing carries the binding. The deploy, the proof, and the promote
all name the same bytes, so a proof whose digest does not match the candidate
being promoted is rejected. A proof for one candidate cannot promote another.

## Why the orchestration is a pure function

`runPipeline` has no side effects of its own. It calls `deploy`, `runFanout`,
`sign`, and `setFeatureGate` through the `Ports` it is handed, and it verifies
the proof.

This keeps the decision testable. The pipeline tests inject in-memory ports and
assert the whole path. `src/pipeline.test.ts` checks that a passing candidate
promotes, a failing one does not, a thrown test becomes a recorded failure
instead of a crash, and the test jobs run in parallel (the fast job finishes
before the slow one). No network, no real deploy.

It also keeps the credentials at the edges. The orchestration holds no key. The
signing key lives behind `sign`. The promote effect lives behind
`setFeatureGate`. The pure core only sequences them, which is why swapping a
fanout backend does not change the orchestration:

```text
runFanout: (jobs, slot) => Promise<TestResult[]>
  local      -> Promise.all (localFanout)
  terrarium  -> one bounded child agent run per job
  cloudflare -> one Workflow step or DO Facet per job
```

## Who signs and who checks

airlock assembles the candidate, runs the tests, and signs the result. The
proof is then checked against the trusted keys. The signing step and the
checking step are separate. If one component both ran the tests and decided
whether the result was good enough, a bug in it could promote a bad candidate by
declaring success. Splitting them means the promote step depends on a signature
that can be checked against a key the owner trusts, bound to the candidate that
was tested.

## Ports

| Port | Type | What the core delegates |
|---|---|---|
| `runFanout` | `(jobs, slot) => Promise<TestResult[]>` | The only place tests run. |
| `deploy` | `(candidate) => Promise<DeploySlot>` | The only place a candidate lands on a slot; returns the URL it answers on. |
| `setFeatureGate` | `(candidate, on) => Promise<void>` | The only promote effect. |
| `sign` | `(candidate, evidence, pass) => SignedProof` | The only place the signing key is used. |
| `trusted` | `TrustedKeys` | The keys a proof is checked against. |

## What the napkin run shows

What the napkin run shows directly: `B`'s integration job returned `ok: false`,
the proof recorded `integration=fail`, the proof was not admitted, the gate was
left off, and the served digest before and after `B` is identical.

What that supports: making promotion depend on a verified proof bound to the
candidate digest keeps a self-deploying candidate from reaching traffic when its
own test fails. The evidence is one run on a file-backed backend, with the
signing key trusted at signing time.

What it does not show: that a real terrarium or Cloudflare backend behaves the
same under concurrency, network failure, or an untrusted job. Those are the
integrator's ports.

## The honesty gate

`src/ports/` holds real implementations: a Cloudflare `deploy` to a non-serving
`*.workers.dev` slot named for the candidate digest, a `runFanout` where each
route check runs against the deployed slot, a `sign` whose key is loaded from
the environment, and a `setFeatureGate` that is human-gated for prod (it records
a promotion request and never flips the `airlock.coey.dev` route).

A worker's self-report is not the evidence. `experiments/dogfood/gate.mjs`
decides by looking: it recomputes the candidate digest from source, curls the
preview URL for `200`, reads the digest the served page carries, and re-verifies
the ed25519 signed proof against that recomputed digest. A claim that cannot be
re-derived from the artifact is marked failed.

## Limits

- airlock does not deploy, sign, or decide which keys to trust on its own.
  Every effect is a port.
- airlock does not promote a candidate without a verified proof bound to that
  exact digest.
- `localFanout` runs the test jobs in-process. A real terrarium, Workflow, or
  Facet backend is the integrator's port and the place to isolate untrusted
  work.
