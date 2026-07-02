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
    title: 'Deploy to a slot that serves no traffic',
    call: 'deploy(candidate)',
    body: 'A push names a candidate by its content digest. The candidate is deployed to a slot that serves no traffic. Deploying does not make it live.',
    state: 'produce',
  },
  {
    index: '02',
    title: 'Run the tests in parallel',
    call: 'runFanout(jobs)',
    body: 'Test jobs run in parallel against the deployed slot and join into results. The evidence string is name=pass|fail across every job.',
    state: 'produce',
  },
  {
    index: '03',
    title: 'Verify the signed proof',
    call: 'verifySignedProof(proof, candidate, trusted)',
    body: 'The signer signs the test result, bound to the exact candidate digest. The proof is then checked against the trusted keys.',
    state: 'gate',
  },
  {
    index: '04',
    title: 'Flip the live pointer if the proof verifies',
    call: 'setFeatureGate(candidate, true)',
    body: 'If the proof verifies, the feature gate flips the live pointer to the candidate. If it does not, the pointer stays where it is.',
    state: 'promote',
  },
] as const;

export type PortRow = {
  readonly port: string;
  readonly type: string;
  readonly role: string;
};

export const ports: readonly PortRow[] = [
  { port: 'runFanout', type: '(jobs, slot) => Promise<TestResult[]>', role: 'Runs the test jobs in parallel against the deployed slot and returns the results.' },
  { port: 'deploy', type: '(candidate) => Promise<DeploySlot>', role: 'Puts the candidate on a slot that serves no traffic; returns the URL it answers on.' },
  { port: 'setFeatureGate', type: '(candidate, on) => Promise<void>', role: 'Flips the live pointer. The only way a candidate goes live.' },
  { port: 'sign', type: '(candidate, evidence, pass) => SignedProof', role: 'Signs the test result, bound to the candidate.' },
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

export const boundaries = [
  'airlock does not deploy, sign, or decide which keys to trust on its own; every effect is a port the caller supplies.',
  'airlock does not make a candidate live without a verified proof bound to that exact digest.',
  'localFanout runs the test jobs in-process; isolating untrusted jobs is the job of a different backend.',
  'The napkin is file-backed under .data/, not a real deployment; airlock.coey.dev is not pointed at a pipeline-promoted candidate.',
] as const;
