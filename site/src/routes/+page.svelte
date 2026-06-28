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
      <p class="eyebrow">new-sdlc</p>
      <h1 id="hero-title">Push a candidate, run the tests, go live only if they pass.</h1>
      <p class="lead">
        new-sdlc is a small pipeline. You push a candidate version, it deploys to a slot that serves
        no traffic, runs the tests in parallel, and makes that version live only if the tests pass.
        Run it locally with <code>bun install</code>, <code>bun test</code>, and
        <code>bun run napkin</code>.
      </p>
      <div class="hero-actions" aria-label="Primary actions">
        <a class="button primary" href="/docs">Read the docs</a>
      </div>
    </div>

    <aside class="receipt-artifact" aria-label="Promotion receipt for the served candidate">
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
    <div>
      <p class="eyebrow">The proof check</p>
      <h2 id="gate-title">How the proof is checked</h2>
      <p>
        new-sdlc assembles a candidate and the test evidence, then signs it. The signed proof is
        verified against the trusted keys before the live pointer moves. A passing test with no
        verified proof for the digest does not go live. That verification is the keel library
        new-sdlc imports.
      </p>
    </div>
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
  </section>

  <section id="limits" class="section split">
    <div>
      <p class="eyebrow">Limits</p>
      <h2>Limits</h2>
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
