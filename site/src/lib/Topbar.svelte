<script lang="ts">
  import { page } from '$app/stores';
  import { site } from '$lib/site';
  const onDocs = $derived($page.url.pathname.startsWith('/docs'));
</script>

<nav class="topbar" aria-label="Primary">
  <a class="brand" href="/" aria-label="new-sdlc home">
    <img class="brand-mark" src="/new-sdlc-mark.png" alt="" width="22" height="22" aria-hidden="true" />
    <span>new-sdlc</span>
  </a>
  <div class="nav-links">
    <a href="/docs" aria-current={onDocs ? 'page' : undefined}>Docs</a>
    <a href={site.repository}>Source</a>
  </div>
</nav>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 72px;
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.78rem;
    color: var(--color-muted);
  }
  .brand,
  .nav-links {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .brand {
    color: var(--color-text);
    font-weight: 700;
  }
  .brand-mark {
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    display: block;
  }
  .nav-links a {
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }
  .nav-links a:hover {
    color: var(--color-blue);
  }
  .nav-links a[aria-current='page'] {
    color: var(--color-text);
  }
</style>
