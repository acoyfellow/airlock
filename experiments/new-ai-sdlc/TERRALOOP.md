# The New AI SDLC Terraloop

This loop is isolated to `experiments/new-ai-sdlc/`. It does not replace or modify the
canonical Terraloop example in `/Users/jcoeyman/cloudflare/.context/TERRALOOP.md`.

It is the experimental contract for turning one idea into verified, running software
through recursive parallel work. It follows the workspace's `.context/JORDAN.md` and
`.context/BUILD-BACKWARDS.md`. This file is liquid: rewrite it when this experiment
disproves its assumptions.

## The claim under test

Software work no longer has a clean input phase and output phase. An idea enters a shared
repository; plans, commits, tests, failures, collisions, previews, and release decisions
become events in one continuous system. Every useful commit is both the output of one
agent and possible input to the next agents.

The repo is not a destination for finished work. It is the fleet's shared memory,
coordination surface, content-addressed state, and replay log.

The proposed system is:

```text
idea + acceptance contract
  -> recursive Terrarium fan-out
  -> many isolated agents committing into one Git object graph
  -> continuous collision detection and evidence-producing checks
  -> agents spawning from new repo state
  -> explicit reconciliation or blocking
  -> candidate at a preview URL with no live traffic
  -> signed proof bound to the source-tree digest
  -> caller-owned promotion
```

Terrarium is the execution fabric. Git is the shared state graph. Airlock runs the
candidate/check/proof loop. Keel makes narrow allow/refuse decisions. None of those
primitives alone is the product. The product under test is the loop from idea to verified
preview.

## North Star

A previously unseen `IDEA.md` and frozen `ACCEPTANCE.md` enter an unchanged public
harness. Without human implementation, the harness produces a correct application at a
preview URL with no live traffic, a replayable event history, and a signed proof tied to
the final source-tree digest. An independent person can verify every accepted, rejected,
reconciled, and deployed state from a clean checkout.

The same idea is also run through the strongest single-agent baseline. The fleet may be
called faster only when it reaches equivalent or better acceptance results with no silent
loss of accepted behavior. The public result names wall time, total compute, cost,
collisions, reconciliation, human interventions, and the point where additional
parallelism stopped helping.

The memorable demonstration is visible rather than narrated: someone can watch one idea
become a spawn tree, hundreds of commits, collisions, reconciliations, checks, a preview,
and a release decision.

## The falsifiable thesis

For sufficiently decomposable software work, a parallel-first agent fleet reaches a
verified preview in at most 10% of the wall-clock time of the strongest comparable
single-agent run while preserving correctness, provenance, security boundaries, and
caller-owned release authority.

The scaling curve is explored at `1 -> 8 -> 32 -> 128 -> 1000` workers. A higher tier is
unlocked only by the previous tier's receipt. Exploratory runs locate the bend; they do not
establish a general scaling claim. A confirmatory speed claim requires preregistered paired
runs of baseline and the selected fleet size across at least three held-out ideas and three
independent runs per idea, reporting median, range, failures, and censored timeouts. We
publish where the curve bends even if the thesis fails. “Fractions of fractions” is an
earned result, never an input assumption.

This is **parallel-first**, not literally parallel-only. Speculation should be massively
parallel. A small number of truth boundaries must serialize: accepting a baseline,
compare-and-swap integration, proof admission, and promotion. The experiment measures how
much elapsed time remains trapped in those boundaries.

## What counts as a worker

A worker counts only when all are true:

1. a real model process ran in its own Terrarium workspace;
2. it received a bounded objective and a specific observed repo state;
3. it produced a durable terminal receipt;
4. it created a commit, an explicit no-change finding, or an explicit blocked finding;
5. its disposition is conserved in the final ledger;
6. its work was independently checked before it influenced an accepted candidate.

A shell process writing a predetermined fixture does not count as an agent. Repeatedly
asking 1,000 agents the same question does not count as useful fan-out. Spawn count is a
measurement, not the success criterion.

## “The same repo” defined

