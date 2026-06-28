// The runnable napkin: wires the real backends into one agent-driven flow.
//
//   agent.push(bundle)            artifacts.ts   content-address -> candidate
//     └─ onPush(candidate) ──────────────────────────────────────────────────
//          deploy(candidate)      deploy.ts      stage to a NON-serving slot
//          runFanout(jobs, slot)  pipeline.ts    fanout^x tests in parallel
//          gate.decide(...)       gate.ts        keel-gated signed promote
//          if promoted: webapp    serve.ts       serve THAT candidate's bytes
//
// runPipeline (pipeline.ts) stays the pure orchestration; this module supplies
// the real injectable backends and the agent-facing push entry. Everything is
// local + file-backed under .data/ (gitignored); the same shapes port to cloud.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  runPipeline,
  type DeploySlot,
  type Ports,
  type PipelineReceipt,
  type RunFanout,
  type TestJob,
  type TestResult,
} from "./pipeline.ts";
import type { SignedProof } from "../../keel/src/index.ts";
import { ArtifactsRepo, FileArtifactStore } from "./artifacts.ts";
import { SlotStore, makeLocalDeployer } from "./deploy.ts";
import { KeelGate, type Owner } from "./gate.ts";
import { Webapp, type FeatureDef } from "./serve.ts";

export type NapkinReceipt = {
  candidate: string;
  slot: DeploySlot;
  results: TestResult[];
  evidence: string;
  proof: SignedProof;
  admitted: boolean;
  promoted: boolean;
  reason: string;
  servedBefore: string | null;
  servedAfter: string | null;
};

/**
 * Build the whole napkin around one owner key and a .data/ root. Returns the
 * agent-facing `push` (push a bundle + jobs, watch it flow to served), plus the
 * webapp and gate so a caller can inspect served version, features, audit log.
 */
export function makeNapkin(opts: {
  owner: Owner;
  dataDir: string;
  features?: FeatureDef[];
  fanout?: RunFanout; // injectable; defaults to localFanout via pipeline
}) {
  mkdirSync(opts.dataDir, { recursive: true });
  const store = new FileArtifactStore(join(opts.dataDir, "artifacts"));
  const slots = new SlotStore(join(opts.dataDir, "slots.json"));
  const gate = new KeelGate(opts.owner);
  const webapp = new Webapp(store, opts.features ?? []);
  const deploy = makeLocalDeployer(slots);

  // The ports runPipeline orchestrates. deploy + runFanout are real; the gate
  // chain (sign/verify/promote/audit) is owned by KeelGate, so setFeatureGate
  // here only mirrors the served slot + webapp once the gate has admitted.
  const fanout: RunFanout =
    opts.fanout ??
    ((jobs, slot) =>
      Promise.all(
        jobs.map(async (j) => {
          try {
            if (!j.run) return { name: j.name, ok: false, detail: "no run()" };
            return await j.run();
          } catch (e) {
            return { name: j.name, ok: false, detail: (e as Error).message };
          }
        }),
      ));

  // Per-push state (single-flight; the napkin run is sequential by construction).
  const flight: { jobs: TestJob[]; servedBefore: string | null } = { jobs: [], servedBefore: null };

  // We do the gate decision (keel) inside push, around runPipeline, so the
  // signed promote + audit + served-slot effect are one atomic step. The Ports
  // passed to runPipeline use the gate's own sign/trusted so the proof keel
  // checks is the same proof we promote on.
  async function onPush(candidate: string): Promise<NapkinReceipt> {
    let lastResults: TestResult[] = [];
    const ports: Ports = {
      runFanout: async (jobs, slot) => {
        lastResults = await fanout(jobs, slot);
        return lastResults;
      },
      deploy,
      sign: (c, evidence, pass) => gate.sign(c, evidence, pass),
      trusted: gate.trusted,
      // setFeatureGate is the gate effect runPipeline calls on BOTH paths: with
      // on=true when its inline check admitted, on=false when it refused. We run
      // the real keel gate here on every push (RefStore CAS + signed audit) so a
      // blocked candidate is recorded too, and only flip the served slot + point
      // the webapp at the candidate when the gate truly promoted.
      setFeatureGate: async (c, _on) => {
        const outcome = gate.decide(c, lastResults);
        if (outcome.promoted) {
          slots.serve(c);
          webapp.setServed(c, lastResults);
        }
      },
    };

    const r: PipelineReceipt = await runPipeline({ repo: "napkin", candidate }, flight.jobs, ports);

    // Re-derive the authoritative served/promotion state from the gate so the
    // receipt reflects keel's decision, not just runPipeline's optimistic one.
    const servedAfter = webapp.servedVersion();
    const promoted = servedAfter === candidate;
    return {
      candidate,
      slot: r.slot,
      results: r.results,
      evidence: r.evidence,
      proof: r.proof,
      admitted: r.admitted,
      promoted,
      reason: promoted ? "proof passed" : r.reason,
      servedBefore: flight.servedBefore,
      servedAfter,
    };
  }

  const repo = new ArtifactsRepo(store, (c) => onPush(c));

  return {
    store,
    slots,
    gate,
    webapp,
    /** THE AGENT ENTRY: push a bundle + its tests, watch it flow to served. */
    async push(bundle: string, jobs: TestJob[]): Promise<NapkinReceipt> {
      flight.jobs = jobs;
      flight.servedBefore = webapp.servedVersion();
      const { result } = await repo.push(bundle);
      return result as NapkinReceipt;
    },
  };
}
