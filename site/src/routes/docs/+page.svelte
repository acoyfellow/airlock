<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { site, pipeline, ports, fanoutBackends } from '$lib/site';

  const quickstart = [
    { command: 'git clone https://github.com/acoyfellow/keel', note: 'clone keel next to new-sdlc; it is the proof gate, imported by path' },
    { command: 'git clone https://github.com/acoyfellow/new-sdlc', note: 'clone new-sdlc as a sibling of keel' },
    { command: 'cd new-sdlc && bun install', note: 'install the orchestration and site workspace' },
    { command: 'bun test', note: 'run the deterministic pipeline tests' },
    { command: 'bun run hello', note: 'green candidate promoted, red blocked, gate holds' },
  ];

  const limits = [
    { surface: 'Trust', boundary: 'new-sdlc does not decide trust. keel admits or refuses the signed, artifact-bound proof against the trusted keyring.' },
    { surface: 'Fanout backend', boundary: 'The default localFanout runs jobs in-process. A real terrarium, Workflow, or Facet backend is the integrator port and the place to isolate untrusted jobs.' },
    { surface: 'Effects', boundary: 'Deploy, sign, and promote are injected ports. The pure core holds no credential and makes no network call unless a port does.' },
    { surface: 'Owner root', boundary: 'A verifier key trusted and active at signing time can sign a proof for a bad candidate. new-sdlc narrows where authority is used; it does not remove the owner root.' },
  ];
</script>

<svelte:head>
  <title>new-sdlc / docs</title>
  <meta name="description" content="new-sdlc documentation: the pipeline, the ports, fanout^x backends, the keel gate, and honest limits." />
</svelte:head>

<main class="shell">
  <Topbar />

  <header class="doc-hero">
    <p class="eyebrow">Docs</p>
    <h1>What new-sdlc is and how to use it.</h1>
    <p class="lead">
      new-sdlc orchestrates a delivery loop: a push deploys a candidate to a non-serving slot, fans
      out tests in parallel, and promotes the feature gate only when keel admits a signed proof
      bound to that exact candidate. The orchestration is a pure function; every effect is an
      injected port.
    </p>
  </header>

  <section class="section" aria-labelledby="quickstart">
    <div class="section-heading">
      <p class="eyebrow">Quick start</p>
      <h2 id="quickstart">Clone both repos, then run it.</h2>
      <p>keel is the proof gate. new-sdlc imports it by path, so check keel out next to new-sdlc.</p>
    </div>
    <ol class="command-rail">
      {#each quickstart as item}
        <li><code>{item.command}</code><span>{item.note}</span></li>
      {/each}
    </ol>
  </section>

  <section class="section" aria-labelledby="pipeline">
    <div class="section-heading">
      <p class="eyebrow">The pipeline</p>
      <h2 id="pipeline">The four steps of runPipeline.</h2>
      <p>A candidate is named by content. These steps decide whether it is allowed to replace the running version, in this order.</p>
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
      <h2 id="ports">Everything with a side effect.</h2>
      <p>The core never deploys, signs, or promotes on its own. It sequences these ports and reads admission from keel.</p>
    </div>
    <dl class="concept-list">
      {#each ports as p}
        <div><dt>{p.port}</dt><dd><code>{p.type}</code><br />{p.role}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="fanout">
    <div class="section-heading">
      <p class="eyebrow">fanout^x backends</p>
      <h2 id="fanout">One port, three backends.</h2>
      <p>runFanout is one type. The same pipeline runs against any backend that joins parallel work.</p>
    </div>
    <dl class="concept-list">
      {#each fanoutBackends as backend}
        <div><dt>{backend.name}</dt><dd>{backend.body}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="section" aria-labelledby="gate">
    <div class="section-heading">
      <p class="eyebrow">The keel gate</p>
      <h2 id="gate">Produce versus admit.</h2>
      <p>
        new-sdlc produces a candidate and the evidence. <a href={site.keel}>keel</a> admits or
        refuses the signed proof. Splitting the two means the promote step depends on a signature
        keel can check, from a key the owner trusts, bound to the candidate that was tested.
      </p>
    </div>
    <ol class="command-rail">
      <li><code>import &#123; verifySignedProof &#125; from '../keel/src/index.ts'</code><span>path import; keel is not published to a registry</span></li>
      <li><code>verifySignedProof(proof, candidate, trusted)</code><span>keel returns admitted or refused, bound to the candidate digest</span></li>
    </ol>
  </section>

  <section class="section" aria-labelledby="limits">
    <div class="section-heading">
      <p class="eyebrow">Limits</p>
      <h2 id="limits">What new-sdlc does not do.</h2>
      <p>These are the known edges, written down on purpose.</p>
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
  .section-heading h2 { margin: 0; font-size: clamp(1.75rem, 3vw, 2.5rem); letter-spacing: -0.03em; line-height: 1.1; }

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
