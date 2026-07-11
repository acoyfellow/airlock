# Next fleet checkpoint: quote Worker collision proof

This is the next loop's intake. It follows
`/Users/jcoeyman/cloudflare/.context/BUILD-BACKWARDS.md` and
`/Users/jcoeyman/cloudflare/.context/TERRALOOP.md`.

It is one falsifiable checkpoint, not a roadmap.

## Question

Can independent model agents make overlapping arbitrary-code changes to one real
deployable application while an outside verifier proves that compatible intent
survived, stale work did not overwrite accepted work, incompatible requirements
stopped explicitly, and a failure visible only on the deployed preview prevented
admission?

## Fixture fixed before builders run

A small Cloudflare Worker named `fleet-quote`:

- `GET /` serves an HTML quote form.
- `POST /api/quote` accepts integer `subtotalCents`, `country`, and optional
  `coupon`; it returns integer-cent subtotal, discount, tax, and total fields.
- `GET /health` returns the source candidate digest and release binding.
- Unit tests run with Bun.
- Preview checks call the deployed `*.workers.dev` URL.
- A demo `LivePointer` records the one admitted candidate. It is not production.

The base fixture, task specifications, oracle code, expected schemas, deployment
configuration, and their SHA-256 digests are committed before any builder starts.
Builders and reconcilers cannot modify them.

## Fleet shape

Eight real model-agent builders run in isolated Git worktrees. Every worktree
starts at the same recorded base commit. Builders receive only their assigned
specification and the base repository; they do not receive other builders'
patches. Each returns a commit, changed-file list, patch, tests it added, command
transcript, model identity, timing, and exit status.

A separate model-agent reconciler receives the base, immutable specifications,
all commits, and collision evidence. It must produce a new integration commit or
an explicit BLOCKED decision. It cannot alter task or oracle files. A separate
verifier—not a builder or reconciler—decides PASS.

The stale-case builder is started from the common base and deliberately withheld
until at least two other commits have been accepted. Its original test result is
never reused after replay/rebase.

## Exactly six pre-authored acceptance contracts

These six oracle contracts are hashed before builders run. Existing base tests
also run but do not count as one of the six.

### C1 — clean request identity

**Assigned builder:** add an opaque `requestId` to `/api/quote` responses and show
it in the HTML result without changing price calculations.

**Oracle:** two requests produce non-empty different IDs; all pre-existing price
fields and values remain byte-for-byte equivalent after removing `requestId`.

**Collision class:** clean independent change.

### C2 — compatible same-file pricing changes

**Assigned builders:** one adds percentage coupons; one adds a non-negative total
floor. Both must modify the same pricing function from the same base.

**Oracle:** independently checks percentage rounding, invalid coupon rejection,
zero floor, and a table of coupon-plus-floor cases. Both requirements must be
present in one integrated candidate.

**Required evidence:** naive cherry-pick must produce a real textual conflict in
the pricing source. A resolver that chooses one side fails C2.

**Collision class:** compatible textual collision.

### C3 — textually clean semantic interaction

**Assigned builder:** add country tax in a separate module so its commit merges
cleanly with both C2 commits. Tax is calculated on the post-discount, post-floor
amount using integer arithmetic.

**Oracle:** cross-product cases combine coupon, floor, and tax. Each individual
commit must pass its own task tests, while at least one naive combined ordering
must fail the immutable cross-contract oracle before reconciliation. The final
candidate must pass all cases.

**Collision class:** textually clean semantic collision.

### C4 — stale API/UI consumer

**Assigned builder:** from the original base, add an HTML breakdown that consumes
the quote response's integer-cent fields. Its commit is withheld until C1–C3 have
advanced the accepted head.

**Oracle:** records that the commit parent is the original base, refuses direct
compare-and-swap against the advanced head, then reruns the full UI/API contract
after replay or reconciliation. Reusing the stale green result fails C4.

**Collision class:** stale commit and changed dependency surface.

### C5 — impossible representation pair

**Assigned builders:** one immutable specification requires `totalCents` to remain
an integer JSON number; another requires the same field name to become a decimal
string. Both explicitly forbid an additional compatibility field.

**Oracle:** requires an explicit `BLOCKED_REQUIREMENTS` record naming both task
IDs and the contradiction. Neither commit may appear in the admitted candidate.
The base integer representation must remain. Picking an arrival-order winner,
renaming a field, or weakening either specification fails C5.

**Collision class:** genuinely incompatible requirements.

### C6 — deployed-preview identity failure

**Assigned builder:** add `releaseId` from a Worker environment binding to
`/health` and the response metadata. Its local tests use a valid mock binding.
The first preview deployment intentionally omits the binding.

**Oracle:** proves the builder's local checks passed, then requires the first real
preview check to fail because `releaseId` is missing. A correction may update
only application/deployment files, not this oracle. A second candidate must be
deployed at a new digest-derived preview URL and return both the expected
`releaseId` and candidate digest on `/health` and `/api/quote`.

**Collision class:** failure observable only in the deployed environment.

## Independent oracle and anti-cheating rules

1. Oracle files, task specs, base commit, and hashes are fixed before builder
   spawn and copied outside all writable worktrees.
2. Builders and reconciler have no credential that can update the oracle store,
   verifier receipt, trusted key, or demo live pointer.
3. Builder-written tests are evidence about effort, not admission evidence. Only
   the pre-authored oracle and unchanged base tests decide acceptance.
