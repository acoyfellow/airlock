// The "new sdlc" hello world: a push to a content-addressed repo triggers a
// deploy, fans out tests in parallel, and promotes the feature gate only when
// keel admits the result. The pipeline is the orchestration; the fanout backend
// and the deploy/promote effects are injected ports.
//
//   agent -> artifacts repo --(on push)--> deploy -> fanout^x tests -> promote
//
// fanout^x backends that fit `runFanout`:
//   - terrarium: each test is a bounded child agent run, joined.
//   - cloudflare: Workflow steps, or Durable Object Facets, one per test.
//   - local: Promise.all (this hello world).

import {
  makeProof,
  signProof,
  verifySignedProof,
  type SignedProof,
  type TrustedKeys,
} from "keel";

export type TestResult = { name: string; ok: boolean; detail: string };
// A unit job runs in-process; an integration job is a probe a fanout backend
// expands against the deployed slot. `run` is optional so backend-only jobs
// (e.g. a terrarium route probe) need not carry an in-process function.
export type TestJob = { name: string; run?: () => Promise<TestResult> | TestResult };

// The fanout port. Receives the dark slot so integration tests can hit it.
// Default is local Promise.all; swap for terrarium or Facets.
export type RunFanout = (jobs: TestJob[], slot: DeploySlot) => Promise<TestResult[]>;

export const localFanout: RunFanout = (jobs) =>
  Promise.all(
    jobs.map(async (j) => {
      try {
        if (!j.run) return { name: j.name, ok: false, detail: "no in-process run()" };
        return await j.run();
      } catch (e) {
        return { name: j.name, ok: false, detail: (e as Error).message };
      }
    }),
  );

export type PushEvent = { repo: string; candidate: string };

// A dark slot: where the candidate is now served WITHOUT taking prod traffic.
export type DeploySlot = { url: string; detail?: string };

export type Ports = {
  runFanout: RunFanout;
  // deploy to a NON-serving slot; returns the dark URL the slot now answers on
  deploy: (candidate: string) => Promise<DeploySlot>;
  setFeatureGate: (candidate: string, on: boolean) => Promise<void>;
  // the owner/verifier signs what the fanout observed, bound to the candidate
  sign: (candidate: string, evidence: string, pass: boolean) => SignedProof;
  trusted: TrustedKeys;
};

export type PipelineReceipt = {
  candidate: string;
  slot: DeploySlot;
  results: TestResult[];
  evidence: string;
  proof: SignedProof;
  admitted: boolean;
  promoted: boolean;
  reason: string;
};

export async function runPipeline(event: PushEvent, jobs: TestJob[], ports: Ports): Promise<PipelineReceipt> {
  // 1. deploy the candidate to a slot that serves no traffic yet
  const slot = await ports.deploy(event.candidate);

  // 2. fanout^x tests (run against the dark slot)
  const results = await ports.runFanout(jobs, slot);
  const passed = results.every((r) => r.ok);
  const evidence = results.map((r) => `${r.name}=${r.ok ? "pass" : "fail"}`).join(",");

  // 3. keel is the gate: a signed proof bound to this exact candidate must admit
  const proof = ports.sign(event.candidate, evidence, passed);
  const decision = verifySignedProof(proof, event.candidate, ports.trusted);

  if (!decision.admitted) {
    await ports.setFeatureGate(event.candidate, false);
    return { candidate: event.candidate, slot, results, evidence, proof, admitted: false, promoted: false, reason: decision.reason };
  }

  // 4. promote the feature gate (the only promote effect; human-gated for prod)
  await ports.setFeatureGate(event.candidate, true);
  return { candidate: event.candidate, slot, results, evidence, proof, admitted: true, promoted: true, reason: "proof passed" };
}

// Re-exported so a caller can sign without importing keel directly.
export { makeProof, signProof };
