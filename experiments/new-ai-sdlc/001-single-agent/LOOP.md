# 001 loop

Read `.context/TERRALOOP.md`, `.context/BUILD-BACKWARDS.md`, and experiment 000.

## Before measurement

1. Prepare the target repository and acceptance commands without seeing the held-out idea.
2. Record the clean starting commit and environment/tool versions.
3. Deposit `IDEA.md` once, then seal its digest with this contract and the starting commit.
4. Reject any post-seal policy, idea, acceptance, or baseline change.

## Measured path

1. Emit `run.started` before launching the worker.
2. Spawn exactly one real `gpt-5.6-terra` worker in an isolated worktree.
3. Give it the sealed idea, contract, repository, and full bounded objective.
4. Preserve every terminal outcome and retry. A retry is still serial baseline work.
5. Admit a commit only through compare-and-swap against the frozen baseline.
6. Execute acceptance checks independently of the worker.
7. Run Airlock against the admitted source-tree digest.
8. Deploy only to a preview URL with no live traffic and verify it.
9. Emit `run.completed` only after proof and preview verification.
10. Derive the receipt, run experiment 000's oracle, and request independent review.

## Authority boundaries

- the worker cannot edit the canonical integration worktree;
- the worker cannot author or weaken acceptance checks after sealing;
- the worker cannot mark its own receipt verified;
- the worker and Keel hold no production credentials;
- preview deployment and any later promotion remain caller-owned.

Do not start the eight-agent tier from this loop.
