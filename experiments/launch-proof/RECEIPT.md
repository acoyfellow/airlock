# Airlock + Keel launch-proof receipt

Pinned Keel commit: `7e187f4`

| Case | Decision | Evidence |
|---|---|---|
| Passing candidate | **ADMITTED** | `unit=pass,preview-smoke=pass`; selected `sha256:869a70ed923d2816a036c0523c4d8fa502390a3715f3b1eb65ebcbe52b0b34a4` |
| Failed Airlock check | **REFUSED** | `unit=pass,preview-smoke=fail`; prior selection remained `sha256:869a70ed923d2816a036c0523c4d8fa502390a3715f3b1eb65ebcbe52b0b34a4` |
| Valid signature, revoked key | **REFUSED** | cryptographic signature valid; Keel decision: `key revoked` |
| Valid stale candidate | **REFUSED** | `lease stale: baseline moved (compare-and-swap failed)`; newer baseline remained `sha256:9777d10b807f9697875a477d0494ffa0a376b7037e0dfa88a4740096cbe91cb8` |

Run `bun run launch-proof:verify` to independently check the JSON receipt.

## Limits

- The preview is file-backed and receives no live traffic; this run does not deploy to Cloudflare.
- The Airlock success candidate is the source-tree digest computed by src/ports/digest.mjs; the Keel compare-and-swap case uses deterministic synthetic candidate digests.
- The selected pointer is local demo state; production promotion remains caller-owned.
- This proves these fixed cases, not production readiness, universal test isolation, or agent safety at scale.