Agents do not race inside one mutable working directory. They share one Git repository
and object graph while writing through isolated worktrees or copies. Each starts from a
named commit and writes its own commit/ref. This allows absolute speculative madness
without filesystem corruption.

Each worker receipt records:

- worker, parent, and root-run ids;
- role (`planner`, `builder`, `tester`, `critic`, `integrator`, or `release`), so support
  work cannot inflate useful implementation throughput;
- model and toolchain;
- objective and acceptance slice;
- observed base commit;
- produced commit or no-change/blocked disposition;
- files and contracts touched;
- checks run and raw result references;
- children spawned;
- wall time, token/compute usage, and estimated cost when available;
- terminal reason.

Agents may read newly published commits and spawn follow-up agents from them. No agent may
silently rewrite another agent's ref. Integration is an explicit compare-and-swap event
against an expected baseline.

## Program and target workspaces

The control-plane experiments begin at
`/Users/jcoeyman/cloudflare/airlock/experiments/new-ai-sdlc/` because Airlock already owns
the candidate/check/proof loop. Measured applications are created in sealed disposable
target repositories or worktree sets. Control-plane code, acceptance policy, and target
product code remain distinct in the event ledger.

The root run records absolute and repository-relative paths, remotes, initial commits, and
whether each tree is control, target, generated evidence, or private raw logs. A measured
run is contaminated if the root driver or an unreceipted process writes target product
code. Moving the control plane into a dedicated repo is an allowed hammer when an
experiment demonstrates that Airlock coupling distorts the result.

## Three planes

### 1. Speculation plane

Terrariums decompose, research, implement, test, review, attack, and spawn more
Terrariums. Most work happens here. Branches are cheap and disposable; receipts are not.

### 2. Integration plane

Integrators consume commits and contracts, not prose claims. They classify each result as
accepted, rejected, superseded, duplicate, reconciled, blocked, or infrastructure-failed.
Compatible work is preserved. Incompatible work gets a durable conflict record naming the
competing contracts. Unknown disposition fails closed.

Integration may itself fan out: competing reconciliations can be built in parallel. Only
the final compare-and-swap into the candidate baseline serializes.

### 3. Release plane

Airlock creates or addresses the candidate preview, runs the declared checks, gathers
evidence, and produces a signed proof bound to the source-tree digest. Keel admits or
refuses the candidate. Agents do not hold production credentials. Promotion remains a
caller action and is measured separately from time-to-verified-preview.

## Build-backwards chain

Worked backward from the North Star:

- **N — independent public replay:** a clean checkout reproduces the event ledger,
  accepted source tree, checks, proof, and preview; a skeptical reviewer verifies the
  speedup claim against the baseline and challenge corpus.
- **N-1 — visible idea-to-preview run:** a held-out idea produces running software, a
  source-bound proof, and a watchable timeline without human implementation.
- **N-2 — scaling result:** the same frozen harness and acceptance contract run at the
  unlocked worker tiers; receipts expose speed, quality, compute, collisions, and the
  serial fraction.
- **N-3 — recursive fleet:** workers consume repo events, create real commits, publish
  refs, and spawn bounded children; all terminal states are conserved.
- **N-4 — integration under real collision:** naturally overlapping implementations are
  detected; compatible behavior survives; incompatible behavior is explicitly blocked or
  reconciled; no accepted behavior disappears silently.
- **N-5 — single-agent baseline:** the strongest comparable one-agent run reaches the same
  acceptance target with the same model family, tools, starting repo, and limits.
- **N-6 — measurement can go red (START HERE):** a challenge corpus proves the harness
  rejects fake speedups, empty fan-out, omitted workers, weakened acceptance checks,
  hidden human edits, silent conflict loss, unbound proofs, and unreproducible previews.

Therefore the first experiment is not 1,000 agents. It is an oracle that can prove a
1,000-agent spectacle did not build the claimed software.

## Experiment ladder

The ladder is conditional, not a forward roadmap. Every stage must produce a hammer used
by the next stage.

