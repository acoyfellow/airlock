# 001 — single-agent baseline

Status: **five measured runs are non-qualifying; no reproducible admitted candidate exists**.

This checkpoint measures the strongest fair serial path before introducing a fleet. One
Terra worker receives one sealed idea and works in one isolated worktree. Deterministic
supervisor code owns timing, conservation, integration, checking, proof, and preview
verification.

## Metered worker invocation

`pi-meter.mjs` is supervisor-only measurement code. Every invocation requires the
Terrarium-injected `TERRARIUM_RUN_ID`; it is the sole authority for the usage record's
`runId`. `--run-id` is optional only as an exact-equality assertion against that injected
value, and a missing or conflicting injected/CLI id is refused before Pi starts. A measured
invocation also requires an absolute `--usage-output` path outside the candidate working
directory, in a non-group/world-writable supervisor directory. The meter creates that path
once with exclusive, no-follow semantics and writes the canonical raw JSON usage record only
there; existing paths and symlinks are refused. The record records its injected-ID authority,
sealed provider/model identity, every attempt and continuation, validated finite usage totals,
budget verdict, terminal status, and timestamps. Child prose and stdout do not establish
authority (an explicitly conflicting child run id is a refusal).

Use `--preflight` under the injected Terrarium authority with the sealed provider/model and
budget flags to validate meter configuration without starting Pi or writing a usage record.
It intentionally cannot be combined with `--run-id` or `--usage-output`.

## Why this comes before eight agents

A fleet speedup has no meaning without a reproducible serial denominator. The future
`1 → 8` comparison inherits this experiment's idea digest, acceptance digest, initial
commit, model, tools, budget accounting, timer boundaries, and release boundary.

## First measured result

Run `ter_20260711165723012_qi3ru8` launched one process from the sealed starting commit and
failed in 2.655 seconds with zero model tokens. The wrapper pinned `gpt-5.6-terra` but not
its provider, so Pi selected `azure-openai-responses` instead of the intended
`opencode.cloudflare.dev` provider and found no credential.

This is a failed baseline, not a retryable setup anecdote: it remains in the denominator,
produced no candidate, and cannot unlock the eight-agent tier. The counterexample also
showed that experiment 000's comparison identity was incomplete. Mutation 20 now requires
provider and model identity to match both the seal and every worker receipt.

A second independent run, `ter_20260711171312620_mnsnzz`, correctly resolved the sealed
provider/model tuple and consumed 277,298 tokens ($0.305778625) over 86.008 seconds. The
provider stream ended before a terminal response after writing two uncommitted files.
Terrarium refused the clean process exit because the task contract was missing. The patch
is retained as rejected partial evidence; it is not a candidate commit and does not unlock
the eight-agent tier.

A third independent run, `ter_20260711171514429_98cpx9`, reproduced the provider-stream
failure during a write tool call after 90.306 seconds, 311,803 tokens, and $0.29883425.
It produced neither a completed file nor a commit. Repeated independent failures make
provider-stream recovery a stop blocker; the loop will not burn further full baseline
runs until a bounded, metered continuation mechanism is sealed and preflighted.

A fourth run, `ter_20260711171916058_wefbw9`, completed without continuation and produced
commit `aa2c7bd`. Independent checks passed: frozen acceptance 6/6, repository tests
37/37, and the site build. It nevertheless consumed 1,712,985 tokens, exceeding the
sealed one-million-token ceiling. The commit is dispositioned `rejected-budget-exceeded`;
no proof or preview was admitted. This exposed missing budget enforcement in experiment
000 and became mutation 21.

A fifth run, `ter_20260711173722542_aomkje`, produced commit `5d3fa1b` within its
resource budget. Independent acceptance 6/6, repository tests 38/38, site build, preview
HTTP, and cryptographic admission passed. Clean replay then found the proof was bound to
`sha256:8e4a…`, whose source set included the untracked `.terrarium-workspace` marker. A
clean worktree of the exact same commit produced `sha256:1b7951…`. The run is therefore
`rejected-clean-replay-digest-mismatch`, despite its working preview and valid signature.
This became mutation 25: a qualifying candidate now requires a clean-checkout replay event
whose digest exactly matches the integrated candidate and proof.

The eight-agent tier remains locked.
