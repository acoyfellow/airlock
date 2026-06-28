export const site = {
  name: 'new-sdlc',
  title: 'new-sdlc: a candidate is promoted only when keel admits a signed proof',
  description:
    'A push deploys a candidate to a non-serving slot, fans out tests in parallel, and promotes the feature gate only when keel admits a signed proof bound to that exact candidate.',
  url: 'https://new-sdlc.coey.dev',
  repository: 'https://github.com/acoyfellow/new-sdlc',
  keel: 'https://github.com/acoyfellow/keel',
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
    title: 'Deploy to a non-serving slot',
    call: 'deploy(candidate)',
    body: 'A push names a candidate by content digest. The candidate is deployed to a slot that serves no traffic. Deploying is not promoting.',
    state: 'produce',
  },
  {
    index: '02',
    title: 'Fan out tests',
    call: 'runFanout(jobs)',
    body: 'Test jobs run in parallel and join into results. The evidence string is name=pass|fail across every job. This is the fanout^x port.',
    state: 'produce',
  },
  {
    index: '03',
    title: 'Sign, then keel admits',
    call: 'verifySignedProof(proof, candidate, trusted)',
    body: 'The verifier signs what fanout observed, bound to the exact candidate. keel admits or refuses that signed proof against the trusted keyring.',
    state: 'gate',
  },
  {
    index: '04',
    title: 'Promote the feature gate',
    call: 'setFeatureGate(candidate, true)',
    body: 'Only an admitted proof flips the gate on. A refused proof leaves the gate off and the running version in place.',
    state: 'promote',
  },
] as const;

export type PortRow = {
  readonly port: string;
  readonly type: string;
  readonly role: string;
};

export const ports: readonly PortRow[] = [
  { port: 'runFanout', type: '(jobs) => Promise<TestResult[]>', role: 'Run the test jobs in parallel. The fanout^x backend.' },
  { port: 'deploy', type: '(candidate) => Promise<void>', role: 'Put the candidate on a slot that serves no traffic.' },
  { port: 'setFeatureGate', type: '(candidate, on) => Promise<void>', role: 'The single promote effect. The only way a candidate goes live.' },
  { port: 'sign', type: '(candidate, evidence, pass) => SignedProof', role: 'The verifier signs what fanout observed, bound to the candidate.' },
  { port: 'trusted', type: 'TrustedKeys', role: 'The keyring keel checks admission against.' },
] as const;

export type FanoutBackend = {
  readonly name: string;
  readonly body: string;
};

export const fanoutBackends: readonly FanoutBackend[] = [
  { name: 'terrarium', body: 'Each test is a bounded child agent run, joined when they finish. A test can itself fan out, which is the fanout^x case.' },
  { name: 'cloudflare', body: 'Workflow steps, or Durable Object Facets, one per test, joined back into the results.' },
  { name: 'local', body: 'A Promise.all that turns a thrown test into a recorded failure. This is localFanout, used by the hello world.' },
] as const;

export const quickStart = [
  { command: 'bun install', note: 'install the orchestration and site workspace' },
  { command: 'bun test', note: 'run the deterministic pipeline tests' },
  { command: 'bun run hello', note: 'green candidate promoted, red blocked, gate holds the good one' },
] as const;

export const boundaries = [
  'new-sdlc does not deploy, sign, or promote on its own; every effect is an injected port.',
  'new-sdlc does not decide trust; keel admits or refuses the signed proof.',
  'new-sdlc does not promote a candidate without an admitted proof bound to that exact digest.',
  'The default localFanout is a reference backend; a real terrarium, Workflow, or Facet backend is the integrator job.',
] as const;
