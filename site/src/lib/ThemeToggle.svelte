<script lang="ts">
  import { onMount } from 'svelte';

  let theme = $state<'light' | 'dark'>('dark');

  onMount(() => {
    const saved = localStorage.getItem('airlock-theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  });

  function toggle() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('airlock-theme', theme);
    } catch (e) {}
  }
</script>

<button
  class="theme-toggle"
  type="button"
  onclick={toggle}
  aria-label="Toggle light or dark theme"
  title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
>
  {#if theme === 'dark'}
    <!-- a closed hatch in the dark: switch to light -->
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.4" />
      <circle cx="8" cy="8" r="1.7" fill="currentColor" />
    </svg>
  {:else}
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M11.5 9.2A4.2 4.2 0 0 1 6.8 4.5a.6.6 0 0 0-.85-.62 5 5 0 1 0 6.17 6.17.6.6 0 0 0-.62-.85Z"
        fill="currentColor"
      />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-layer);
    color: var(--color-muted);
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }
  .theme-toggle:hover {
    color: var(--color-accent);
    border-color: var(--color-border-strong);
  }
</style>
