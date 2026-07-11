# 001 — single-agent baseline

Status: **first measured run failed before inference; no candidate or preview exists**.

This checkpoint measures the strongest fair serial path before introducing a fleet. One
Terra worker receives one sealed idea and works in one isolated worktree. Deterministic
supervisor code owns timing, conservation, integration, checking, proof, and preview
verification.

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
