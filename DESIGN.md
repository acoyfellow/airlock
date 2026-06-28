# Design

new-sdlc is one idea: a candidate is admitted by a signed proof, not by a passing
test. Everything else follows from keeping that decision honest.

## The candidate -> proof -> promote model

A delivery has three moments, and new-sdlc keeps them distinct.

1. **Candidate.** A push names a candidate by content — a digest. The candidate
   is deployed to a slot that serves no traffic. Nothing is live yet. Deploying
   is not promoting.
2. **Proof.** Tests fan out in parallel against the deployed candidate. The
   verifier signs what the fanout observed, bound to the exact candidate digest.
   That signed proof — not the raw test results — is the unit of trust.
3. **Promote.** keel checks the proof against the trusted keyring for that exact
   candidate. Only an admitted proof flips the feature gate on. A refused proof
   leaves the running version in place.

The load-bearing detail is content addressing. The deploy, the proof, and the
promote all name the same bytes. A proof for one candidate cannot promote a
different one, because keel binds admission to the digest.

## Why orchestration is pure and the ports are injected

`runPipeline` has no side effects of its own. It calls `deploy`, `runFanout`,
`sign`, and `setFeatureGate` through the `Ports` it is handed, and it reads
admission from keel. That buys three things:

- **Testable.** The pipeline tests inject in-memory ports and assert the whole
  decision: green promotes, red is refused, a thrown test is a failure not a
  crash, and fanout actually runs in parallel. No network, no real deploy.
- **Backend-agnostic.** The fanout^x backend is just the `runFanout` port.
  Terrarium child runs, Cloudflare Workflows or DO Facets, or a local
  `Promise.all` all satisfy the same type. Swapping one never edits the
  orchestration.
- **Authority stays at the edges.** The orchestration holds no credential and
  makes no trust decision. The signing key lives behind `sign`; the promote
  capability lives behind `setFeatureGate`; admission lives in keel. The pure
  core only sequences them.

## Separation of produce vs admit

new-sdlc *produces*: it deploys a candidate, runs fanout, and assembles evidence.
keel *admits*: it verifies a signed, artifact-bound proof against a trusted
keyring and returns a yes or no. new-sdlc never grades its own work.

This is deliberate. If the same component both ran the tests and decided whether
the result was good enough, a bug or a compromise in that component could promote
a bad candidate by simply declaring success. Splitting produce from admit means
the promote step depends on a signature keel can check, from a key the owner
trusts, bound to the candidate that was actually tested. A passing test with no
valid proof for that digest does not promote.

new-sdlc keeps the produce side; keel keeps the admit side. The feature gate is
the only place the two meet, and it only turns on when keel says so.

## Ports

| Port | Type | Pure-core guarantee |
|---|---|---|
| `runFanout` | `(jobs) => Promise<TestResult[]>` | The only place tests run. |
| `deploy` | `(candidate) => Promise<void>` | The only place a candidate lands on a slot. |
| `setFeatureGate` | `(candidate, on) => Promise<void>` | The only promote effect. |
| `sign` | `(candidate, evidence, pass) => SignedProof` | The only place the verifier key is used. |
| `trusted` | `TrustedKeys` | The keyring keel checks admission against. |

If a future need cannot be expressed as a port, that is a signal to question it
before adding surface to the core.

## Boundaries

- new-sdlc does not deploy, sign, or promote on its own; every effect is a port.
- new-sdlc does not decide trust; keel admits or refuses the signed proof.
- new-sdlc does not promote a candidate without an admitted proof bound to that
  exact digest.
- The default `localFanout` is a reference backend. A real terrarium, Workflow,
  or Facet backend is the integrator's port.