4. Every builder commit must have the recorded base as parent. Any undeclared
   shared branch, shared writable checkout, or patch exchange invalidates the run.
5. Full patches and process/model transcripts are preserved, including failures.
6. The coordinator records raw cherry-pick/rebase exit codes and conflicted file
   names. Labels such as "semantic conflict" are not accepted without a failing
   immutable cross-contract oracle.
7. Reconciliation always creates a third commit. No original builder may amend
   another builder's commit.
8. After every changed combination, checks rerun from scratch. No result follows
   a commit across a changed tree.
9. The preview URL is derived from the candidate digest and receives no live
   traffic. The verifier derives the expected hostname rather than trusting the
   receipt.
10. The signer and independent verifier use separate components. Verification
    uses a public key pinned before the run, not a key carried only by the receipt.
11. The verifier reconstructs the integration tree from recorded commits,
    recomputes its digest, curls the preview, and verifies the signed proof.
12. C5's blocked commits and C6's failed first preview remain in the receipt.
    Deleting failed attempts invalidates the run.

## Receipt schema

The machine-readable receipt must include:

- immutable base/spec/oracle hashes;
- model and command used for every builder and reconciler;
- process/run IDs, start/end times, worktree, parent, commit, patch, and exit;
- integration order and accepted-head value before each compare-and-swap;
- raw clean/conflict/stale outcomes from Git;
- all six oracle results for every candidate where they apply;
- explicit accepted, rejected, and blocked task IDs with reasons;
- reconciler input commits and resulting third commit;
- first failed preview URL/result and corrected preview URL/result;
- final reconstructed tree digest and deployed candidate digest;
- signed proof, pinned verifier ID, and independent verification decision;
- demo live pointer before/after;
- complete human interventions and total model/runtime cost where available;
- explicit limits and forbidden claims below.

## Binary PASS gate

PASS only if every statement is true:

- [ ] Eight real model-agent builders produced independently attributable runs.
- [ ] Every builder commit descends directly from the immutable common base.
- [ ] Oracle/spec/base hashes match their pre-spawn values after the run.
- [ ] C1 passes without changing pre-existing quote values.
- [ ] C2 records a real same-file Git conflict and retains both requirements.
- [ ] C3 records a clean textual merge, a failing naive cross-contract case, and
      a passing reconciled third commit.
- [ ] C4 records stale compare-and-swap refusal and fresh checks after replay.
- [ ] C5 explicitly blocks both impossible commits; neither reaches final tree.
- [ ] C6 records local green, first-preview red, and corrected-preview green at a
      new candidate digest and URL.
- [ ] Base tests and all applicable immutable oracle checks pass on final tree.
- [ ] No stale or rejected result is reused for another tree.
- [ ] Independent reconstruction produces the exact deployed candidate digest.
- [ ] Signed proof verifies against the pre-pinned public key.
- [ ] Demo live pointer moves exactly once, to that digest, only after verify.
- [ ] Receipt preserves every failed, blocked, and superseded attempt.
- [ ] Human intervention is zero or fully enumerated; no hidden manual code edit.
- [ ] `verify.ts` exits zero from a clean clone using only public receipt inputs
      and reachable preview endpoints.

Any unchecked item makes the checkpoint FAIL. A labeled partial run is retained
as exhaust but cannot support the checkpoint claim.

## Forbidden claims

Even on PASS, do not claim:

- autonomous agents can safely build arbitrary software;
- arbitrary semantic conflicts are solved;
- tests prove product intent or production safety;
- Durable Objects isolate arbitrary untrusted code;
- zero human work unless the receipt enumerates none;
- reproducibility across models or repeated runs from one run;
- production promotion; the pointer belongs only to the demo application;
- security audit, database-migration safety, or multi-repository coordination;
- "the new SDLC" as a proven universal result.

The allowed claim is narrower:

> In this fixed quote application and pre-authored contract set, independent
> model agents produced overlapping commits; compatible intent survived observed
> textual, semantic, and stale collisions; incompatible intent stopped; a real
> preview-only failure prevented admission; and only the independently verified
> combined candidate moved the demo pointer.

## Review-to-zero checklist

A critic must answer YES to every item before implementation begins. The parent
performed the required direct fallback review after both architect and critic
children failed twice at startup with zero output. All ten checks pass:

- [x] There is one fixture and one falsifiable question rather than a roadmap.
- [x] There are exactly six pre-authored contracts with executable outside
      oracles.
- [x] No builder or reconciler can modify task truth, oracle truth, trust roots,
      or the pointer.
- [x] Every collision label requires raw Git or oracle evidence.
- [x] Retained intent is judged by the union of independent contracts rather
      than builder-written tests.
- [x] Stale evidence is invalidated after every tree change.
- [x] Impossible requirements must stop explicitly instead of being reworded.
- [x] The preview must produce a real red result before the corrected green.
- [x] A clean-clone verifier must reconstruct the tree, digest, proof, and
      pointer decision without trusting coordinator prose.
- [x] Failures are preserved and unsupported claims are prohibited.

## Stop and next intake

This contract is the stop artifact for the acceptance-design loop. Do not begin
builders until review-to-zero is satisfied.

After a run, its complete receipt—not a success summary—is the next loop's
intake. The next question is chosen from observed exhaust: resolver failure,
oracle weakness, model disagreement, preview drift, or repeatability. It is not
preselected here.
