# Airlock + Keel launch proof

One command produces one receipt for the exact mechanisms named in the Airlock
and Keel launch posts. It imports the pinned `keel` package used by Airlock; it
does not copy Keel's keyring or promotion logic.

## Run from a fresh clone

```sh
git clone https://github.com/acoyfellow/airlock.git
cd airlock
bun install
bun run launch-proof
bun run launch-proof:verify
```

`launch-proof` writes machine-readable [`RECEIPT.json`](./RECEIPT.json) and a
human-readable [`RECEIPT.md`](./RECEIPT.md). The verifier reads both and
independently reconstructs the proof, revocation, and compare-and-swap decisions.

## One success, three refusals

| Case | Real code exercised | Required result |
|---|---|---|
| Passing candidate | Airlock `runPipeline` + Keel signed-proof verification | checks pass, proof verifies, caller selects candidate |
| Failed check | Airlock `runPipeline` + Keel signed-proof verification | proof records failure, candidate refused, prior selection held |
| Revoked key | Keel `Keyring.verifyActive` with a cryptographically valid Ed25519 signature | key refused because it is revoked |
| Stale baseline | Keel `promote` + `RefStore` compare-and-swap with valid signed proofs | stale candidate refused, newer baseline held |

The receipt records Airlock's package dependency and the exact Keel commit pinned
in `bun.lock`. `verify.ts` imports those same public Keel APIs and fails if the
receipt's provenance differs from the fresh clone.

## What this proves

For these fixed, reproducible cases:

- The admitted Airlock proof is bound to the repository's computed source-tree
  digest.
- Airlock calls a caller-owned selection function only after its signed proof is
  admitted.
- A failing check leaves the previously selected candidate unchanged.
- A valid signature is insufficient after the signing key is revoked.
- A valid stale candidate cannot overwrite a baseline that already moved.

## Limits

- The preview in this experiment is file-backed and receives no live traffic. A
  separate dogfood receipt covers Airlock's real Cloudflare preview and manual
  promotion.
- The Airlock success candidate is the source-tree digest computed by
  `src/ports/digest.mjs`. The Keel compare-and-swap case uses deterministic
  synthetic candidate digests.
- The selected pointer is local demo state. Production promotion remains owned
  by the caller.
- This does not establish production readiness, universal test isolation, or
  agent safety at scale.

## Public evidence

- Airlock live dogfood and docs: <https://airlock.coey.dev>
- Airlock source: <https://github.com/acoyfellow/airlock>
- Keel source: <https://github.com/acoyfellow/keel>
