# Security

new-sdlc is an orchestration primitive. it does not deploy, hold secrets, or
contact any provider on its own. every effect is an injected port, and the
promote decision rests on a signed, artifact-bound proof that keel admits.

## reporting

open a private advisory or email the maintainer. do not file public issues for
vulnerabilities.

## boundaries and known limits

- a candidate is never promoted without a signed proof that keel admits for the
  exact candidate digest. a passing fanout result alone does not promote.
- a proof for one candidate cannot promote a different candidate, because keel
  binds admission to the content digest.
- new-sdlc makes no trust decision itself; it delegates admission to keel and
  the owner's trusted keyring. trust rests on the verifier signing key, the
  trusted keyring, and the promote capability behind `setFeatureGate`.
- the signing key is used only inside the `sign` port, and the promote effect
  only inside `setFeatureGate`. the pure orchestration holds no credential.
- the default `localFanout` runs test jobs in-process. a hostile test job runs
  with the privileges of the process. a real backend (terrarium child runs,
  Cloudflare Workflows or Facets) is the integrator's port and the place to
  isolate untrusted jobs.
- a compromised owner root, or a verifier key trusted and active at signing
  time, can sign a proof for a bad candidate. new-sdlc narrows where authority is
  exercised; it does not eliminate the owner root.
