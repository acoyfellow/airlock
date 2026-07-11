# Prospective finalizer design — `ter_20260711204604077_q14kpi`

Status: verified task contract; design evidence, not a measured baseline.

The review defined the minimum pre-run-sealed finalizer:

- immutable commit-tree source identity and detached clean replay;
- supervisor-owned Terrarium receipt and usage artifacts;
- exact sealed check argv and content-addressed transcripts;
- pre-sealed verifier `2c0ef5ed13765683`, with no fallback key generation;
- generated, digest-excluded preview marker;
- preview-only deploy with strict expected hostname and Wrangler version;
- fetched response bytes proving the exact source marker;
- cryptographically verified proof and request-only production effect;
- generated events and verification context, with no hand-recorded measurements.

The review also identified required oracle follow-ups: byte-safe artifact resolution,
exact declared-check conservation, receipt/usage run-ID binding, proof evidence-manifest
binding, and response-body marker verification.

Usage: 411,615 tokens, $0.540573875; provider/model identity confirmed as
`opencode.cloudflare.dev/gpt-5.6-terra`.
