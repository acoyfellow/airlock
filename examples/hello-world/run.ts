// Hello world for the new sdlc: one push, fanned-out tests, keel-gated promote.
// Runs the pipeline twice: a green candidate promotes; a candidate with one
// failing test is blocked, and the feature gate stays off.

import { makeKeyPair } from "keel";
import { runPipeline, localFanout, makeProof, signProof, type Ports, type TestJob } from "../../src/pipeline.ts";

const owner = makeKeyPair();
const trusted = { [owner.keyId]: owner.publicPem };

// the feature gate this pipeline controls
let liveCandidate = "none";

const ports: Ports = {
  runFanout: localFanout, // swap for terrarium / Cloudflare Facets in production
  deploy: async (c) => {
    console.log(`  deploy   -> candidate ${c} to a non-serving slot`);
    return { url: `https://dark.example/${c}` };
  },
  setFeatureGate: async (c, on) => {
    if (on) liveCandidate = c;
    console.log(`  gate     -> ${on ? `ON for ${c}` : "left OFF"}`);
  },
  sign: (candidate, evidence, pass) =>
    signProof(
      makeProof({ artifactDigest: candidate, verifier: owner.keyId, policy: "fanout-tests@1", result: pass ? "pass" : "fail", evidence }),
      owner.keyId,
      owner.privatePem,
    ),
  trusted,
};

const greenJobs: TestJob[] = [
  { name: "unit", run: () => ({ name: "unit", ok: true, detail: "12/12" }) },
  { name: "smoke", run: async () => ({ name: "smoke", ok: true, detail: "200 ok" }) },
  { name: "lint", run: () => ({ name: "lint", ok: true, detail: "clean" }) },
];

async function main() {
  console.log("push: agent -> artifacts repo, candidate sha-green-001");
  const ok = await runPipeline({ repo: "demo/app", candidate: "sha-green-001" }, greenJobs, ports);
  console.log(`  result   -> admitted=${ok.admitted} promoted=${ok.promoted} (${ok.evidence})\n`);

  const redJobs: TestJob[] = [...greenJobs, { name: "integration", run: () => ({ name: "integration", ok: false, detail: "timeout" }) }];
  console.log("push: agent -> artifacts repo, candidate sha-red-002 (one test fails)");
  const bad = await runPipeline({ repo: "demo/app", candidate: "sha-red-002" }, redJobs, ports);
  console.log(`  result   -> admitted=${bad.admitted} promoted=${bad.promoted} reason=${bad.reason} (${bad.evidence})\n`);

  const pass = ok.promoted && !bad.promoted && liveCandidate === "sha-green-001";
  console.log(`live feature gate: ${liveCandidate}`);
  console.log(pass ? "PASS: green promoted, red blocked, gate holds the good candidate" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main();
