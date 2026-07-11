# Oracle review — `ter_20260711175831124_x1q39h`

Status: verified task contract; must-fixes integrated.

The reviewer bypassed the event-only oracle with syntactically valid ghost artifact
digests, jointly substituted source assertions, and a signer changed in both mutable
events. It also showed that the core pipeline accepted malformed candidate/preview
identity and allowed a refusal port to report a production change.

The oracle now resolves every referenced artifact and recomputes its SHA-256, consumes
external independently recomputed source/replay and signer/effect inputs, and
cryptographically verifies the resolved proof. The pipeline now validates candidate,
preview URL, and deployment version, and throws if refusal changes production.
These are permanent mutations 32 through 36.

Usage: 499,171 tokens, $0.534497375; provider/model identity confirmed as
`opencode.cloudflare.dev/gpt-5.6-terra`.
