// SWARM EXPERIMENT: N independent real OS processes, each an "agent" that
// produces a candidate and races every other agent to promote it against ONE
// shared real registry (a Cloudflare Durable Object doing a real
// compare-and-swap: experiments/swarm/registry-worker).
//
// This is not simulated concurrency. Each agent is `bun run agent.ts` spawned
// as its own child process via node:child_process — genuinely separate OS
// processes hitting the same network endpoint at close to the same instant.
// The registry's CAS is provided by the Cloudflare runtime (one Durable
// Object instance processes one request at a time), not by anything this
// script coordinates.
//
//   bun run experiments/swarm/run.ts [N]
//
// Produces experiments/swarm/RECEIPT.json: how many agents ran, how many were
// admitted, whether more than one was ever admitted for the same version
// (would mean the CAS is broken), and the full admit log from the registry
// itself (not from what the agents claim).

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REGISTRY_URL = process.env.REGISTRY_URL ?? "https://airlock-swarm-registry.coy.workers.dev";
const N = Number(process.argv[2] ?? 12);
const REPO_ROOT = join(import.meta.dir, "../..");

type AgentOutput = {
  agent: string;
  candidate?: string;
  admitted: boolean;
  reason?: string;
  version?: number;
  observedVersionBeforeRace?: number;
  proofVerified?: boolean;
};

function spawnAgent(agentId: string): Promise<AgentOutput> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", join(import.meta.dir, "agent.ts")], {
      cwd: REPO_ROOT,
      env: { ...process.env, SWARM_AGENT_ID: agentId, REGISTRY_URL },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", () => {
      const line = stdout.trim().split("\n").pop() ?? "";
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ agent: agentId, admitted: false, reason: `unparseable output: ${stdout.slice(0, 300)} stderr=${stderr.slice(0, 300)}` });
      }
    });
  });
}

async function main() {
  console.log(`swarm: resetting registry, then launching ${N} real concurrent OS-process agents...\n`);
  await fetch(`${REGISTRY_URL}/reset`, { method: "POST" });

  const agentIds = Array.from({ length: N }, (_, i) => `agent-${i + 1}`);
  const started = Date.now();

  // ALL agents launched in the same tick, no staggering — this is the actual
  // "swarm pushes at once" scenario, not a queued sequence.
  const results = await Promise.all(agentIds.map((id) => spawnAgent(id)));
  const elapsedMs = Date.now() - started;

  const admitted = results.filter((r) => r.admitted);
  const refused = results.filter((r) => !r.admitted);

  console.log("results:");
  for (const r of results) {
    console.log(`  [${r.admitted ? "ADMITTED" : "refused "}] ${r.agent} ${r.reason ?? `version=${r.version}`}`);
  }

  // Fetch the registry's OWN log — the source of truth, independent of what
  // any agent claimed about itself.
  const stateRes = await fetch(`${REGISTRY_URL}/state`);
  const finalState = (await stateRes.json()) as { served: string; version: number; log: unknown[] };

  // The correctness property under test: with a real CAS, at most ONE agent
  // should ever be admitted per version number. If two different agents both
  // got admitted=true for the same resulting version, the CAS is broken.
  const admittedVersions = admitted.map((r) => r.version);
  const uniqueVersions = new Set(admittedVersions);
  const casHeld = admittedVersions.length === uniqueVersions.size;

  const receipt = {
    experiment: "swarm",
    ranAt: new Date().toISOString(),
    registryUrl: REGISTRY_URL,
    agentCount: N,
    elapsedMs,
    admittedCount: admitted.length,
    refusedCount: refused.length,
    finalServed: finalState.served,
    finalVersion: finalState.version,
    casHeld,
    verdict: casHeld
      ? `CAS HELD — ${admitted.length}/${N} agents admitted, each to a distinct version, no double-admits under real concurrent load`
      : `CAS VIOLATED — two or more agents were admitted to the same version (${JSON.stringify([...admittedVersions])})`,
    registryLog: finalState.log,
    agentResults: results,
  };

  writeFileSync(join(import.meta.dir, "RECEIPT.json"), JSON.stringify(receipt, null, 2));
  console.log(`\n${N} agents, ${elapsedMs}ms wall clock, ${admitted.length} admitted, ${refused.length} refused.`);
  console.log(`final served: ${finalState.served} (version ${finalState.version})`);
  console.log(receipt.verdict);
  console.log("receipt written to experiments/swarm/RECEIPT.json");
}

main();
