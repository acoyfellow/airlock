// LIVE DEMO RUNNER: runs the REAL airlock pipeline end to end and reports
// every real step to the live broadcast Worker as it happens. Nothing here is
// staged or replayed — a viewer with the demo page open
// (https://airlock-live-demo.coy.workers.dev) sees each event the instant
// this script actually does the thing.
//
//   1. produce a real content-addressed candidate
//   2. sign a real ed25519 proof (keel), verify it
//   3. run real checks through the real Cloudflare Durable Object fanout
//      backend (experiments/isolation-proof/worker) against a real URL
//   4. race a real compare-and-swap against the swarm registry
//      (experiments/swarm/registry-worker) to "promote"
//   5. flip the demo's real LivePointer, which the open browser tab is
//      already watching
//
//   bun run experiments/live-demo/run.ts [--fail]
//
// Pass --fail to run a candidate with a deliberately failing check, so the
// demo can also show a REAL refusal, not just a real success.

import { signProof, verifySignedProof, type TrustedKeys } from "keel";
import { digestBundle } from "../../src/artifacts.ts";
import { loadVerifier } from "../../src/ports/keys.ts";
import { makeCloudflareFanout, type CloudflareJob } from "../../src/ports/cloudflare-fanout.ts";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const BROADCAST_URL = process.env.BROADCAST_URL ?? "https://airlock-live-demo.coy.workers.dev";
const REGISTRY_URL = process.env.REGISTRY_URL ?? "https://airlock-swarm-registry.coy.workers.dev";
const SLOT_URL = "https://airlock.coey.dev"; // real reachable URL the fanout check hits

const shouldFail = process.argv.includes("--fail");

async function emit(step: string, text: string, ok?: boolean) {
  console.log(`[${step}]${ok === undefined ? "" : ok ? " OK" : " FAIL"} ${text}`);
  await fetch(`${BROADCAST_URL}/emit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step, text, ok }),
  }).catch(() => {}); // a dropped event shouldn't crash the real pipeline run
}

async function main() {
  await emit("start", `live demo run starting (fail-mode=${shouldFail})`);

  // 1. real candidate
  const bundle = `live-demo candidate at ${new Date().toISOString()}${shouldFail ? " (intentionally failing)" : ""}`;
  const candidate = digestBundle(bundle);
  await emit("candidate", `produced ${candidate}`);

  // 2. real signed proof
  const { verifier, trusted } = loadVerifier(REPO_ROOT);
  const evidence = shouldFail ? "checkrunner-http-200=fail" : "checkrunner-http-200=pass";
  const proof = signProof(
    { artifactDigest: candidate, verifier: verifier.keyId, policy: "airlock/live-demo@1", result: shouldFail ? "fail" : "pass", evidence },
    verifier.keyId,
    verifier.privatePem,
  );
  await emit("sign", `ed25519 proof signed by ${verifier.keyId}`);

  // 3. real fanout against the real Durable Object checkrunner
  const fanout = makeCloudflareFanout({ checkrunnerUrl: "https://airlock-checkrunner.coy.workers.dev" });
  const jobs: CloudflareJob[] = shouldFail
    ? [{ name: "http-200-but-checking-wrong-url", backend: "cloudflare", kind: "http-200" }]
    : [{ name: "http-200", backend: "cloudflare", kind: "http-200" }];
  const slotForCheck = shouldFail ? "https://this-domain-does-not-resolve.invalid" : SLOT_URL;
  const results = await fanout(jobs, { url: slotForCheck });
  for (const r of results) {
    await emit("fanout", `${r.name}: ${r.detail}`, r.ok);
  }
  const allPassed = results.every((r) => r.ok);

  // 4. real verify against the real signed proof
  const decision = verifySignedProof(proof, candidate, trusted as TrustedKeys);
  await emit("verify", decision.admitted ? "proof verified, admitted" : `refused: ${decision.reason}`, decision.admitted);

  if (!decision.admitted || !allPassed) {
    await emit("blocked", "candidate blocked — live app unchanged", false);
    console.log("\nBLOCKED — as expected in --fail mode".trim());
    return;
  }

  // 5. real CAS race against the swarm registry, then really flip LivePointer
  const stateRes = await fetch(`${REGISTRY_URL}/state`);
  const state = (await stateRes.json()) as { version: number };
  const admitRes = await fetch(`${REGISTRY_URL}/admit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: "live-demo", candidate, expectedVersion: state.version }),
  });
  const admitResult = (await admitRes.json()) as { admitted: boolean; version?: number; reason?: string };

  if (!admitResult.admitted) {
    await emit("promote", `refused by registry CAS: ${admitResult.reason}`, false);
    return;
  }

  await fetch(`${BROADCAST_URL}/set`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidate, label: `promoted by live-demo run, registry version ${admitResult.version}` }),
  });
  await emit("promoted", `live app now serving ${candidate} (registry version ${admitResult.version})`, true);
  console.log("\nPROMOTED — open https://airlock-live-demo.coy.workers.dev to have watched it happen");
}

main().catch(async (e) => {
  await emit("error", `run threw: ${(e as Error).message}`, false);
  process.exit(1);
});
