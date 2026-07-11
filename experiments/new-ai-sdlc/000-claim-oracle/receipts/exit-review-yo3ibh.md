# Baseline evidence review — `ter_20260711174838134_yo3ibh`

Status: verified task contract; must-fixes integrated.

The reviewer confirmed the implementation checks but refused the baseline claim because:

- ledger values were hard-coded after the run without content-addressed raw worker,
  provider, check, and deploy artifacts;
- the proof used a receipt-supplied key rather than a signer sealed before the run;
- the public preview exposed the old embedded digest, not the claimed candidate marker;
- `promoted: true` described only a caller-owned promotion request.

Together with the independently found clean-replay digest mismatch, the run remains
non-qualifying. These findings are permanent mutations 26 through 29.
