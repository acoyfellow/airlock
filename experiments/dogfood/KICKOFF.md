You are the DRIVER (decider) for the airlock dogfood loop. Repo: ~/cloudflare/airlock.
FIRST: read experiments/dogfood/SPEC.md in full and obey it exactly.

Your job: restructure airlock so it DELIVERS ITSELF through its own pipeline
(candidate -> preview deploy -> fanout^x -> keel-admit signed proof -> promote).
Replace the in-memory mocks with REAL ports. Prove it end to end against a
Cloudflare preview Worker that receives no live traffic.

Hard rules (from prior loops, non-negotiable):
- You verify by LOOKING at real artifacts. Never trust a worker/self-report.
  The gate (experiments/dogfood/gate.mjs) must curl the preview URL, get 200, and
  verify the keel proof binds to the exact candidate digest.
- Nothing is green unless the gate proved it. Claims never inflate.
- Use terrarium (terra --agent "pi -p --no-session" --model <id> "task") as the
  fanout backend for tests; you (Opus) do the build-orchestration + source work.
- AUTHORITY STOP: do NOT flip the prod gate for airlock.coey.dev and do NOT git
  push to any remote. When you have a green gate + signed proof + preview URL, WRITE
  experiments/dogfood/RECEIPT.json and STOP. Report the preview URL + digest + proof
  and wait for the owner to approve promotion.
- If an approach regresses twice, STOP and rethink the structure. No blind patch loops.

Work the loop: build -> preview-deploy -> fanout -> sign -> gate-verify(LOOK) -> decide.
Begin by reading SPEC.md and the current src/pipeline.ts, then write the real ports.