# DOGFOOD LOOP — make airlock deliver itself

## Why this loop exists
airlock *describes* a delivery loop (candidate -> dark deploy -> fanout^x tests
-> keel-admits-signed-proof -> promote feature gate) but does NOT deliver itself
that way. Today the site ships via a plain alchemy deploy straight to prod,
bypassing runPipeline. Only localFanout is real; deploy, sign, setFeatureGate,
and the terrarium fanout backend are in-memory mocks. That is not a dogfood.
This loop makes the repo deliver itself through its own pipeline.

## Definition of done (the only thing that counts)
A push of a content-addressed candidate of THIS repo runs runPipeline with REAL
ports, and airlock.coey.dev only serves a new version after keel admits a
signed proof bound to that exact candidate digest. The homepage shows the real
promotion receipt for the digest it is currently serving.

## Real ports to implement (replace the mocks)
1. deploy(candidate) -> push the built site to a NON-serving Cloudflare slot
   (a Worker version / preview alias), addressed by the candidate digest.
   Returns the dark URL. Deploying is NOT promoting.
2. runFanout(jobs) -> terrarium backend: each test is a bounded terra child run
   against the dark URL (HTTP 200, no console errors, key routes render).
   Joined to results. Falls back to localFanout only for unit tests.
3. sign(candidate, evidence, pass) -> real keel signProof with a verifier key
   loaded from the environment (never hardcoded, never logged).
4. setFeatureGate(candidate, on) -> the ONLY promote effect: flips prod routing
   to the candidate's slot. THIS STEP IS HUMAN-GATED for prod (see below).
5. trusted -> real keel TrustedKeys keyring.

## Honesty gate (non-negotiable — learned from prior loops)
- NO worker may self-certify. The decider/gate (gate.mjs) runs verification
  itself: curls the dark URL, checks status/console/routes, recomputes the
  candidate digest, and verifies the keel proof binds to that exact digest.
- Nothing is marked green without the gate LOOKING at the real artifact.
- The count/claims never inflate. If a step cannot be proven, it is red.
- A claim of "deployed" requires the gate to resolve + 200 the URL itself.

## Scope guard (authority)
- The loop MAY: edit source, build, deploy to a DARK/non-serving slot, run
  fanout, produce a signed proof, and write receipts.
- The loop may NOT: flip the prod gate for airlock.coey.dev, or git push to a
  remote, without explicit owner approval. Promotion is the keel-gated,
  owner-held step — that is the whole point of the design. Surface the proof +
  dark URL and STOP for the promote decision.

## Required end-state artifacts
- src/ports/ real implementations + tests.
- examples/self-deliver/ an entry that runs runPipeline on THIS repo to a dark slot.
- experiments/dogfood/gate.mjs passes (orchestrator-run verification, exit 0).
- experiments/dogfood/RECEIPT.json the signed proof + dark URL + digest.
- Honest README/DESIGN update: remove or correct any claim not yet true.

## Loop rhythm
build -> dark-deploy -> fanout -> sign -> gate-verify(LOOK) -> decide.
On gate fail: fix root cause, do not patch around it. No 7th identical patch —
if an approach regresses twice, stop and rethink the structure.
