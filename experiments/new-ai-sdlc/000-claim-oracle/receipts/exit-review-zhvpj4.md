# Budget review — `ter_20260711172719518_zhvpj4`

Status: verified task contract; must-fix integrated.

The reviewer confirmed ordinary mutation 21 enforcement and independently reproduced a
bypass: `maxTokens: Infinity` passed positive-number validation and made every finite
usage appear in budget.

The fix requires safe positive integers for token ceilings/counts, finite positive cost
ceilings, and finite non-negative timing/cost accounting. The non-finite bypass is now
permanent mutation 22.
