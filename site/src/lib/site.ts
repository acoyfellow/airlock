export const site = {
  name: 'airlock',
  title: 'airlock: your app stays off live traffic until its tests pass',
  description:
    'A small pipeline for a web app, Worker, or site. You push a candidate build, it deploys to a slot that serves no traffic, runs the tests in parallel, and makes that build live only if a signed proof says the tests passed.',
  url: 'https://airlock.coey.dev',
} as const;

export type StepState = 'produce' | 'gate' | 'promote';

export type PipelineStep = {
  readonly index: string;
  readonly title: string;
  readonly call: string;
  readonly body: string;
  readonly state: StepState;
};

// Mirrors runPipeline() in src/pipeline.ts, step for step.
export const pipeline: readonly PipelineStep[] = [
  {
    index: '01',
    title: 'Deploy',
    call: 'deploy(candidate)',
    body: 'A push supplies a candidate build of your app; the examples label it with a content digest. The candidate is deployed to a slot that serves no traffic. Deploying does not make it live.',
    state: 'produce',
  },
  {
    index: '02',
    title: 'Fanout',
    call: 'runFanout(jobs, slot)',
    body: 'Test jobs run in parallel against the deployed slot and join into results. The evidence string is name=pass|fail across every job.',
    state: 'produce',
  },
  {
    index: '03',
    title: 'Verify',
    call: 'verifySignedProof(proof, candidate, trusted)',
    body: 'The signer signs the test result, bound to the exact candidate digest. The proof is then checked against the trusted keys.',
    state: 'gate',
  },
  {
    index: '04',
    title: 'Promote',
    call: 'setFeatureGate(candidate, true)',
    body: 'setFeatureGate runs on both paths, with on=true or on=false. The pointer only moves if the supplied promoter accepts that decision.',
    state: 'promote',
  },
] as const;

export type PortRow = {
  readonly port: string;
  readonly type: string;
  readonly role: string;
};

export const ports: readonly PortRow[] = [
  { port: 'runFanout', type: '(jobs, slot) => Promise<{ name, ok, detail }[]>', role: 'Runs the test jobs in parallel against the deployed slot; each result becomes one name=pass|fail term in the evidence string.' },
  { port: 'deploy', type: '(candidate) => Promise<DeploySlot>', role: 'Puts the candidate on a slot that serves no traffic; returns the URL it answers on.' },
  { port: 'setFeatureGate', type: '(candidate, on) => Promise<PromotionEffect>', role: 'Reports whether caller-owned code changed production or only recorded a request.' },
  { port: 'sign', type: '(candidate, evidence, pass) => SignedProof — sync, private key in-process', role: 'Signs the result. No async signer (KMS/HSM); the key must be resident here.' },
  { port: 'trusted', type: 'TrustedKeys', role: 'The set of keys a proof is checked against.' },
] as const;

export type FanoutStatus = 'ships' | 'prototype' | 'proven' | 'target';

export type FanoutBackend = {
  readonly name: string;
  readonly status: FanoutStatus;
  readonly body: string;
  readonly run?: { readonly command: string; readonly href: string };
};

