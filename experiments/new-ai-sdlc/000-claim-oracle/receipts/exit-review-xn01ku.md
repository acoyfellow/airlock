# Numeric and clock review — `ter_20260711173115149_xn01ku`

Status: verified task contract; must-fixes integrated.

The reviewer found two remaining bypasses:

- `advertisedWorkers` accepted integers outside JavaScript's safe range and only failed
  indirectly through conservation;
- negative proof, preview, completion, and elapsed timestamps could form a resealed ledger
  accepted as complete.

Worker counts now require positive safe integers. Every event timestamp must be finite,
non-negative, and monotonic; completed elapsed time must also be non-negative. These are
permanent mutations 23 and 24.