```text
experiments/new-ai-sdlc/
  000-claim-oracle/          # challenge corpus + conservation ledger + fake-speedup killers
  001-single-agent/          # strongest baseline, same harness and acceptance contract
  002-eight/                 # first real model fleet + natural collision
  003-thirty-two/            # recursive spawn + multiple integration candidates
  004-one-twenty-eight/      # coordination and serial-fraction measurement
  005-one-thousand/          # unlocked only if 128 remains useful and economically authorized
  006-held-out-idea/         # frozen harness, unseen idea, public observable run
  007-independent-replay/    # clean-checkout verifier + adversarial review
  index/                     # append-only runs, blockers, findings, and tier decisions
```

Every experiment folder contains:

```text
QUESTION.md        one falsifiable question
ACCEPTANCE.md      frozen success and refusal conditions
LOOP.md            exact rerun procedure and stop condition
RUN.json           immutable run identity and environment
EVENTS.jsonl       append-only normalized event stream
RECEIPT.json       generated from EVENTS.jsonl, never hand-authored
findings.json      conclusions including negative results
NEXT.md            sharper intake produced by this run
receipts/          raw child, check, proof, deploy, and review evidence
```

A stage is incomplete without a hammer consumed by the next stage: an oracle, event
schema, runner, reconciler, verifier, visualization, or cheaper measurement path that is
actually invoked and proven useful.

## 000 challenge corpus

Before trusting a green run, the oracle must turn red for at least these mutations:

- 1,000 advertised workers but fewer durable worker receipts;
- processes that run predetermined scripts rather than model work;
- duplicate workers counted as independent useful work;
- child failures or timeouts omitted from the total;
- acceptance tests weakened between baseline and fleet;
- fleet given a different provider/model tuple, tool, idea, starting commit, or time budget;
- a worker resolves the same model name through a provider different from the sealed one;
- human-authored implementation inserted during the fleet run;
- commits produced but never dispositioned;
- compatible behavior silently dropped during reconciliation;
- conflicting contracts silently resolved by last writer wins;
- candidate proof bound to a different digest;
- preview missing, unverifiable, or receiving live traffic;
- claimed speed measured before checks or preview are complete;
- retries removed from wall time or compute totals;
- cached/prebuilt solution exposed only to the fleet;
- receipt prose inconsistent with the underlying event stream.

Every discovered failure becomes a permanent mutation. A gate change must rerun all
mutations. Missing evidence is a failure, never an exclusion.

## Frozen comparison contract

Baseline and fleet runs must share:

- held-out idea and acceptance contract;
- initial repository commit and dependency cache policy;
- exact provider/model tuple and maximum per-worker capabilities;
- available tools and network access;
- completion definition;
- check and preview environment;
- time accounting boundaries;
- retry accounting;
- security constraints.

Fleet-specific advantages—parallel compute and recursive spawning—are the independent
variable. If another variable differs, the receipt names it and the run cannot support an
unqualified speedup claim.

Run order is randomized when practical. Baseline and fleet runs use independent clean
targets; neither may observe the other's solution. Seeds, cache state, service warmth, and
run order are recorded. Exploratory tier runs may be single case studies. Generalization
requires the preregistered paired confirmation described above. Failed or timed-out runs
remain in the denominator; they are never discarded as warmups.

## Event conservation

`EVENTS.jsonl` is the source of truth. `RECEIPT.json` is generated from it. Each event has
a run id, monotonic sequence, timestamp, actor, role, event type, payload digest, previous
event digest, and event digest. The sealed run manifest signs or otherwise pins the first
and final digest. Raw child receipts and artifacts are content-addressed from events. The
verifier rejects reordering, deletion, duplication, mutation, cross-run replay, or an
event whose referenced artifact is missing.

Every spawned worker reaches exactly one terminal state. Every produced commit reaches
exactly one disposition. Every collision reaches exactly one resolution. Every declared
acceptance check reaches exactly one result. Every candidate reaches exactly one release
state.

Required equalities include:

