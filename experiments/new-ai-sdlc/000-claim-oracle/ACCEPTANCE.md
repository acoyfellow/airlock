# Acceptance contract

The initial contract was frozen before implementation. Reviewer counterexamples append
new mutations; existing conditions are never weakened or removed.

The verifier must accept a complete synthetic control ledger and reject each independent
mutation for the named reason:

1. event deletion or reorder breaks the hash chain;
2. advertised worker count differs from qualifying worker receipts;
3. deterministic script is counted as a model worker;
4. duplicate worker receipt is counted twice;
5. failed or timed-out worker is omitted from conservation;
6. failed or timed-out worker is counted as a qualifying worker;
7. baseline and fleet acceptance contracts differ;
8. baseline and fleet initial commits differ;
9. hidden human product write appears during the measured run;
10. produced commit has no final disposition;
11. accepted behavior is absent from the integrated candidate;
12. collision has no explicit resolution;
13. final proof names a different source-tree digest;
14. no verified preview completion event exists;
15. elapsed time stops before proof verification;
16. elapsed time stops after proof but before preview verification;
17. retry time or compute is omitted from totals;
18. receipt claim differs from values derived from events;
19. an unknown event type is inserted into an otherwise valid chain;
20. a worker uses a different provider under the same model name;
21. a run exceeds its sealed token or cost budget while otherwise looking successful;
22. a non-finite sealed budget or accounting value bypasses numeric comparisons;
23. an unsafe integer is accepted as the advertised worker count;
24. negative or non-monotonic event time makes negative elapsed time appear complete.

Additional gates:

- `RECEIPT.json` is generated from the event stream, never hand-authored.
- Unknown event types or dispositions fail closed.
- Every failed mutation becomes a permanent fixture.
- Full Airlock checks continue to pass.
