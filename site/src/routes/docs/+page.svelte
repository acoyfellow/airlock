<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { pipeline, ports, fanoutBackends } from '$lib/site';

  const napkinChecks = [
    { command: 'bun install', note: 'install the orchestration and site workspace' },
    { command: 'bun run napkin', note: 'pushes A then B through the real runPipeline; prints a receipt per run' },
    { command: 'bun test', note: '29 pass: pipeline, napkin, ports, and this site copy' },
  ];

  const limits = [
    { surface: 'Trust', boundary: 'airlock does not decide which keys to trust. The signed proof is checked against the trusted keys; the caller decides which keys those are.' },
    { surface: 'Fanout backend', boundary: 'localFanout runs jobs in-process. A real terrarium, Workflow, or Facet backend is the integrator port and the place to isolate untrusted jobs.' },
    { surface: 'Effects', boundary: 'Deploy, sign, and promote are ports the caller supplies. The pure core holds no credential and makes no network call unless a port does.' },
    { surface: 'Signing key', boundary: 'A signing key trusted and active at signing time can sign a proof for a bad candidate. airlock narrows where the key is used; it does not remove the owner key.' },
    { surface: 'Not yet on a custom domain', boundary: 'The napkin is file-backed under .data/. The Cloudflare ports deploy to a non-serving *.workers.dev slot, but pointing airlock.coey.dev at a candidate is a human decision, not a pipeline step.' },
  ];
</script>

<svelte:head>
  <title>airlock / docs</title>
  <meta name="description" content="airlock documentation: the pipeline, the ports, the fanout backends, how the proof is checked, and the limits." />
</svelte:head>

<main class="shell">
  <Topbar />

  <header class="doc-hero">
    <p class="eyebrow">Docs</p>
    <h1>The pipeline, the ports, and the limits.</h1>
    <p class="lead">
      airlock is a small pipeline. You push a candidate version, it deploys to a slot that serves
      no traffic, runs the tests in parallel, and makes that version live only if the tests pass.
      <code>runPipeline</code> is a pure function that calls four ports the caller supplies and
      verifies a signed proof before the live pointer moves.
    </p>
  </header>

  <section class="section" aria-labelledby="run-it">
    <div class="section-heading">
      <p class="eyebrow">How to use it</p>
      <h2 id="run-it">How to use it</h2>
      <p>
        <code>bun run napkin</code> is file-backed under <code>.data/</code> and needs no Cloudflare
        account. It pushes a passing candidate and a failing one, prints a receipt per run, and
        writes a signed audit log. A goes live; B is blocked and the previous version stays live.
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
      <h2 id="pipeline">How it's built</h2>
      <p>A candidate is named by content. These steps decide whether it replaces the running version, in this order.</p>
    </div>
    <dl class="concept-list">
      {#each pipeline as step}
        <div><dt>{step.index} {step.title}</dt><dd>{step.body} <code>{step.call}</code></dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="ports">
    <div class="section-heading">
      <p class="eyebrow">The ports</p>
      <h2 id="ports">The ports</h2>
      <p>The core deploys, signs, and promotes through these functions and nothing else. The caller supplies them.</p>
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
      <h2 id="fanout">Swapping the fanout backend</h2>
      <p>runFanout has one type. The same pipeline runs against any backend that joins parallel work.</p>
    </div>
    <dl class="concept-list">
      {#each fanoutBackends as backend}
        <div><dt>{backend.name}</dt><dd>{backend.body}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="gate">
    <div class="section-heading">
      <p class="eyebrow">The proof check</p>
      <h2 id="gate">How the proof is checked</h2>
      <p>
        airlock assembles a candidate and the test evidence, then signs it. Before the live pointer
        moves, the signed proof is verified against the trusted keys, bound to the candidate that
        was tested. That verification is the keel library airlock imports.
      </p>
    </div>
    <ol class="command-rail">
      <li><code>verifySignedProof(proof, candidate, trusted)</code><span>returns whether the proof verifies, bound to the candidate digest</span></li>
    </ol>
  </section>

  <section class="section" aria-labelledby="limits">
    <div class="section-heading">
      <p class="eyebrow">Limits</p>
      <h2 id="limits">Limits</h2>
      <p>These are the known edges.</p>
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

  @media (max-width: 640px) {
    .concept-list div, .limit-list div { grid-template-columns: 1fr; gap: var(--space-2); }
  }
</style>
