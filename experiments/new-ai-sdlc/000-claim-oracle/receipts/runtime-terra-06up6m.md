# Runtime preflight receipt — `ter_20260711152522100_06up6m`

- Runner: `/Users/jcoeyman/.terrarium/bin/pi`
- Provider: `opencode.cloudflare.dev`
- Model: `gpt-5.6-terra`
- Isolation: read-only, no workspace writes
- Terminal state: `done`, exit `0`
- Task contract: verified
- Durable completion event: `evt_ter_20260711152522100_06up6m_Completed`
- Task fingerprint: `78d9d2012cc2e26386bde07d`

The runner emitted `terrarium-pi: runner started` immediately, so the prior 15-second
no-output watchdog did not kill the cold model start.

## Reviewer finding

The strongest remaining execution risk is durable terminal conservation: historical
orphaned runs, malformed callbacks, and terminal runs without durable callback events mean
global fleet counts cannot yet be trusted. Experiment 000 must either repair/quarantine
that history or prove an isolated run-scoped namespace whose spawned and terminal counts
conserve exactly.

No files were changed by the reviewer.
