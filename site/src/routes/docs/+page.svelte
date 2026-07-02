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
    { surface: 'Digest binding', boundary: "The core never checks the signed digest against the bytes deploy shipped; that binding is the artifacts port's job, not airlock's." },
    { surface: 'Trust', boundary: 'airlock does not decide which keys to trust. The signed proof is checked against the trusted keys; the caller decides which keys those are.' },
    { surface: 'Effects', boundary: 'Deploy, sign, and promote are ports the caller supplies. The pure core holds no credential and makes no network call unless a port does.' },
  ];
</script>

<svelte:head>
  <title>airlock / docs</title>
  <meta name="description" content="How a candidate becomes the live version, what you have to supply, and where airlock stops deciding for you." />
</svelte:head>

<main class="shell">
  <Topbar />

  <header class="doc-hero">
    <p class="eyebrow">Docs</p>
    <h1>How a candidate becomes the live version.</h1>
    <p class="lead">
      airlock is the deploy gate between a candidate build and live traffic: the candidate deploys
      to a real URL with zero traffic, gets tested there, and only goes live once a signed proof
      says it passed. If the proof fails, the version already live keeps serving — nothing rolls
      back, because nothing moved. <code>runPipeline</code> is the pure core, proven so far by
      the local demo below; the Cloudflare shape is unbuilt.
    </p>
  </header>

  <section class="section" aria-labelledby="run-it">
    <div class="section-heading">
      <p class="eyebrow">How to use it</p>
      <h2 id="run-it">Run it without a Cloudflare account</h2>
      <p>
        <code>bun run napkin</code> is file-backed under <code>.data/</code> and needs no Cloudflare
        account. It pushes a passing candidate and a failing one, prints a receipt per run, and
        prints the in-memory signed audit log for that run. A goes live; B is blocked.
      </p>
    </div>
    <ol class="command-rail">
      {#each napkinChecks as item}
        <li><code>{item.command}</code><span>{item.note}</span></li>
      {/each}
    </ol>
  </section>

  <section class="section" aria-labelledby="pipeline">
    <div class="section-heading">
      <p class="eyebrow">How it's built</p>
      <h2 id="pipeline">Four steps decide whether a candidate goes live</h2>
      <p>A candidate is named by content. These steps decide whether it replaces the running version, in this order.</p>
    </div>
    <dl class="concept-list">
      {#each pipeline as step}
        <div class={`step-${step.state}`}><dt>{step.index} {step.title}</dt><dd>{step.body} <code>{step.call}</code></dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="cloudflare-shape">
    <div class="section-heading">
      <p class="eyebrow">Cloudflare shape</p>
      <h2 id="cloudflare-shape">What each word maps to</h2>
      <p>
        The demo is local; the Cloudflare wiring below is unbuilt. The names map onto it anyway.
      </p>
    </div>
    <dl class="concept-list">
      <div>
        <dt>candidate</dt>
        <dd>Source in a Cloudflare Artifacts repo, named by a digest of the tree airlock is about to test.</dd>
      </div>
      <div>
        <dt>dark slot</dt>
        <dd>A deployed Worker or Pages version with a URL, held away from user traffic.</dd>
      </div>
      <div>
        <dt>fanout</dt>
        <dd>Parallel checks against the dark slot. The backend can be local promises, terrarium children, Workflows steps, Durable Object Facets, or Queues.</dd>
      </div>
      <div>
        <dt>signed proof</dt>
        <dd>A proof that says these checks passed for this exact digest under a trusted key.</dd>
      </div>
      <div>
        <dt>feature gate</dt>
        <dd>Cloudflare Flags flips only after the proof verifies for this exact candidate.</dd>
      </div>
      <div>
        <dt>after airlock</dt>
        <dd>Traffic and observability. Logs, analytics, traces, alerts, and pulse can inspect the version that was allowed through.</dd>
      </div>
    </dl>
  </section>

  <section class="section" aria-labelledby="ports">
    <div class="section-heading">
      <p class="eyebrow">What you supply</p>
      <h2 id="ports">The functions airlock calls</h2>
      <p>airlock never deploys, signs, or promotes on its own. It calls these functions, and you supply them. That is how the same core runs on files locally and on Cloudflare in production.</p>
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
        runFanout has one type. Only local runs today — it's what the napkin uses. The type says
        nothing about retries: a backend that reruns a job on failure can duplicate its line in the
        evidence string.
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
  dd code { color: var(--color-blue); }
  .step-gate dt { color: var(--color-green); }
  .step-promote dt { color: var(--color-amber); }

  @media (max-width: 640px) {
    .concept-list div, .limit-list div { grid-template-columns: 1fr; gap: var(--space-2); }
  }
</style>