export const fanoutBackends: readonly FanoutBackend[] = [
  { name: 'cloudflare', status: 'proven', body: 'A real Durable Object per check — deployed, and isolation empirically proven, not just described: a planted orchestrator secret leaked through local, and did not leak through this backend. Narrower than local or terrarium today: Workers block eval/new Function, so a check is one of a small fixed set of kinds; jobs that do not match a kind fall back to unisolated local.', run: { command: 'bun run isolation-proof', href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/isolation-proof' } },
  { name: 'local', status: 'ships', body: 'Where you start: a Promise.all that records a thrown test as a failure instead of crashing. This is localFanout, the backend the napkin uses. Nothing is isolated: a hostile check runs in your process.' },
  { name: 'terrarium', status: 'prototype', body: 'Each test is a bounded child process, joined when they finish. Real local containment exists (Docker-based, tested) as an upgrade from local. Cloud-hosted isolation is terrarium\'s roadmap, not shipped — do not assume it runs untrusted code for you today.' },
] as const;

export const quickStart = [
  { command: 'bun install', note: 'install the orchestration and site workspace' },
  { command: 'bun test', note: '30 pass: pipeline, napkin, ports, and site copy' },
  { command: 'bun run napkin', note: 'A goes live, B is blocked on a failing test, the previous version stays live' },
] as const;

// A real, captured transcript (not paraphrased marketing copy) of running the
// three quickStart commands against this repo. Digests are truncated with an
// ellipsis, the same convention git and sha256sum use — nothing here is invented.
export type TerminalLine = { readonly kind: 'prompt' | 'output' | 'ok' | 'fail' | 'blank'; readonly text?: string };

export const terminalSession: readonly TerminalLine[] = [
  { kind: 'prompt', text: 'bun install' },
  { kind: 'blank' },
  { kind: 'prompt', text: 'bun test' },
  { kind: 'ok', text: '30 pass' },
  { kind: 'output', text: '0 fail' },
  { kind: 'output', text: 'Ran 30 tests across 4 files.' },
  { kind: 'blank' },
  { kind: 'prompt', text: 'bun run napkin' },
  { kind: 'output', text: "agent push A: bundle 'app@A \u2014 all tests pass'" },
  { kind: 'ok', text: '  admitted       true' },
  { kind: 'ok', text: '  promoted       true' },
  { kind: 'output', text: '  webapp serves  [200] sha256:3913\u2026 "app@A \u2014 all tests pass"' },
  { kind: 'blank' },
  { kind: 'output', text: "agent push B: bundle 'app@B \u2014 integration fails'" },
  { kind: 'fail', text: '  admitted       false' },
  { kind: 'fail', text: '  promoted       false' },
  { kind: 'output', text: '  webapp serves  [200] sha256:3913\u2026 "app@A \u2014 all tests pass"' },
  { kind: 'blank' },
  { kind: 'ok', text: 'PASS: A served, B blocked, prior version held, feature=test+flag holds' },
] as const;

export const boundaries = [
  'airlock does not deploy, sign, or decide which keys to trust on its own; every effect is a port the caller supplies.',
  'airlock does not make a candidate live without a verified proof bound to that exact digest.',
  'localFanout runs the test jobs in-process; isolating untrusted jobs is the job of a different backend.',
  'The napkin is file-backed under .data/, not a real deployment; airlock.coey.dev is not pointed at a pipeline-promoted candidate.',
] as const;

export type ExperimentLink = {
  readonly name: string;
  readonly claim: string;
  readonly result: string;
  readonly href: string;
};

// Real, rerunnable, receipt-backed experiments in this repo. Each row is a
// claim this page makes elsewhere, tested against real deployed Cloudflare
// infrastructure — not asserted, run. `bun run <name>` reproduces it.
export const experiments: readonly ExperimentLink[] = [
  {
    name: 'launch-proof',
    claim: 'the exact Airlock and Keel launch claims can be reproduced from one command and checked without trusting its PASS lines.',
    result: 'One integrated receipt exercises Airlock runPipeline plus the pinned Keel dependency: a passing candidate is selected; a failed check leaves the prior candidate selected; a cryptographically valid signature from a revoked key is refused; and a stale promotion cannot overwrite a newer baseline. The independent verifier checks 18/18 conditions.',
    href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/launch-proof',
  },
  {
    name: 'fleet',
    claim: 'independent workers can commit from one base, surface collisions, retain compatible task contracts, and block incompatible ones before one candidate is admitted.',
    result: 'Protocol spike confirmed locally: five distinct OS processes made five commits from one base; naive integration hit a real app.json conflict; three compatible contracts survived; two incompatible timeout contracts were explicitly blocked; the combined candidate passed 15 independent receipt checks. The workers are deterministic scripts, not autonomous model agents.',
    href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/fleet',
  },
  {
    name: 'isolation-proof',
    claim: 'local runs a check in the orchestrator\'s process; a Durable Object per check isolates the kinds Workers can run.',
    result: 'Confirmed live: a planted orchestrator secret leaked through local, did not leak through the Cloudflare backend, and storage was not shared across two different jobs in one fanout call.',
    href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/isolation-proof',
  },
  {
    name: 'swarm',
    claim: 'a real swarm of agents pushing at once resolves by compare-and-swap; the loser is refused, not overwritten.',
    result: 'Three independent live runs (12, 25, 20 real concurrent OS processes): exactly one admitted each time, everyone else refused with stale-version, zero double-admits.',
    href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/swarm',
  },
  {
    name: 'live-demo',
    claim: 'the real pipeline can be watched happening live, not read about after the fact.',
    result: 'Verified with an independent WebSocket listener: every real step (candidate, sign, fanout, verify, promoted) arrived live, in order, matching the terminal exactly — including the real failure path.',
    href: 'https://github.com/acoyfellow/airlock/tree/main/experiments/live-demo',
  },
] as const;
