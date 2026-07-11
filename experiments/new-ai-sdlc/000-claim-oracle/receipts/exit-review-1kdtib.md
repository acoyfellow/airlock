# Exit review — `ter_20260711153520106_1kdtib`

- Supervisor-recorded model: `gpt-5.6-terra`
- Terminal state: `done`, exit `0`
- Task contract: verified
- Durable completion event: `evt_ter_20260711153520106_1kdtib_Completed`
- Verdict: **must-fix**

The reviewer injected and resealed an event with type `unknown.event`.
`verifyComparisonReceipt` accepted it even though `ACCEPTANCE.md` requires unknown event
types to fail closed. Add runtime event-type validation and preserve the counterexample as
a permanent mutation.

The reviewer independently confirmed that completion after proof but before preview is now
rejected.
