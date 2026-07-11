# Exit review — `ter_20260711170903499_8yppu2`

Status: verified task contract; must-fix integrated.

The reviewer confirmed that the oracle:

- seals provider and model in `run.sealed`;
- requires every terminal worker to match both values;
- compares provider/model identity between baseline and fleet;
- rejects a resealed same-model provider drift;
- keeps the failed baseline non-qualifying.

It ran the oracle in a temporary copy and observed control green with 20/20 mutations red.

Must-fix: `findings.json` still said 19 mutations. Corrected to 20 and recorded this
review.
