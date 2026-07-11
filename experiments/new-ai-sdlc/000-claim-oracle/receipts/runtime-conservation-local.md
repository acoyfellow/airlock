# Runtime conservation receipt — local enabling check

This is local enabling evidence, not a public clean-checkout proof. The Terrarium working
tree contains unrelated prior work and remains uncommitted.

## Commands and observed results

```sh
node --test --test-name-pattern='real background cancel|orphan reconciliation|late concrete subscribe|seeded bounded permutations' test/run-machine.test.js
```

Observed: 4/4 passed.

- real background cancellation emitted exactly one terminal callback;
- orphan reconciliation emitted exactly one terminal callback;
- a terminal callback journaled before subscription replayed to a late subscriber;
- seeded cancel/completion permutations preserved one terminal state and one callback.

```sh
node --test --test-name-pattern='background runs finish after the launcher exits|background deadline timeout terminalizes and journals callback|terminal run envelope links to durable callback' test/basic.test.js
```

Observed: 3/3 passed.

- completion survived launcher exit;
- deadline timeout terminalized and journaled its callback;
- terminal run metadata linked to its durable callback event.

## Scope

These tests plus live Terra runs `ter_20260711152522100_06up6m` and
`ter_20260711152703907_9w64ia` establish a clean run-scoped path. They do not repair the
historical global Terrarium records reported by doctor and do not authorize using those
historical aggregates as fleet measurements.
