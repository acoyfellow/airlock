# Runtime preflight receipt — `ter_20260711152703907_9w64ia`

- Supervisor-recorded runner: `/Users/jcoeyman/.terrarium/bin/pi`
- Supervisor-recorded provider: `opencode.cloudflare.dev`
- Supervisor-recorded model: `gpt-5.6-terra`
- Isolation: read-only, no workspace writes
- Terminal state: `done`, exit `0`
- Task contract: verified
- Durable completion event: `evt_ter_20260711152703907_9w64ia_Completed`
- Task fingerprint: `f2d16cc9a35cb566b83752e3`

The child correctly observed that model identity was not available through its environment.
Model identity in experiment receipts must therefore come from the Terrarium supervisor's
sealed invocation, not child self-report.

## Reviewer finding

The early-completion mutation moved `run.completed` before both proof and preview. That
would not catch an oracle that enforces proof ordering but forgets preview ordering. Add an
independent mutation placing completion after proof but before preview and require it to
turn red.

No files were changed by the reviewer.
