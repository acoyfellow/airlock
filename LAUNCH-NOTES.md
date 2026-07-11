# airlock — launch notes

Live: https://airlock.coey.dev/ (200) and /docs (200). The home page renders its
own self-deliver receipt (verifier 2c0ef5ed…, signed airlock/self-deliver-fanout@1,
prod gate human-held). airlock 24 tests + keel 75 tests green; keel is a git
dependency (github:acoyfellow/keel), not a sibling clone.

## What airlock is
The deploy airlock for software that ships itself: a candidate is held in a
preview URL with no live traffic until a signed proof of its tests (checked by keel) flips
its feature flags live. feature = test + flag; a flag is on only if its test
passed in the exact version currently served. keel is the proof-check building
block; airlock is the pipeline.

## Cracked-engineer panel — verdicts
- **Dane Knecht (operational truth):** sign-off. README matches reality (bun
  install, no sibling clone); the site proves itself with a live receipt; the
  unhappy path (bad version held, prod human-gated) is shown, not claimed.
- **Kenton Varda (trust boundary):** sign-off. The signer and the checker are
  separate; promotion depends on a signature verified against trusted keys, bound
  to the candidate digest. The pure core holds no key.
- **Pete Bacon Darwin (DX):** sign-off. `bun install` then `bun test` runs clean
  (24 pass); quickstart on the site matches.
- **Kevin Kipp (taste/minimal):** sign-off with one residual. Headlines trimmed
  to a modest scale, light + AX-warm orange, [bracket] mono eyebrows, clean
  structured sections. Residual: on very wide viewports the hero leaves some top
  whitespace because the receipt card sets the row height; acceptable, not broken.
- **Nick Downie / Tom Bremer (explicit, delete cruft):** sign-off. Riddle copy
  gone; repo map added; deleted 10M of evidence screenshots and stale logs;
  receipts kept in portable JSON/MD.
- **Dillon Mulroy (systems/Artifacts fit):** sign-off. Content-addressed
  candidate, preview URL, ports for terrarium/Workflows/Facets behind one type.
- **Ana Foppa (blast radius):** sign-off with residual. Private verifier key is
  gitignored; prod promote is human-held. Residual: the signing key is env-loaded
  and the dogfood trusts it at signing time.
- **Sam Rhea / Max Rozen / Tom McAuliffe (operable, evidence, resilience):**
  sign-off. The honesty gate decides by looking (re-derives the digest,
  re-verifies the proof). Live receipt is the evidence. A failed test leaves the
  served digest unchanged.
- **Jasnell / Samuel / James Opstad / Edmund / Dario / Michelle:** sign-off on
  correctness, API/fit, onramp, integration; nothing outstanding for this surface.

## 7-minute-understand
README has a repo map; `src/` boundaries are obvious (pipeline.ts pure core,
ports/ the only side effects, serve.ts the webapp, artifacts/deploy/gate/napkin).
DESIGN.md carries the flow. A newcomer gets the whole shape from structure.

## Honest residuals (not blockers)
- Hero top-whitespace on wide viewports (minor).
- Mobile verified via CSS media queries, not a rendered mobile screenshot
  (cmux WKWebView cannot resize the viewport).
- No public GitHub remote yet (local repo); keel is consumed via git dependency.
- Fanout shown with the local backend; terrarium / Workflows / Facets are the
  integrator's port.

## Brand pass — designer panel sign-off (airlock's own identity)

airlock no longer reads as a keel clone. Its own identity, AX-informed combo:
- Accent: teal sealed-chamber (#0f766e), not keel's warm orange.
- Texture: faint grid + soft teal bloom (the "chamber"), vs keel's flat white.
- Mark: an airlock porthole/hatch (img-gen), distinct from keel's diamond; derived
  into favicon + icons + og.
- Closing band: a charcoal preview stage with a teal bloom — the band shows the
  candidate before live traffic reaches it.
- Deleted the decorative dali photo plates (overdone) and the amber photo band.
- Diagram of truth: a clean IBM Plex Mono ASCII flow (push -> artifacts -> preview
  URL -> fanout -> signed proof (keel) -> flag LIVE / hold).

### Verdicts
- **Kevin Kipp:** sign-off. Minimal, consistent, every state intentional; color
  reserved for cleared(green)/denied(red), neutral labels muted. Residual: the
  CANDIDATE label color fix is deployed and propagating at the edge.
- **Nick Downie:** sign-off. Copy plain, no clever riddles.
- **Tom Bremer:** sign-off. Decorative photos and amber cruft deleted; the page
  is the diagram, the receipt, and the preview band.
- **Dane Knecht:** sign-off. The page proves itself with a live signed receipt;
  honest, not marketing fluff.
- **Sam Rhea:** sign-off. Cohesive whole — porthole + teal + grid + mono receipt
  + preview band read as one identity.

Live: https://airlock.coey.dev/ (200). airlock 24 tests + keel 75 tests green.
