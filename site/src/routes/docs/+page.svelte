<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { pipeline, ports, fanoutBackends } from '$lib/site';

  const napkinChecks = [
    { command: 'git clone https://github.com/acoyfellow/airlock && cd airlock', note: 'no Cloudflare account needed' },
    { command: 'bun install', note: 'install the orchestration and site workspace' },
    { command: 'bun run napkin', note: 'pushes A then B through the real runPipeline; prints a receipt per run' },
    { command: 'bun test', note: '29 pass: pipeline, napkin, ports, and this site copy' },
  ];

  const limits = [
    { surface: 'Fanout backend', boundary: "napkin's localFanout runs every check in the orchestrator's own process — nothing is isolated yet. terrarium, a Workflow, or a Facet backend is where untrusted checks get quarantined." },
    { surface: 'Test coverage', boundary: 'The signed proof says the fanout jobs you wired up passed, not that the candidate is correct. airlock verifies the proof; it does not judge whether your tests were the right ones.' },
    { surface: 'Digest binding', boundary: 'The core trusts deploy(candidate) to serve that digest\'s bytes; if it lies, airlock cannot tell.' },
    { surface: 'Trust', boundary: 'airlock does not decide which keys to trust. The signed proof is checked against the trusted keys; the caller decides which keys those are.' },
    { surface: 'Effects', boundary: 'The core holds no credential; a hostile candidate can touch whatever deploy gives the dark slot.' },
  ];
</script>

<svelte:head>
  <title>airlock / docs</title>
  <meta name="description" content="How a candidate build reaches live traffic, what you have to supply, and where airlock stops deciding for you." />
</svelte:head>

<main class="shell">
  <Topbar />

  <header class="doc-hero">
    <p class="eyebrow">Docs</p>
    <h1>How a candidate build reaches live traffic.</h1>
    <p class="lead">
      airlock is a deploy gate for a candidate build of your web app, Worker, or site. It tests
      that build on a real URL with no live traffic, then makes it live only after a signed proof
      says it passed. Before promote, failure leaves the live pointer alone; candidate side effects
      and rollback are yours.
    </p>
  </header>

  <section class="section" aria-labelledby="run-it">
    <div class="section-heading">
      <p class="eyebrow">How to use it</p>
      <h2 id="run-it">Run it with Bun, without a Cloudflare account</h2>
      <p>
        <code>bun run napkin</code> is file-backed under <code>.data/</code> and needs no Cloudflare
        account. It prints candidate, evidence, reason, admitted, promoted, served-before/after, and
        approve/deny audit. A goes live; B is blocked.
      </p>
    </div>
    <ol class="command-rail">
      {#each napkinChecks as item}
        <li><code>{item.command}</code><span>{item.note}</span></li>
      {/each}
    </ol>
  </section>

  <section class="section" aria-labelledby="define-gate">
    <div class="section-heading">
      <p class="eyebrow">Define the gate</p>
      <h2 id="define-gate">Your project chooses the checks</h2>
      <p>
        airlock has no default test suite. The gate is the <code>jobs</code> list you pass to
        <code>runPipeline</code>: named checks against the dark URL. Each returns
        <code>{'{ name, ok, detail }'}</code>; promotion only becomes possible when every check is
        <code>ok</code> and the proof verifies.
      </p>
    </div>
    <dl class="concept-list">
      <div>
        <dt>Greenfield</dt>
        <dd>Start with one dark-URL smoke check. Add one critical user path after it blocks a bad build.</dd>
      </div>
      <div>
        <dt>Brownfield</dt>
        <dd>Start shadow-only: run dark-URL checks and print receipts; keep promotion denied. Move traffic only when receipts match CI and the alerts you already page on.</dd>
      </div>
    </dl>
  </section>

  <section class="section" aria-labelledby="pipeline">
    <div class="section-heading">
      <p class="eyebrow">How it's built</p>
      <h2 id="pipeline">The gate decides whether a candidate goes live</h2>
      <p>A candidate build is named by content. These steps decide whether it reaches live traffic, in this order.</p>
    </div>
    <dl class="concept-list">
      {#each pipeline as step}
        <div class={`step-${step.state}`}><dt>{step.index} {step.title}</dt><dd>{step.body} <code>{step.call}</code></dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="ports">
    <div class="section-heading">
      <p class="eyebrow">What you supply</p>
      <h2 id="ports">The functions airlock calls</h2>
      <p>You supply the checks and the effects. If a supplied function throws, the run rejects. Swapping these ports moves the demo to new backends.</p>
    </div>
    <dl class="concept-list">
      {#each ports as p}
        <div><dt>{p.port}</dt><dd><code>{p.type}</code><br />{p.role}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="fanout">
    <div class="section-heading">
      <p class="eyebrow">Fanout backends</p>
      <h2 id="fanout">One fanout interface, one backend that ships</h2>
      <p>
        runFanout has one type. The Bun demo uses unbounded Promise.all: no retries, no queue.
        The gate verifies the proof and calls your promotion port; it does not schedule checks.
      </p>
    </div>
    <dl class="concept-list">
      {#each fanoutBackends as backend}
        <div><dt>{backend.name}</dt><dd>{backend.body}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="limits">
    <div class="section-heading">
      <p class="eyebrow">Limits</p>
      <h2 id="limits">What airlock doesn't decide for you</h2>
      <p>Five places where a human, a key, or a different backend still has to make the call.</p>
    </div>
    <dl class="limit-list">
      {#each limits as l}
        <div><dt>{l.surface}</dt><dd>{l.boundary}</dd></div>
      {/each}
    </dl>
  </section>

  <Footer />
</main>

<style>
  .doc-hero { padding: var(--space-16) 0 var(--space-12); }
  .doc-hero h1 {
    margin: 0;
    max-width: 680px;
    font-size: clamp(2rem, 1.4rem + 2.6vw, 3rem);
    line-height: 1.08;
    letter-spacing: -0.03em;
  }
  .section-heading h2 { margin: 0; font-size: clamp(1.4rem, 2.2vw, 1.9rem); letter-spacing: -0.02em; line-height: 1.15; }

  .concept-list, .limit-list { display: grid; gap: 0; margin: 0; }
  .concept-list div, .limit-list div {
    display: grid;
    grid-template-columns: minmax(120px, 200px) 1fr;
    gap: var(--space-6);
    padding: var(--space-5) 0;
    border-top: 1px solid var(--color-border);
  }
  .concept-list div:first-child, .limit-list div:first-child { border-top: 0; }
  dt { margin: 0; font-weight: 700; color: var(--color-text); }
  dd { margin: 0; color: var(--color-muted); line-height: 1.65; }
  dd code { color: var(--color-blue); overflow-wrap: anywhere; }
  .step-gate dt { color: var(--color-green); }
  .step-promote dt { color: var(--color-amber); }

  @media (max-width: 640px) {
    .concept-list div, .limit-list div { grid-template-columns: 1fr; gap: var(--space-2); }
  }
</style>
