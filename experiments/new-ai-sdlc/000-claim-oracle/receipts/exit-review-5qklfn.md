# Oracle re-review — `ter_20260711204252555_5qklfn`

Status: ACCEPT; verified task contract.

The reviewer reproduced the prior bypass attempts and confirmed they are closed:

- ghost and mismatched artifact bytes are refused;
- jointly substituted source assertions are refused against external recomputation;
- signer substitution and a hash-addressed forged proof are refused;
- malformed candidates and missing preview URL/version are refused;
- Wrangler output without a version is refused;
- production-changing refusal effects fail closed.

Verification: oracle control green with 36/36 mutations red; focused pipeline tests 7/7.
Usage: 447,465 tokens, $0.370392375; provider/model identity confirmed as
`opencode.cloudflare.dev/gpt-5.6-terra`.
