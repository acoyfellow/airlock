<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { boundaries, fanoutBackends, pipeline, ports, quickStart, site } from '$lib/site';
  import { receipt } from '$lib/receipt';

  const shortDigest = receipt.candidate.replace(/^sha256:/, '').slice(0, 16);
  // Until prod is promoted, canonicalize to the slot that actually serves this
  // page (the dark URL) so shared links and crawlers never hit an unresolved host.
  const canonicalBase = (receipt.promotedToProd ? site.url : receipt.darkUrl) ?? site.url;
</script>

<svelte:head>
  <title>{site.title}</title>
  <meta name="description" content={site.description} />
  <!-- Canonical/social point at the slot actually serving this page: the dark
       slot while non-serving (so shared links + crawlers resolve), prod only
       once promoted. (candidate-* identity meta lives in +layout.svelte.) -->
  <link rel="canonical" href={canonicalBase} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={site.title} />
  <meta property="og:description" content={site.description} />
  <meta property="og:url" content={canonicalBase} />
  <meta property="og:image" content={`${canonicalBase}/og.png`} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={site.title} />
  <meta name="twitter:description" content={site.description} />
  <meta name="twitter:image" content={`${canonicalBase}/og.png`} />
</svelte:head>

<main class="shell">
  <Topbar />

  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">airlock</p>
      <h1 id="hero-title">A new version stays dark until its tests pass.</h1>
      <p class="lead">
        airlock is a small pipeline. You push a candidate version, it deploys to a slot that serves
        no traffic, runs the tests in parallel, and makes that version live only if the tests pass.
        Run it locally with <code>bun install</code>, <code>bun test</code>, and
        <code>bun run napkin</code>.
      </p>
      <div class="hero-actions" aria-label="Primary actions">
        <a class="button primary" href="/docs">Read the docs</a>
      </div>
      <p class="verify-cue">
        This page proves itself. The served-candidate receipt below is signed and bound to the exact
        bytes served here; verify it by looking with <code>node experiments/dogfood/gate.mjs</code>.
      </p>
    </div>

    <div class="hero-aside">
      <figure class="plate fx-textured hero-plate">
        <img
          src="/airlock-hero.jpg"
          alt="A lone operator before a colossal sealed airlock hatch, just beginning to open onto a calm horizon"
          width="1010"
          height="900"
          loading="eager"
        />
        <figcaption>
          <span>a candidate, held until the door opens</span>
          <b>airlock</b>
        </figcaption>
      </figure>
    </div>
  </section>

  <section class="section" aria-labelledby="flow-title">
    <div class="section-heading">
      <p class="eyebrow">The flow</p>
      <h2 id="flow-title">A candidate stays sealed until the proof clears it.</h2>
      <p>
        airlock is one link in a longer chain. Candidates arrive from agents on a pulse or from you,
        and what goes live flows on to traffic and to whatever watches it. The part airlock owns is
        the gate in the middle.
      </p>
    </div>

    <div
      class="flow"
      aria-label="airlock flow: a candidate stays sealed until its signed proof clears it"
    >
      <div class="flow-open">
        <span class="flow-open-k">candidates arrive</span>
        <span class="flow-open-v">agents on a pulse, or you</span>
      </div>
      <span class="flow-link" aria-hidden="true"></span>

      <div class="chamber">
        <span class="chamber-tag">the airlock</span>
        <ol class="lane">
          <li><span class="k">push</span><span class="v">a candidate is a content digest</span></li>
          <li><span class="k">dark slot</span><span class="v">deploys, serves no traffic</span></li>
          <li><span class="k">fanout tests</span><span class="v">run in parallel against the dark slot</span></li>
          <li><span class="k">signed proof</span><span class="v">bound to the digest, verified by keel</span></li>
        </ol>
        <div class="verdict">
          <div class="branch pass">
            <span class="branch-k">proof verifies</span>
            <span class="branch-v">flip the flag, the candidate goes live</span>
          </div>
          <div class="branch hold">
            <span class="branch-k">no proof</span>
            <span class="branch-v">hold, the known-good version keeps serving</span>
          </div>
        </div>
      </div>

      <span class="flow-link" aria-hidden="true"></span>
      <div class="flow-open">
        <span class="flow-open-k">the rest of the chain</span>
        <span class="flow-open-v">live traffic, and whatever watches it</span>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="pipeline-title">
    <div class="section-heading">
      <p class="eyebrow">How it's built</p>
      <h2 id="pipeline-title">How it's built</h2>
      <p>
        <code>runPipeline(event, jobs, ports)</code> is a pure function. These four steps are its
        body, in order. Content addressing binds all of them to the same bytes.
      </p>
    </div>
    <div class="mechanism-list">
      {#each pipeline as step}
        <div>
          <span>{step.index}</span>
          <div class="step-body">
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <code>{step.call}</code>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section id="quick-start" class="section split">
    <div>
      <p class="eyebrow">How to use it</p>
      <h2>How to use it</h2>
      <p>
        These commands run the real <code>runPipeline</code> against a file-backed backend under
        <code>.data/</code>. No Cloudflare account, no network call, no secret. Candidate A's tests
        pass so A goes live; candidate B has a failing test so it is blocked and the previous version
        stays live.
      </p>
    </div>
    <ol class="command-rail">
      {#each quickStart as item}
        <li>
          <code>{item.command}</code>
          <span>{item.note}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section id="ports" class="section">
    <div class="section-heading">
      <p class="eyebrow">The ports</p>
      <h2>The ports</h2>
      <p>
        The core deploys, signs, and promotes through these functions and nothing else. The caller
        supplies them. Swapping a backend does not edit the orchestration.
      </p>
    </div>
    <dl class="concept-list">
      {#each ports as p}
        <div>
          <dt>{p.port}</dt>
          <dd><code>{p.type}</code><br />{p.role}</dd>
        </div>
      {/each}
    </dl>
  </section>

  <section id="fanout" class="section split">
    <div>
      <p class="eyebrow">Fanout backends</p>
      <h2>Swapping the fanout backend</h2>
      <p>
        <code>runFanout</code> has one type, <code>(jobs, slot) =&gt; Promise&lt;TestResult[]&gt;</code>.
        The same pipeline runs against a local <code>Promise.all</code>, terrarium child runs, or
        Cloudflare Workflows or Facets.
      </p>
    </div>
    <div class="mechanism-list">
      {#each fanoutBackends as backend}
        <div>
          <span>{backend.name}</span>
          <p>{backend.body}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="section status-section" aria-labelledby="gate-title">
    <div class="status-copy">
      <p class="eyebrow">The proof check</p>
      <h2 id="gate-title">How the proof is checked</h2>
      <p>
        airlock assembles a candidate and the test evidence, then signs it. The signed proof is
        verified against the trusted keys before the live pointer moves. A passing test with no
        verified proof for the digest does not go live. That verification is the keel library
        airlock imports.
      </p>
      <div class="status-strip">
        <div>
          <span class="dot accepted"></span>
          <strong>10</strong>
          <span>napkin checks green</span>
        </div>
        <div>
          <span class="dot accepted"></span>
          <strong>2</strong>
          <span>signed decisions logged</span>
        </div>
        <div>
          <span class="dot neutral"></span>
          <strong>3</strong>
          <span>fanout backends, one port</span>
        </div>
      </div>
    </div>

    <aside class="receipt-artifact fx-shiny" aria-label="Promotion receipt for the served candidate">
      <div class="receipt-header">
        <span>served candidate receipt</span>
        <span>{receipt.builtAt.slice(0, 10)}</span>
      </div>
      <div class="receipt-line neutral">
        <span>CANDIDATE</span>
        <code>sha256:{shortDigest}…</code>
      </div>
      <div class="receipt-line neutral">
        <span>DEPLOY</span>
        <code>{receipt.darkUrl ? 'dark slot (non-serving)' : 'non-serving slot'}</code>
      </div>
      <div class="receipt-line neutral">
        <span>FANOUT</span>
        <code>{receipt.evidence}</code>
      </div>
      <div class="receipt-line" class:accepted={receipt.admitted}>
        <span>{receipt.admitted ? 'ADMITTED' : 'NOT ADMITTED'}</span>
        <code>{receipt.admitted ? 'proof verified' : 'no valid proof'}</code>
      </div>
      <div class="receipt-line" class:accepted={receipt.promotedToProd} class:neutral={!receipt.promotedToProd}>
        <span>{receipt.promotedToProd ? 'PROMOTED' : 'AWAITING OWNER'}</span>
        <code>{receipt.promotedToProd ? 'gate ON for candidate' : 'prod gate human-held'}</code>
      </div>
      <p>
        This is the receipt for the digest this page serves: verifier
        <code>{receipt.verifier}</code> signed <code>{receipt.policy}</code> bound to the candidate
        above. A candidate that deploys to a slot but has no verified proof does not go live.
      </p>
    </aside>
  </section>

  <section class="section drift-section" aria-labelledby="drift-title">
    <div class="section-heading">
      <p class="eyebrow">Why content addressing</p>
      <h2 id="drift-title">Drift is what the digest refuses</h2>
      <p>
        The candidate is named by a hash of its source bytes. If a file changes after the proof is
        signed, the recomputed digest no longer matches, and the gate refuses it. The change is
        caught before anything goes live.
      </p>
    </div>
  </section>

  <section id="limits" class="section split">
    <div>
      <p class="eyebrow">Limits</p>
      <h2>Limits</h2>
      <p>
        airlock does not deploy, run servers, or hold your keys. You wire it into the push you
        already have and supply the deploy, fanout, sign, and promote ports.
      </p>
    </div>
    <ul class="boundary-list">
      {#each boundaries as item}
        <li>{item}</li>
      {/each}
    </ul>
  </section>

  <section class="closing" aria-label="In one line">
    <div class="closing-band">
      <p>The door opens only when the tests pass.</p>
    </div>
  </section>

  <Footer />
</main>

<style>
  .flow {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    padding: var(--space-8) var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-layer);
  }

  .flow-open {
    display: grid;
    gap: 2px;
    justify-items: center;
    text-align: center;
    padding: var(--space-3) var(--space-5);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: transparent;
  }
  .flow-open-k {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
    color: var(--color-text);
  }
  .flow-open-v {
    font-size: 0.8rem;
    color: var(--color-faint);
  }

  .flow-link {
    width: 0;
    height: 26px;
    border-left: 1px dashed var(--color-border-strong);
  }

  .chamber {
    position: relative;
    width: 100%;
    max-width: 560px;
    display: grid;
    gap: var(--space-5);
    padding: var(--space-7) var(--space-6) var(--space-6);
    border: 1.5px solid var(--color-accent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-accent) 6%, var(--color-raised));
  }
  .chamber-tag {
    position: absolute;
    top: -0.72em;
    left: var(--space-5);
    padding: 0 var(--space-2);
    background: var(--color-layer);
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .lane {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 2px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
  }
  .lane li {
    position: relative;
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: var(--space-4);
    align-items: baseline;
    padding: var(--space-3) 0 var(--space-3) var(--space-5);
  }
  .lane li::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 1.15em;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
  }
  .lane .k {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    font-size: 0.86rem;
    color: var(--color-text);
  }
  .lane .v {
    color: var(--color-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .verdict {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .branch {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: var(--space-4);
    align-items: baseline;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-faint);
    background: var(--color-layer-2);
  }
  .branch.pass {
    border-left-color: var(--color-green);
  }
  .branch.hold {
    border-left-color: var(--color-amber);
  }
  .branch-k {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
    font-size: 0.82rem;
  }
  .branch.pass .branch-k {
    color: var(--color-green);
  }
  .branch.hold .branch-k {
    color: var(--color-amber);
  }
  .branch-v {
    color: var(--color-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  @media (max-width: 640px) {
    .lane li,
    .branch {
      grid-template-columns: 1fr;
      gap: 2px;
    }
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.7fr);
    gap: var(--space-10);
    align-items: start;
    padding: var(--space-10) 0 var(--space-16);
  }

  .hero-copy {
    max-width: 760px;
  }

  .hero-aside {
    display: grid;
    gap: var(--space-4);
  }

  .hero-plate {
    box-shadow: var(--shadow-lg);
  }
  .hero-plate img {
    aspect-ratio: 1010 / 900;
    object-fit: cover;
  }

  .verify-cue {
    max-width: 640px;
    margin-top: var(--space-6);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
    color: var(--color-muted);
    font-size: 0.95rem;
    line-height: 1.6;
  }
  .verify-cue code {
    font-size: 0.86rem;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 850px;
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 780;
    line-height: 0.96;
    letter-spacing: -0.02em;
  }

  h2 {
    max-width: 720px;
    font-size: clamp(1.4rem, 2.2vw, 1.9rem);
    font-weight: 720;
    line-height: 1.1;
  }

  h3 {
    font-size: 1.125rem;
    line-height: 1.35;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }

  .button {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-5);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-weight: 700;
    transition:
      transform 120ms ease-out,
      border-color 120ms ease-out,
      background 120ms ease-out;
  }

  .button:hover {
    transform: translateY(-1px);
  }

  .button.primary {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-canvas);
  }

  .receipt-artifact {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-6);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-raised) 88%, transparent);
  }

  .receipt-header,
  .receipt-line,
  .status-strip {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .receipt-header,
  .receipt-line {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .receipt-header {
    color: var(--color-faint);
    font-size: 0.75rem;
  }

  .receipt-line {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-layer-2);
    font-size: 0.82rem;
  }

  .receipt-line.accepted span {
    color: var(--color-green);
  }

  .receipt-line.neutral span {
    color: var(--color-muted);
  }

  .receipt-artifact p {
    color: var(--color-muted);
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .split {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(320px, 1fr);
    gap: var(--space-10);
    align-items: start;
  }

  code {
    color: var(--color-blue);
    overflow-wrap: anywhere;
  }

  .concept-list {
    display: grid;
    gap: 0;
    margin: 0;
  }
  .concept-list div {
    display: grid;
    grid-template-columns: minmax(120px, 200px) 1fr;
    gap: var(--space-6);
    padding: var(--space-5) 0;
    border-top: 1px solid var(--color-border);
  }
  .concept-list div:first-child {
    border-top: 0;
  }
  .concept-list dt {
    margin: 0;
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
    color: var(--color-text);
  }
  .concept-list dd {
    margin: 0;
    color: var(--color-muted);
    line-height: 1.65;
  }

  .mechanism-list {
    display: grid;
    gap: var(--space-3);
  }

  .mechanism-list > div {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: var(--space-4);
    align-items: start;
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .mechanism-list > div > span {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--color-accent);
  }

  .mechanism-list p {
    margin: 0;
    color: var(--color-muted);
    line-height: 1.6;
  }

  .step-body {
    display: grid;
    gap: var(--space-2);
  }

  .status-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.62fr);
    gap: var(--space-10);
    align-items: center;
  }

  .status-copy {
    display: grid;
    gap: var(--space-8);
  }

  .status-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .status-strip div {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-layer);
    color: var(--color-muted);
    font-size: 0.82rem;
  }

  .status-strip strong {
    color: var(--color-text);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-faint);
  }

  .dot.accepted {
    background: var(--color-green);
  }

  .dot.neutral {
    background: var(--color-amber);
  }

  .boundary-list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .boundary-list li {
    padding: var(--space-4) var(--space-5);
    border-left: 2px solid var(--color-accent);
    background: var(--color-layer);
    color: var(--color-muted);
    line-height: 1.55;
  }

  .drift-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.62fr);
    gap: var(--space-10);
    align-items: center;
  }
  .drift-section .section-heading {
    margin-bottom: 0;
  }

  .closing {
    padding: var(--space-16) 0 var(--space-12);
  }

  .closing-band {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: 300px;
    padding: var(--space-10) var(--space-12);
    overflow: hidden;
    border: 1px solid var(--color-text);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(130% 120% at 88% 50%, color-mix(in srgb, var(--color-accent) 34%, transparent), transparent 62%),
      var(--color-text);
  }

  .closing-band p {
    position: relative;
    max-width: 16ch;
    margin: 0;
    color: #fff;
    font-size: clamp(1.5rem, 3.2vw, 2.4rem);
    font-weight: 760;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  @media (max-width: 900px) {
    .status-section,
    .drift-section {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    h1 {
      font-size: clamp(2.1rem, 8.5vw, 2.9rem);
      line-height: 1.04;
    }

    .hero {
      gap: var(--space-8);
      padding-top: var(--space-10);
    }

    .hero-aside {
      gap: var(--space-3);
    }

    .verify-cue {
      margin-top: var(--space-5);
      padding-top: var(--space-4);
      font-size: 0.9rem;
    }

    .closing-band {
      min-height: 240px;
      padding: var(--space-8);
    }

    .closing-band p {
      max-width: none;
    }
  }

  @media (max-width: 900px) {
    .hero,
    .split {
      grid-template-columns: 1fr;
    }

    .hero {
      min-height: auto;
      padding-top: var(--space-16);
    }

    .concept-list div {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
  }

  @media (max-width: 640px) {
    .hero-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .button {
      width: 100%;
    }

    .hero {
      padding-bottom: 0;
    }

    .receipt-artifact {
      gap: var(--space-2);
      padding: var(--space-5);
    }

    .receipt-artifact p {
      display: none;
    }
  }
</style>
