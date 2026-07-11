# 000 loop

Read `.context/TERRALOOP.md` and `.context/BUILD-BACKWARDS.md`.

## Intake

- the frozen `ACCEPTANCE.md`;
- the deterministic fleet spike's honest limits;
- live Terrarium runtime-preflight receipts;
- all failed/malformed Terrarium outcomes as negative evidence.

## Loop

1. Construct the smallest valid hash-chained event stream.
2. Generate a receipt only from that stream.
3. Independently verify chain integrity, worker/commit/collision/check/candidate
   conservation, comparison fairness, completion time, proof binding, and claim text.
4. Apply every mutation in `ACCEPTANCE.md` one at a time.
5. Require the control to stay green and every mutation to turn red for its named reason.
6. Add reviewer counterexamples as permanent mutations.
7. Deposit the oracle as the hammer consumed by `001-single-agent`.

## Stop gate

- one command reproduces the control and mutation matrix;
- every acceptance mutation turns red;
- runtime preflight has a completed builder/critic pair with valid Terra task receipts;
- no assertion trusts child PASS text;
- receipt and raw events agree;
- independent critic has no open must-fix objection.

Do not start the eight-agent tier from this loop.
