# Airlock + Keel launch-proof loop

Follow `/Users/jcoeyman/cloudflare/.context/BUILD-BACKWARDS.md` and
`/Users/jcoeyman/cloudflare/.context/TERRALOOP.md`.

## North Star

The accepted two-post Airlock + Keel launch points at a public repository where
a skeptical Cloudflare/agent builder can run one command, inspect one receipt,
and independently verify the exact success and refusal mechanisms named in the
posts.

## Current checkpoint

Produce one public combined receipt using Airlock's real `runPipeline` and the
pinned `keel` dependency—no copied verification or promotion logic—with:

1. passing candidate admitted and selected by the caller;
2. failing Airlock check refused while the prior candidate stays selected;
3. cryptographically valid signature refused because its Keel key is revoked;
4. valid stale candidate refused by Keel compare-and-swap while the newer
   baseline survives.

## Binary stop gate

- `bun run launch-proof` exits zero and writes `RECEIPT.json`.
- `bun run launch-proof:verify` independently checks every proof, key decision,
  compare-and-swap result, retained prior candidate, and pinned Keel provenance.
- Full `bun run check` passes.
- README gives fresh-clone commands, exact claims, and explicit limits.
- No invented preview terminology, deployed-byte claim, universal isolation
  claim, automatic-production claim, or copied Keel logic.
- Changes are committed and pushed to public `main` with no secrets.
- A fresh clone of public `main` passes both launch-proof commands.
- Grok inspects the public URLs and returns no factual or must-fix objection.

## Driver rules

The driver verifies results itself. Existing Terrarium children failed twice at
startup, so this bounded loop runs directly rather than repeatedly spawning the
same broken child path. Push is authorized for fast feedback. Do not publish the
posts; public repo proof is the stop artifact.