```text
spawned = succeeded + no_change + blocked + failed + timed_out + cancelled
commits = accepted + rejected + superseded + duplicate + reconciled + blocked
collisions = reconciled + contract_blocked + unresolved
checks_declared = passed + failed + infra_failed
candidates = refused + preview_ready + promotion_requested + promoted
```

`unresolved`, unknown values, missing terminal callbacks, malformed receipts, or unequal
counts make the run invalid. A receipt that documents missing evidence does not convert
missing evidence into proof.

## Measurements

Every valid run reports:

- wall time from sealed idea intake to verified preview;
- wall time from verified preview to caller promotion, if promotion occurs;
- speedup against the comparable single-agent baseline;
- total worker runtime and parallelism over time;
- model calls, tokens, compute, and estimated real-dollar cost;
- useful commits and accepted behavior per worker;
- spawn depth and branching factor;
- collision rate and time spent reconciling;
- compatible work preserved and silently lost behavior (required: zero);
- checks passed, failed, and infrastructure-failed;
- retries, timeouts, cancellations, and human interventions;
- time in speculation, integration, proof, preview, and promotion;
- serial fraction and parallel efficiency at each tier.

Speedup is:

```text
single-agent median time to verified preview
------------------------------------------------
fleet median time to equivalent verified preview
```

A run that never reaches equivalent acceptance has no speedup value. It is a failed run.
Cost and correctness are displayed beside speed; they are never footnotes.

## Tier unlocks

A tier unlock receipt requires all of:

- the tier's acceptance contract passed without edits during the run;
- challenge mutations still go red;
- event conservation holds;
- no silent accepted-behavior loss;
- a verified preview exists;
- source-tree digest and signed proof independently verify;
- fleet result is compared to the frozen baseline;
- additional workers reduced median wall time or taught a specific coordination limit;
- projected next-tier real-dollar cost is shown to Jordan and approved when required;
- open blockers are carried into the next intake.

A tier may stop the program by proving the scaling thesis false. That negative result is a
successful experiment and must be published honestly.

## Observable run

The visualization is generated from the same event stream as the receipt. It is not a
separate dashboard with invented status.

It should make these events visible in near real time:

- idea sealed and acceptance contract frozen;
- Terrariums spawned, active, waiting, and terminal;
- parent/child spawn tree;
- base and produced commits;
- files and contracts under pressure;
- commits and checks per unit time;
- collisions, competing candidates, and reconciliation attempts;
- accepted, rejected, superseded, and blocked work;
- candidate source-tree digest;
- preview creation and probes;
- proof admission or refusal;
- caller-owned promotion boundary.

The final run must be replayable from `EVENTS.jsonl` without model access. The visual is a
view over evidence, not evidence itself.

## Current verified intake — baseline is not ready

Experiment 000 is public and its original 19-mutation corpus reproduced from a clean
checkout. Public Terrarium commit `befd22c` defaults the configurable startup watchdog to
60 seconds. Focused runtime tests cover finish-before-subscribe, cancellation, timeout,
crash/orphan recovery, launcher exit, one terminal callback, and callback linkage.
Historical router corruption remains quarantined from, and explicitly outside, clean
run-scoped evidence.

Experiment 001 then produced a new counterexample. Measured run
`ter_20260711165723012_qi3ru8` launched one process from the frozen starting commit but
failed before inference in 2.655 seconds. The runner pinned `gpt-5.6-terra` without its
provider; Pi selected `azure-openai-responses` instead of `opencode.cloudflare.dev` and
found no credential. It consumed zero model tokens, produced no candidate, and reached no
preview. It remains a failed baseline outcome and does not unlock eight agents.

That failure invalidated model-name-only comparison identity. Mutation 20 now requires
all three to agree:

1. the seal's provider/model tuple;
2. the supervisor's actual invocation;
3. every worker terminal receipt's provider/model tuple.

