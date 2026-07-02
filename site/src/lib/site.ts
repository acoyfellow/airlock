export const site = {
  name: 'airlock',
  title: 'airlock: a new version stays dark until its tests pass',
  description:
    'A small pipeline. You push a candidate version, it deploys to a slot that serves no traffic, runs the tests in parallel, and makes that version live only if a signed proof says the tests passed.',
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
    body: 'A push supplies a candidate label; the examples use a content digest. The candidate is deployed to a slot that serves no traffic. Deploying does not make it live.',
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
  { port: 'setFeatureGate', type: '(candidate, on) => Promise<void>', role: 'Flips the live pointer. The only way a candidate goes live.' },
  { port: 'sign', type: '(candidate, evidence, pass) => SignedProof — sync, private key in-process', role: 'Signs the result. No async signer (KMS/HSM); the key must be resident here.' },
  { port: 'trusted', type: 'TrustedKeys', role: 'The set of keys a proof is checked against.' },
] as const;

export type FanoutBackend = {
  readonly name: string;
  readonly body: string;
};

export const fanoutBackends: readonly FanoutBackend[] = [
  { name: 'local', body: 'A Promise.all that records a thrown test as a failure instead of crashing. This is localFanout, the backend the napkin uses.' },
  { name: 'terrarium', body: 'Each test is a bounded child agent run, joined when they finish.' },
  { name: 'cloudflare', body: 'Workflow steps, or Durable Object Facets, one per test, joined back into the results.' },
] as const;

export const quickStart = [
  { command: 'bun install', note: 'install the orchestration and site workspace' },
  { command: 'bun test', note: '29 pass: pipeline, napkin, ports, and site copy' },
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
  { kind: 'ok', text: '29 pass' },
  { kind: 'output', text: '0 fail' },
  { kind: 'output', text: 'Ran 29 tests across 4 files.' },
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
