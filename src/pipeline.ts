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
} from "../../keel/src/index.ts";

export type TestResult = { name: string; ok: boolean; detail: string };
export type TestJob = { name: string; run: () => Promise<TestResult> | TestResult };

// The fanout port. Default is local Promise.all; swap for terrarium or Facets.
export type RunFanout = (jobs: TestJob[]) => Promise<TestResult[]>;

export const localFanout: RunFanout = (jobs) =>
  Promise.all(
    jobs.map(async (j) => {
      try {
        return await j.run();
      } catch (e) {
        return { name: j.name, ok: false, detail: (e as Error).message };
      }
    }),
  );

export type PushEvent = { repo: string; candidate: string };

export type Ports = {
  runFanout: RunFanout;
  deploy: (candidate: string) => Promise<void>; // deploy to a non-serving slot
  setFeatureGate: (candidate: string, on: boolean) => Promise<void>;
  // the owner/verifier signs what the fanout observed, bound to the candidate
  sign: (candidate: string, evidence: string, pass: boolean) => SignedProof;
  trusted: TrustedKeys;
};

export type PipelineReceipt = {
  candidate: string;
  results: TestResult[];
  evidence: string;
  admitted: boolean;
  promoted: boolean;
  reason: string;
};

export async function runPipeline(event: PushEvent, jobs: TestJob[], ports: Ports): Promise<PipelineReceipt> {
  // 1. deploy the candidate to a slot that serves no traffic yet
  await ports.deploy(event.candidate);

  // 2. fanout^x tests
  const results = await ports.runFanout(jobs);
  const passed = results.every((r) => r.ok);
  const evidence = results.map((r) => `${r.name}=${r.ok ? "pass" : "fail"}`).join(",");

  // 3. keel is the gate: a signed proof bound to this exact candidate must admit
  const proof = ports.sign(event.candidate, evidence, passed);
  const decision = verifySignedProof(proof, event.candidate, ports.trusted);

  if (!decision.admitted) {
    await ports.setFeatureGate(event.candidate, false);
    return { candidate: event.candidate, results, evidence, admitted: false, promoted: false, reason: decision.reason };
  }

  // 4. promote the feature gate
  await ports.setFeatureGate(event.candidate, true);
  return { candidate: event.candidate, results, evidence, admitted: true, promoted: true, reason: "proof passed" };
}

// Re-exported so a caller can sign without importing keel directly.
export { makeProof, signProof };