Two provider-pinned independent runs then failed after substantial model work:
`ter_20260711171312620_mnsnzz` consumed 277,298 tokens and $0.305778625 over 86.008
seconds; `ter_20260711171514429_98cpx9` consumed 311,803 tokens and $0.29883425 over
90.306 seconds. Both ended when the Responses stream closed before a terminal event.
Neither emitted a task receipt or commit. Their partial work is rejected evidence, not a
candidate, and both remain in aggregate accounting.

Repeated full-run failure is a blocker, not permission for an infinite retry loop.
`SEAL.v3.json` therefore preserved all three failed runs and permitted exactly one metered
provider continuation inside the same Pi session for that exact incomplete-stream error.
It permitted no worker retry, new objective, prior-patch access, or budget reset.

Run `ter_20260711171916058_wefbw9` then produced checked commit `aa2c7bd` in 178.272
seconds with no continuation, but consumed 1,712,985 tokens against its sealed 1,000,000
token ceiling. Frozen acceptance 6/6, repository tests 37/37, and site build all passed;
the commit is nevertheless `rejected-budget-exceeded`, with no admitted proof or preview.
A correct artifact cannot launder a resource-policy violation.

That counterexample became mutation 21. Its critic found that `Infinity` bypassed ordinary
numeric comparisons; mutation 22 requires safe integer token ceilings/counts and finite
non-negative cost/timing accounting. Mutations 23 and 24 reject unsafe worker counts and
negative/non-monotonic clocks.

`SEAL.v4.json` raised the prospective baseline ceiling to 2,000,000 tokens and retained
the $10 cost limit. Run `ter_20260711173722542_aomkje` then produced a checked implementation
within budget, but its proof digest included `.terrarium-workspace`; a clean detached
worktree of the same commit produced a different digest. Exit review also found post-hoc
ledger values without raw artifact references, an unsealed receipt-supplied proof key, a
preview response exposing an old source marker, and a promotion request mislabeled as
production promotion. The run is non-qualifying.

Mutations 25 through 29 now require clean replay identity, content-addressed raw evidence,
a pre-sealed signer, a preview response and deployment version bound to the source digest,
and explicit request-versus-production semantics. Prior runs remain non-qualifying; no
seal change is retrospective.

A runtime preflight or failed baseline is evidence, not a speed experiment. Its wall time,
zero-use or partial-use failure, cancellation, continuation, and fixes must not be hidden
from the eventual report.

## Driver behavior per tick

1. Read this file, `.context/BUILD-BACKWARDS.md`, and `.context/JORDAN.md`.
2. Read the experiment index, open blockers, latest `NEXT.md`, and prior invalid runs.
3. Pick the smallest currently unlocked falsifiable question. Do not jump to a higher
   worker count for spectacle.
4. Prefer multiple competing implementations or builder/critic pairs. Use isolated
   Terrarium workspaces and let children commit to their own refs.
5. Allow bounded recursive spawn when the parent can name the child's objective,
   acceptance slice, budget, and expected output.
6. Consume terminal callbacks; never inline sleep or poll. Missing callbacks invalidate
   the run and enter the challenge corpus.
7. Independently verify child claims before integration. Child `PASS` is an assertion.
8. Run competing integration candidates when conflict semantics are uncertain. Select via
   frozen acceptance checks and compare-and-swap, not agent confidence.
9. Generate the event ledger, receipt, findings, and visualization from raw events.
10. Run the challenge corpus after every harness, ledger, reconciliation, or verifier
    change.
11. Ask adversarial reviewers whether the result supports the exact claim. Convert every
    counterexample into a permanent mutation or blocker.
12. Deposit a hammer and a sharper `NEXT.md`. Stop at the checkpoint or blocker; the next
    tick consumes the exhaust.

The root driver coordinates and verifies; it does not become the hidden single developer.
If it authors product implementation during a measured run, the run is contaminated and
must say so.

## Global budget and backpressure

Before idea intake, the root seals a budget envelope: maximum spawned workers, concurrent
workers, recursion depth, wall time, model calls, retries per objective, tokens/compute,
and approved real-dollar spend. Terrarium launch limits and provider rate limits are
recorded as experimental conditions.

