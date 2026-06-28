# Contributing

new-sdlc is small on purpose. before adding surface, ask whether the work belongs
in an injected port rather than in the orchestration core.

- `bun install`, `bun test` must stay green and deterministic.
- TypeScript, ESM, strict.
- every behavioral claim needs a test; every fix needs a regression test.
- keep the orchestration pure. deploy, fanout, promote, and signing stay in the
  caller's ports, never in `runPipeline`.
- keep the trust decision in keel. new-sdlc produces a candidate and evidence;
  keel admits or refuses the signed proof.

## The keel dependency

new-sdlc depends on [keel](https://github.com/acoyfellow/keel) for the proof API:
`makeProof`, `signProof`, `verifySignedProof`, and the `SignedProof` /
`TrustedKeys` types. keel is not published to a registry, so new-sdlc imports it
by path as a **sibling checkout**:

```text
parent/
  keel/       <- github.com/acoyfellow/keel, checked out next to new-sdlc
  new-sdlc/   <- imports ../keel/src/index.ts
```

`src/pipeline.ts` and the examples import keel relative to their own location
(`../../keel/src/index.ts` from `src/`, `../../../keel/src/index.ts` from
`examples/`), each resolving to the sibling `keel/` checkout. To build or test
new-sdlc, clone keel next to it:

```sh
git clone https://github.com/acoyfellow/keel
git clone https://github.com/acoyfellow/new-sdlc
cd new-sdlc && bun install && bun test
```

This keeps keel the single source of the proof primitive instead of vendoring a
copy that can drift. If keel is later published to a registry, the path imports
become a normal dependency with no change to the orchestration.
