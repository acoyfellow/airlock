<script lang="ts">
  import Topbar from '$lib/Topbar.svelte';
  import Footer from '$lib/Footer.svelte';
  import { terminalSession, site } from '$lib/site';
  import { receipt } from '$lib/receipt';

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
      <p class="eyebrow">v0.0.1</p>
      <h1 id="hero-title">Ship only the build of your app that passed.</h1>
      <p class="lead">
        airlock is a deploy gate for a web app, Worker, or site. It puts your candidate build on a
        URL nobody is on yet, runs its tests there, and makes that build live only if they pass. If
        a test fails, everyone stays on the current build.
      </p>
      <p class="lead lead-secondary">
        Written for a world where the push is as likely to come from an agent as from you: a green
        check is a claim, not a fact, so airlock never trusts it. It only trusts a signed proof,
        bound to the exact bytes it tested, checked on a URL nothing user-facing can reach.
      </p>
      <p class="lead lead-caveat">
        This page is the proof: it was itself deployed dark, tested by two real <b>terrarium</b>
        checks against that dark URL — terrarium on purpose, because it isolates each check in its
        own process, unlike the simpler <code>local</code> backend most projects start with —
        admitted by a real ed25519-signed proof, and promoted here by hand.
      </p>
      <p class="lead lead-caveat">
        <a class="receipt-link" href="https://github.com/acoyfellow/airlock/blob/main/experiments/dogfood/RECEIPT.json">
          View the signed receipt for this exact page
        </a>
      </p>
      <div class="hero-actions" aria-label="Primary actions">
        <a class="button primary" href="/docs">Read the docs</a>
      </div>
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
    <div class="section-heading compact-heading">
      <p class="eyebrow">a small adjustment for agent-written code</p>
      <h2 id="flow-title">One candidate build, from source to live traffic.</h2>
      <p>
        A human SDLC trusts a green check because a human is accountable for writing it. An agentic
        one cannot: the same agent can write the test and the code it tests. This is that
        adjustment — verify a signed proof bound to the exact bytes, not a claim that CI passed.
        Nothing reaches user traffic until the proof verifies.
      </p>
    </div>

    <p class="cf-path-caveat">
      This exact page shipped through steps 1, 2, 4, and 5 for real: a Worker deploy, a real
      isolated terrarium fanout, a real signed proof, a human promotion — <a
        class="receipt-link"
        href="https://github.com/acoyfellow/airlock/blob/main/experiments/dogfood/RECEIPT.json">
        view the signed receipt</a>. Step 3's Durable Object path is now real too — deployed, and
      its isolation empirically proven, not just described — but narrower than shown: Workers
      block eval, so a check is one of a small fixed set of kinds today, not arbitrary code. See
      <a href="/docs#fanout">Fanout backends</a> and <a
        href="https://github.com/acoyfellow/airlock/tree/main/experiments/isolation-proof">the
        isolation-proof experiment</a>.
    </p>
    <div class="cf-path" aria-label="The airlock path for one candidate, mostly real, Durable Object isolation proven and one box narrower than shown">
      <figure class="before-band" aria-label="Before airlock: each push creates a candidate">
        <img
          src="/airlock-agents.jpg"
          alt="A swarm of operators crossing a horizon toward a tall teal repository monolith"
          width="1024"
          height="680"
          loading="lazy"
        />
        <figcaption class="before-overlay">
          <span class="edge-k">before airlock</span>
          <h3>Each push, one candidate.</h3>
          <p>
            airlock admits a candidate only after its proof verifies. Scheduling a swarm of pushes
            is outside this demo.
          </p>
        </figcaption>
      </figure>

      <ol class="cf-steps">
        <li>
          <span class="cf-logo artifacts" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3l8 4-8 4-8-4 8-4z" />
              <path d="M4 12l8 4 8-4" />
              <path d="M4 17l8 4 8-4" />
            </svg>
          </span>
          <div>
            <h3>Artifacts</h3>
            <p>Source lands in an Artifacts repo. airlock names that tree by digest.</p>
          </div>
        </li>
        <li>
          <span class="cf-logo workers" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 7l-5 5 5 5" />
              <path d="M16 7l5 5-5 5" />
              <path d="M14 5l-4 14" />
            </svg>
          </span>
          <div>
            <h3>Workers or Pages</h3>
            <p>The candidate deploys to a dark URL. Tests fetch it; live traffic does not.</p>
          </div>
        </li>
        <li>
          <span class="cf-logo fanout" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5" cy="12" r="2.25" />
              <circle cx="19" cy="5" r="2.25" />
              <circle cx="19" cy="19" r="2.25" />
              <circle cx="19" cy="12" r="2.25" />
              <path d="M7 11l10-5" />
              <path d="M7 12h10" />
              <path d="M7 13l10 5" />
            </svg>
          </span>
          <div>
            <h3>Workflows / DO / Queues <span class="target-inline">proven, narrower</span></h3>
            <p>Checks fan out against the dark URL and join into one result. A real Durable-Object-per-check backend ships and is isolation-proven; on this page, terrarium did the fanout instead — both for real.</p>
          </div>
        </li>
        <li>
          <span class="cf-logo proof" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6l8-3z" />
              <path d="M8.5 12.5l2.5 2.5 4.5-5" />
            </svg>
          </span>
          <div>
            <h3>Signed proof</h3>
            <p>The result is signed with the digest inside it, then checked against trusted keys.</p>
          </div>
        </li>
        <li>
          <span class="cf-logo promote" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 3v18" />
              <path d="M6 4h11l-2.5 3.5L17 11H6" />
              <circle cx="6" cy="3" r="0.5" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h3>Promotion gate</h3>
            <p>If the proof verifies, the caller flips the flag for this candidate. If not, users stay on the current build.</p>
          </div>
        </li>
      </ol>

      <div class="path-edge after">
        <span class="edge-k">after airlock</span>
        <span class="edge-v">live traffic, logs, analytics, traces, alerts</span>
      </div>
    </div>
  </section>

  <section id="quick-start" class="section split">
    <div>
      <p class="eyebrow">How to use it</p>
      <h2>Run it locally</h2>
      <p>
        Requires <a href="https://bun.sh">Bun</a>. Three commands, no Cloudflare account and no keys.
        The last one runs the "napkin" — a rough sketch, not the finished build — which pushes two
        candidate builds: one whose tests pass and goes live, one with a failing test that gets
        blocked while the current build stays live. <a href="/docs">The docs</a> cover the ports,
        proof verification, and the limits.
      </p>
    </div>
    <div class="terminal" role="img" aria-label="Terminal output of bun install, bun test, and bun run napkin">
      <div class="terminal-bar">
        <span class="terminal-dot"></span>
        <span class="terminal-dot"></span>
        <span class="terminal-dot"></span>
        <span class="terminal-title">airlock — local</span>
      </div>
      <div class="terminal-body">
        {#each terminalSession as line}
          {#if line.kind === 'blank'}
            <div class="t-line t-blank">&nbsp;</div>
          {:else if line.kind === 'prompt'}
            <div class="t-line t-prompt"><span class="t-caret">$</span> {line.text}</div>
          {:else if line.kind === 'ok'}
            <div class="t-line t-ok">{line.text}</div>
          {:else if line.kind === 'fail'}
            <div class="t-line t-fail">{line.text}</div>
          {:else}
            <div class="t-line t-out">{line.text}</div>
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <Footer />
</main>

<style>

  @media (max-width: 640px) {
    .cf-steps {
      grid-template-columns: 1fr;
    }
    .cf-steps li {
      min-height: 0;
    }
    .cf-steps li + li::before {
      display: none;
    }
    .path-edge {
      align-items: start;
      flex-direction: column;
      gap: var(--space-1);
    }
    .before-overlay {
      max-width: none;
      padding: var(--space-6);
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-canvas) 60%, transparent) 0%,
        color-mix(in srgb, var(--color-canvas) 88%, transparent) 100%
      );
    }
  }
  .compact-heading {
    margin-bottom: var(--space-12);
  }

  .cf-path {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-layer) 86%, transparent);
  }
  .before-band {
    position: relative;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-layer);
  }
  .before-band img {
    display: block;
    width: 100%;
    height: clamp(240px, 34vw, 380px);
    object-fit: cover;
    object-position: 50% 42%;
  }
  .before-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    align-content: center;
    gap: var(--space-3);
    max-width: 30rem;
    padding: var(--space-10) var(--space-12);
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-canvas) 94%, transparent) 0%,
      color-mix(in srgb, var(--color-canvas) 88%, transparent) 42%,
      color-mix(in srgb, var(--color-canvas) 60%, transparent) 66%,
      transparent 96%
    );
  }
  .before-overlay h3 {
    margin: 0;
    font-size: clamp(1.3rem, 2.4vw, 1.9rem);
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }
  .before-overlay p {
    margin: 0;
    max-width: 26rem;
    color: var(--color-muted);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .path-edge {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-muted);
  }
  .edge-k,
  .edge-v,
  .cf-steps h3 {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  .edge-k {
    color: var(--color-faint);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .edge-v {
    font-size: 0.82rem;
  }
  .cf-steps {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cf-steps li {
    position: relative;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-height: 230px;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-raised);
    box-shadow: var(--shadow-md);
  }
  .cf-steps li + li::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--space-3));
    top: 34px;
    width: var(--space-3);
    border-top: 1px solid var(--color-border-strong);
  }
  .cf-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border: 1px solid var(--color-border-strong);
    border-radius: 11px;
    background:
      radial-gradient(circle at 68% 30%, rgba(255, 255, 255, 0.3), transparent 30%),
      color-mix(in srgb, var(--color-accent) 12%, var(--color-layer));
    color: var(--color-text);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }
  .cf-logo svg {
    width: 24px;
    height: 24px;
    display: block;
  }
  .cf-logo.artifacts { color: var(--color-orange); }
  .cf-logo.workers { color: var(--color-blue); }
  .cf-logo.fanout { color: var(--color-accent); }
  .cf-logo.proof { color: var(--color-green); }
  .cf-logo.promote { color: var(--color-amber); }

  .target-inline {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
    color: var(--color-muted);
    background: var(--color-border);
    vertical-align: middle;
    margin-left: var(--space-2);
  }
  .cf-steps h3 {
    margin: 0 0 var(--space-2);
    font-size: 0.92rem;
    line-height: 1.25;
    color: var(--color-text);
  }
  .cf-steps p {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
    line-height: 1.55;
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

  .lead-secondary {
    margin-top: var(--space-4);
  }

  .lead-caveat {
    margin-top: var(--space-4);
    font-size: 0.95rem;
    color: var(--color-faint);
  }
  .lead-caveat a { color: var(--color-blue); text-decoration: underline; text-underline-offset: 2px; }
  .receipt-link {
    display: inline-block;
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-accent) !important;
    text-decoration: none !important;
  }
  .receipt-link:hover { text-decoration: underline !important; }

  .cf-path-caveat {
    max-width: 720px;
    margin: 0 0 var(--space-8);
    padding: var(--space-4) var(--space-5);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-muted);
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .cf-path-caveat a { color: var(--color-blue); }

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

  /* Zero specificity so this baseline never fights the real spacing rules in
     primitives.css (.eyebrow, .lead, .section p) — those must always win. */
  :where(h1, h2, h3, p) {
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

  .split {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(320px, 1fr);
    gap: var(--space-10);
    align-items: start;
  }

  /* A real terminal, not a marketing card rail — the lines below are a
     captured transcript (see terminalSession in site.ts), not paraphrase. */
  .terminal {
    overflow: hidden;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: #0a0f12;
    box-shadow: var(--shadow-md);
  }
  .terminal-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid rgba(160, 205, 212, 0.13);
    background: #0d1418;
  }
  .terminal-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: rgba(160, 205, 212, 0.22);
  }
  .terminal-title {
    margin-left: var(--space-2);
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: var(--color-faint);
  }
  .terminal-body {
    padding: var(--space-5);
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.65;
  }
  .t-line { white-space: pre-wrap; word-break: break-word; }
  .t-blank { height: 0.6em; }
  .t-prompt { color: #f2f8f9; font-weight: 600; }
  .t-caret { color: var(--color-accent); }
  .t-out { color: #7c9099; }
  .t-ok { color: var(--color-green); }
  .t-fail { color: var(--color-red); }

  @media (max-width: 900px) {
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

    /* Stacked, the plate would otherwise fill the whole viewport and dwarf
       the copy — cap its height so it stays a companion, not the page. */
    .hero-plate img {
      aspect-ratio: auto;
      max-height: 440px;
      object-fit: cover;
    }

    /* Five cards can't sit side by side below the desktop width without
       clipping their titles — wrap to two columns and drop the horizontal
       connector tick that only reads in a single row. */
    .cf-steps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .cf-steps li {
      min-height: 0;
    }
    .cf-steps li + li::before {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .cf-steps {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    /* Creative mobile hero: the plate becomes a full-bleed cinematic banner
       that dissolves into the canvas, and the title rides the fade. */
    .hero {
      position: relative;
      display: block;
      gap: 0;
      min-height: auto;
      padding: 0 0 var(--space-4);
    }

    .hero-aside {
      position: absolute;
      top: 0;
      left: -16px;
      right: -16px;
      z-index: 0;
      gap: 0;
      pointer-events: none;
    }

    .hero-plate {
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .hero-plate img {
      aspect-ratio: auto;
      width: 100%;
      height: min(96vw, 420px);
      object-fit: cover;
      object-position: 50% 14%;
      -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 38%, transparent 82%);
      mask-image: linear-gradient(180deg, #000 0%, #000 38%, transparent 82%);
    }

    .hero-plate figcaption {
      display: none;
    }

    .hero-copy {
      position: relative;
      z-index: 1;
      max-width: none;
      padding-top: min(72vw, 300px);
    }

    .hero-copy .eyebrow {
      background: color-mix(in srgb, var(--color-canvas) 82%, transparent);
      border-radius: var(--radius-sm, 6px);
      backdrop-filter: blur(2px);
    }

    h1 {
      font-size: clamp(2.1rem, 8.5vw, 2.9rem);
      line-height: 1.02;
      text-shadow: 0 1px 0 var(--color-canvas), 0 2px 18px var(--color-canvas);
    }

    .hero .lead {
      margin-top: var(--space-4);
    }

    .hero-actions {
      align-items: stretch;
      flex-direction: column;
      margin-top: var(--space-6);
    }

    .button {
      width: 100%;
    }

    /* The napkin transcript's longest lines (digest + quoted title) run wider
       than a phone viewport at desktop size — shrink the type so real lines
       fit instead of clipping at the box edge. */
    .terminal-body {
      padding: var(--space-4);
      font-size: 0.68rem;
    }
  }
</style>
