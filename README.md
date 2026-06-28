# new-sdlc

new-sdlc is a small primitive for a different software delivery loop: an agent
pushes a candidate to a content-addressed artifacts repo; the push deploys that
candidate to a slot that serves no traffic; tests fan out in parallel; and the
feature gate is promoted **only** when keel admits a signed proof bound to the
exact candidate. A candidate that deploys but does not pass is never promoted.

The orchestration is a pure function. Deployment, fanout, promotion, and signing
are injected ports. new-sdlc runs no network call unless one of those ports makes
it. The decision to promote rests on the same thing keel guards: a signed,
artifact-bound proof, not a passing test on its own.

## The Pipeline

```text
agent -> artifacts repo --(on push)--> deploy -> fanout^x tests -> promote
```

`runPipeline(event, jobs, ports)` is the orchestration, and these are its exact
steps:

```text
push event (repo, candidate digest)
        │
        ▼
 1. deploy(candidate)            ->  to a slot that serves no traffic yet
        │
        ▼
 2. runFanout(jobs)              ->  fanout^x tests in parallel, joined to results
        │                            evidence = "name=pass,name=fail,..."
        ▼
 3. sign(candidate, evidence)    ->  the verifier signs what fanout observed,
        │                            bound to this exact candidate
        ▼
    keel: verifySignedProof(proof, candidate, trusted)
        │
   ┌────┴────────┐
   ▼             ▼
 admitted      refused
        │             │
        ▼             ▼
 4. setFeatureGate    setFeatureGate(candidate, false)
    (candidate, true)  gate stays off; the running version holds
```

Step for step, that is `src/pipeline.ts`:

1. `deploy(candidate)` puts the candidate on a non-serving slot.
2. `runFanout(jobs)` runs the test jobs in parallel and collects results; the
   evidence string is `name=pass|fail` joined across every job.
3. `sign(candidate, evidence, passed)` produces a signed proof; keel's
   `verifySignedProof` decides admission against the trusted keyring, bound to
   the candidate digest.
4. On admission, `setFeatureGate(candidate, true)` promotes. On refusal, the gate
   is left off and the receipt carries keel's reason.

## The Ports

Everything with a side effect is injected. The core never deploys, signs, or
promotes on its own.

| Port | Responsibility |
|---|---|
| `runFanout(jobs)` | Run the test jobs in parallel and return their results. The fanout^x backend. |
| `deploy(candidate)` | Put the candidate on a slot that serves no traffic. |
| `setFeatureGate(candidate, on)` | The single promote effect. Turning the gate on is the only way a candidate goes live. |
| `sign(candidate, evidence, pass)` | The verifier signs what fanout observed, bound to the candidate. Returns a keel `SignedProof`. |
| `trusted` | The keel `TrustedKeys` map. Admission is checked against it. |

The default `runFanout` is `localFanout`, a `Promise.all` that also turns a
thrown test into a recorded failure rather than a crash.

## fanout^x backends

`runFanout` is one type — `(jobs) => Promise<TestResult[]>` — so the same
pipeline runs against any backend that can join parallel results:

- **terrarium** — each test is a bounded child agent run, joined when they
  finish. This is the fanout^x case: a test can itself fan out.
- **cloudflare** — Workflow steps, or Durable Object Facets, one per test.
- **local** — `Promise.all`, which is `localFanout` and what the hello world
  uses.

Swapping backends never touches the orchestration; only the port changes.

## Quick Start

```sh
bun install
bun test       # run the pipeline tests
bun run hello  # run the hello-world: green promoted, red blocked, gate holds
```

`bun run hello` runs the pipeline twice. A green candidate is admitted by keel
and the gate is promoted; a candidate with one failing test is refused and the
gate stays off, so the live feature gate keeps the good candidate.

## How It Relates to keel and terrarium

- **keel** ([github.com/acoyfellow/keel](https://github.com/acoyfellow/keel)) is
  the gate. new-sdlc imports `makeProof`, `signProof`, `verifySignedProof`, and
  the `SignedProof` / `TrustedKeys` types from keel. keel decides whether a
  signed, artifact-bound proof admits a candidate; new-sdlc decides nothing about
  trust on its own. new-sdlc produces a candidate and the evidence; keel admits
  or refuses it. That separation — *produce* vs *admit* — is the point.
- **terrarium** is one fanout^x backend behind `runFanout`. When fanout runs on
  terrarium, each test is a bounded child run and a test may itself fan out into
  more child runs, which is why the step is written `fanout^x`.

new-sdlc depends on keel as a sibling path. It is not published to a registry. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the workspace assumption.

MIT, version `0.0.1`. An extracted primitive, kept small.
