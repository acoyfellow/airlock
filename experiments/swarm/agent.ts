// ONE swarm agent's real work, run as its own OS process (spawned by run.ts).
// Not a simulated function call — this file is executed via `bun run` as a
// genuinely separate child process, so its race against the registry is a
// real concurrent-process race, not JS-event-loop-serialized async.
//
//   1. produce a real, unique candidate (content-addressed, this agent's id
//      baked into the content so no two agents can collide)
//   2. sign a real ed25519 proof over it (keel), against the SAME trusted key
//      every agent in the swarm shares
//   3. read the registry's CURRENT version (a real network round-trip — by
//      the time this agent tries to admit, another agent may have already
//      moved it)
//   4. race to /admit against the real airlock-swarm-registry Worker
//
// Prints one JSON line to stdout: { agent, candidate, admitted, ... }. run.ts
// parses that line; it does not trust anything else the child prints.

import { signProof, verifySignedProof, type TrustedKeys } from "keel";
import { digestBundle } from "../../src/artifacts.ts";
import { loadVerifier } from "../../src/ports/keys.ts";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const REGISTRY_URL = process.env.REGISTRY_URL ?? "https://airlock-swarm.coey.dev";
const AGENT_ID = process.env.SWARM_AGENT_ID ?? "unknown-agent";

async function main() {
  // A real content-addressed candidate: this agent's id + a timestamp is the
  // "work" it produced. Every agent's bundle is genuinely different content,
  // so every candidate digest is genuinely different — no fake collisions.
  const bundle = `swarm-candidate from ${AGENT_ID} at ${Date.now()} pid=${process.pid}`;
  const candidate = digestBundle(bundle);

  // Every agent signs with the SAME shared trusted key (loaded from the same
  // bootstrap file this repo already uses for dogfood) — a real proof, not a
  // stub. If a proof doesn't verify, that agent gets refused before it even
  // reaches the registry, same as the real pipeline would refuse it.
  const { verifier, trusted } = loadVerifier(REPO_ROOT);
  const evidence = "swarm-smoke=pass";
  const proof = signProof(
    { artifactDigest: candidate, verifier: verifier.keyId, policy: "airlock/swarm@1", result: "pass", evidence },
    verifier.keyId,
    verifier.privatePem,
  );
  const decision = verifySignedProof(proof, candidate, trusted as TrustedKeys);
  if (!decision.admitted) {
    console.log(JSON.stringify({ agent: AGENT_ID, candidate, admitted: false, reason: `proof-rejected: ${decision.reason}` }));
    return;
  }

  // Read the real current registry state right before racing to admit — a
  // genuine network round trip against the shared Durable Object, exactly
  // where a real race window opens between "I checked" and "I write."
  const stateRes = await fetch(`${REGISTRY_URL}/state`);
  const state = (await stateRes.json()) as { served: string; version: number };

  const admitRes = await fetch(`${REGISTRY_URL}/admit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: AGENT_ID, candidate, expectedVersion: state.version }),
  });
  const admitResult = (await admitRes.json()) as
    | { admitted: true; candidate: string; version: number }
    | { admitted: false; reason: string; currentServed: string; currentVersion: number };

  console.log(
    JSON.stringify({
      agent: AGENT_ID,
      candidate,
      proofVerified: true,
      observedVersionBeforeRace: state.version,
      ...admitResult,
    }),
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ agent: AGENT_ID, admitted: false, reason: `threw: ${(e as Error).message}` }));
  process.exit(1);
});
