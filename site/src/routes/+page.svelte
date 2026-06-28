<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { boundaries, fanoutBackends, pipeline, ports, quickStart, site } from '$lib/site';
  import { receipt } from '$lib/receipt';

  const shortDigest = receipt.candidate.replace(/^sha256:/, '').slice(0, 16);
</script>

<svelte:head>
  <title>{site.title}</title>
  <meta name="description" content={site.description} />
  <!-- The candidate digest this build was made from; the honesty gate matches
       this against an independent recompute of the source tree. -->
  <meta name="candidate-digest" content={receipt.candidate} />
  <meta name="candidate-admitted" content={String(receipt.admitted)} />
  <link rel="canonical" href={site.url} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={site.title} />
  <meta property="og:description" content={site.description} />
  <meta property="og:url" content={site.url} />
  <meta property="og:image" content={`${site.url}/og.png`} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={site.title} />
  <meta name="twitter:description" content={site.description} />
  <meta name="twitter:image" content={`${site.url}/og.png`} />
</svelte:head>

<main class="shell">
  <Topbar />

  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">A different delivery loop</p>
      <h1 id="hero-title">Promote a candidate only when its proof passes.</h1>
      <p class="lead">
        An agent pushes a candidate to a content-addressed repo. The push deploys it to a slot that
        serves no traffic, fans out tests in parallel, and turns the feature gate on only when keel
        admits a signed proof bound to that exact candidate. A candidate that deploys but does not
        pass is never promoted.
      </p>
      <div class="hero-actions" aria-label="Primary actions">
        <a class="button primary" href="/docs">Read the docs</a>
        <a class="button secondary" href={site.repository}>View source</a>
      </div>
    </div>

    <aside class="receipt-artifact" aria-label="Promotion receipt for the served candidate">
      <div class="receipt-header">
        <span>receipt</span>
        <span>{receipt.builtAt.slice(0, 10)}</span>
      </div>
      <div class="receipt-line neutral">
        <span>CANDIDATE</span>
        <code>sha256:{shortDigest}…</code>
      </div>
      <div class="receipt-line neutral">
        <span>DEPLOY</span>
        <code>{receipt.darkUrl ? 'dark slot (non-serving)' : 'candidate -> non-serving slot'}</code>
      </div>
      <div class="receipt-line neutral">
        <span>FANOUT</span>
        <code>{receipt.evidence}</code>
      </div>
      <div class="receipt-line" class:accepted={receipt.admitted}>
        <span>{receipt.admitted ? 'ADMITTED' : 'NOT ADMITTED'}</span>
        <code>keel: {receipt.admitted ? 'proof passed' : 'no valid proof'}</code>
      </div>
      <div class="receipt-line" class:accepted={receipt.promotedToProd} class:neutral={!receipt.promotedToProd}>
        <span>{receipt.promotedToProd ? 'PROMOTED' : 'AWAITING OWNER'}</span>
        <code>{receipt.promotedToProd ? 'gate ON for candidate' : 'prod gate human-held'}</code>
      </div>
      <p>
        This is the real receipt for the digest this page is serving:
        <code>{receipt.verifier}</code> signed <code>{receipt.policy}</code> bound to the candidate
        above. A candidate that deploys dark but is not admitted is never promoted.
      </p>
    </aside>
  </section>

  <section class="section" aria-labelledby="pipeline-title">
    <div class="section-heading">
      <p class="eyebrow">The pipeline</p>
      <h2 id="pipeline-title">Four steps, one yes-or-no.</h2>
      <p>
        <code>runPipeline(event, jobs, ports)</code> is a pure function. These steps are exactly its
        body: deploy, fan out, let keel admit a signed proof, then promote.
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
      <p class="eyebrow">Quick start</p>
      <h2>Try it in three commands.</h2>
      <p>
        The quick path exercises the real orchestration and the hello world. It does not call a
        network service or ask for a secret.
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
      <h2>Every side effect is injected.</h2>
      <p>
        The core never deploys, signs, or promotes on its own. It sequences these ports and reads
        admission from keel. Swapping a backend never edits the orchestration.
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
      <p class="eyebrow">fanout^x backends</p>
      <h2>One port, any backend that joins parallel work.</h2>
      <p>
        <code>runFanout</code> is one type. The same pipeline runs against terrarium child runs,
        Cloudflare Workflows or Facets, or a local <code>Promise.all</code>.
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
    <div>
      <p class="eyebrow">The keel gate</p>
      <h2 id="gate-title">new-sdlc produces; keel admits.</h2>
      <p>
        new-sdlc deploys a candidate and assembles evidence. <a href={site.keel}>keel</a> verifies a
        signed, artifact-bound proof against a trusted keyring and returns a yes or no. new-sdlc
        never grades its own work, and a passing test with no valid proof for the digest does not
        promote.
      </p>
    </div>
    <div class="status-strip">
      <div>
        <span class="dot accepted"></span>
        <strong>4</strong>
        <span>pipeline tests pass</span>
      </div>
      <div>
        <span class="dot accepted"></span>
        <strong>1</strong>
        <span>runnable hello world</span>
      </div>
      <div>
        <span class="dot neutral"></span>
        <strong>3</strong>
        <span>fanout backends, one port</span>
      </div>
    </div>
  </section>

  <section id="limits" class="section split">
    <div>
      <p class="eyebrow">Limits</p>
      <h2>What new-sdlc does not do.</h2>
      <p>
        new-sdlc does not deploy, run servers, or hold your keys. You wire it into the push you
        already have and supply the deploy, fanout, sign, and promote ports.
      </p>
    </div>
    <ul class="boundary-list">
      {#each boundaries as item}
        <li>{item}</li>
      {/each}
    </ul>
  </section>

  <Footer />
</main>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.65fr);
    gap: var(--space-10);
    align-items: end;
    min-height: calc(100dvh - 120px);
    padding: var(--space-20) 0 var(--space-16);
  }

  .hero-copy {
    max-width: 760px;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 850px;
    font-size: clamp(2.75rem, 8vw, 6.75rem);
    font-weight: 780;
    line-height: 0.92;
  }

  h2 {
    max-width: 720px;
    font-size: clamp(1.75rem, 3vw, 2.5rem);
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
    border-color: var(--color-orange);
    background: var(--color-orange);
    color: var(--color-canvas);
  }

  .button.secondary:hover {
    border-color: var(--color-blue);
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
    color: var(--color-amber);
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
    color: var(--color-orange);
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
    border-left: 2px solid var(--color-orange);
    background: var(--color-layer);
    color: var(--color-muted);
    line-height: 1.55;
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
