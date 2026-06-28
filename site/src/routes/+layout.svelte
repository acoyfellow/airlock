<script lang="ts">
  import '../app.css';
  import '$lib/primitives.css';
  import { receipt } from '$lib/receipt';
</script>

<svelte:head>
  <!-- Candidate identity carried on EVERY route. The honesty gate
       (experiments/dogfood/gate.mjs) recomputes the source digest independently
       and requires these to match on / and /docs, and that the evidence/verifier
       here equal the signed RECEIPT.json it verifies against a pinned key. -->
  <meta name="candidate-digest" content={receipt.candidate} />
  <meta name="candidate-admitted" content={String(receipt.admitted)} />
  <meta name="candidate-evidence" content={receipt.evidence} />
  <meta name="candidate-verifier" content={receipt.verifier} />
</svelte:head>

<slot />