The root budget service is authoritative. Parents request leases from it; they cannot
mint or expand budget. A child receives only its leased remainder. Backpressure queues
work rather than silently dropping it. Budget refusal, queue expiry, rate limiting, and
provider failure are durable events and remain in wall-time and failure totals. The 1,000
worker tier means 1,000 qualifying worker receipts over the run, not necessarily 1,000
simultaneously active paid calls.

## Recursive spawn rules

A parent may spawn children only when:

- the work can proceed against a named commit without shared mutable state;
- each child has a non-overlapping objective or is an explicitly competing attempt;
- budget and maximum depth are recorded;
- the parent is responsible for conserving every child terminal state;
- the child's output can be checked mechanically or adversarially;
- another spawn is cheaper than serial reasoning at the parent.

No unbounded recursion. No child may expand its own budget. Cancellation is a terminal
event, not cleanup to omit. A poisoned or repeatedly crashing objective becomes a blocker
rather than an infinite retry loop.

## Integration rules

- Never merge generated output when source can regenerate it.
- Preserve useful independent commits rather than squashing away provenance before the
  receipt is generated.
- Detect textual, structural, contract, behavior, dependency, schema, and security
  collisions; a clean Git merge is not proof of compatibility.
- Reconciliation commits name all consumed commits and the conflicting contracts.
- Run checks on the integrated tree, not only on child branches.
- Integration uses expected-baseline compare-and-swap. A stale candidate cannot overwrite
  a newer baseline.
- Last-writer-wins is a test mutation, never a production strategy.

## Adversarial review

Each checkpoint gets at least two faces:

- a builder or fleet trying to make the claim true;
- a critic trying to produce a concrete counterexample.

Review binds to exact commits, event ledger, acceptance contract, proof, preview, and
measurement code. “Looks good” is not closure. Reviewer findings become immutable
blockers and challenge mutations. Findings are fixed, accepted by Jordan with a precisely
scoped residual risk, or demonstrated not reproducible; they are never silently deleted.

A fresh reviewer performs the final clean-checkout replay without modifying code or
policy.

## Stop gate for the whole program

All must be true:

- the 000 oracle rejects every known fake-speedup and missing-evidence mutation;
- a frozen held-out idea and acceptance contract were used;
- baseline and fleet comparison is fair and reproduced across enough runs to state its
  scope honestly;
- recursive model agents created real, conserved work in one Git object graph;
- natural collisions occurred and no accepted behavior was silently lost;
- the final application passes the frozen acceptance contract;
- the preview, source-tree digest, and signed proof independently verify;
- the event stream, receipt, and visualization agree exactly;
- real wall time, compute, cost, failures, retries, human interventions, and serial
  fraction are public;
- a clean checkout replays the run;
- adversarial reviewers have no open must-fix objection to the exact published claim;
- Jordan accepts the wording of the conclusion, including a negative conclusion.

Then stop and delete the driver loop. Do not turn a completed experiment into a permanent
1,000-agent furnace.

## Safety and authority

- Agents never receive production credentials. Preview infrastructure gets least-privilege
  scoped capabilities.
- Access precedes any deployment with bindings. No public Worker URL with sensitive
  bindings.
- Promotion and real-dollar scale remain Jordan gates under `.context/JORDAN.md`.
- No force-push to shared history. No child writes the canonical mutable worktree.
- No hidden human implementation during measured runs.
- No weakened tests, changed idea, changed acceptance, or prebuilt answer after sealing.
- Raw prompts, logs, secrets, and internal data follow the archive and privacy rules in
  `.context/JORDAN.md`.
- Public receipts contain hashes, metrics, normalized events, and safe excerpts—not raw
  private conversations or credentials.

## Self-modification

This contract is itself experiment state. A finding may change the ladder, event schema,
worker definition, comparison method, or North Star. When it does:

1. preserve the prior version;
2. record the triggering evidence;
3. state which claim became invalid;
4. rewrite this file;
5. rerun every affected challenge mutation;
6. make the change visible to Jordan.

Do not preserve a beautiful theory after the experiment disproves it.
