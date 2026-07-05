<script lang="ts">
  // A tiny, dependency-free TypeScript/JS highlighter. It tokenizes with one
  // ordered regex and colors each token with the site's existing theme tokens,
  // so it tracks light/dark automatically. Not a full parser — enough for the
  // short, hand-checked snippets on this site.
  export let code: string;
  export let label: string | undefined = undefined;

  type Tok = { text: string; cls: string };

  const KEYWORDS = new Set([
    'function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
    'async', 'await', 'new', 'throw', 'import', 'export', 'from', 'type',
    'interface', 'class', 'extends', 'implements', 'this', 'typeof', 'as',
    'true', 'false', 'null', 'undefined', 'void', 'string', 'number', 'boolean',
    'Promise',
  ]);

  // Order matters: comments and strings first so their contents aren't re-lexed.
  const TOKEN = new RegExp(
    [
      '(\\/\\/[^\\n]*)', // 1 line comment
      '(`(?:\\\\.|[^`\\\\])*`|\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*")', // 2 string
      '(\\b\\d[\\d_.]*\\b)', // 3 number
      '([A-Za-z_$][\\w$]*)(?=\\s*\\()', // 4 call/def name
      '([A-Za-z_$][\\w$]*)', // 5 word (keyword or ident)
      '([{}()\\[\\];,.:?=<>+\\-*/%!&|]+)', // 6 punctuation
      '(\\s+)', // 7 whitespace
      '([\\s\\S])', // 8 any other single char (backslashes, etc.)
    ].join('|'),
    'g'
  );

  function tokenize(src: string): Tok[] {
    const out: Tok[] = [];
    let m: RegExpExecArray | null;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      if (m[1]) out.push({ text: m[1], cls: 'c-comment' });
      else if (m[2]) out.push({ text: m[2], cls: 'c-string' });
      else if (m[3]) out.push({ text: m[3], cls: 'c-number' });
      else if (m[4]) out.push({ text: m[4], cls: KEYWORDS.has(m[4]) ? 'c-keyword' : 'c-fn' });
      else if (m[5]) out.push({ text: m[5], cls: KEYWORDS.has(m[5]) ? 'c-keyword' : (/^[A-Z]/.test(m[5]) ? 'c-type' : 'c-plain') });
      else if (m[6]) out.push({ text: m[6], cls: 'c-punct' });
      else out.push({ text: m[7] ?? m[8] ?? m[0], cls: 'c-plain' });
    }
    return out;
  }

  $: tokens = tokenize(code);
</script>

<div class="code-block">
  {#if label || $$slots.label}<p class="code-block-label"><slot name="label">{label}</slot></p>{/if}
  <pre><code>{#each tokens as t}<span class={t.cls}>{t.text}</span>{/each}</code></pre>
</div>

<style>
  .code-block { margin-top: var(--space-6); }
  .code-block-label { margin: 0 0 var(--space-3); color: var(--color-muted); font-size: 0.9rem; }
  pre {
    margin: 0;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-layer);
    overflow-x: auto;
  }
  code {
    font-family: 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--color-text);
    white-space: pre;
  }
  .c-plain { color: var(--color-text); }
  .c-punct { color: var(--color-muted); }
  .c-comment { color: var(--color-muted); font-style: italic; }
  .c-string { color: var(--color-green); }
  .c-number { color: var(--color-amber); }
  .c-keyword { color: var(--color-accent); }
  .c-type { color: var(--color-blue); }
  .c-fn { color: var(--color-blue); }
</style>
