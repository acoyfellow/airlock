// ISOLATION PROOF: does the docs' claim hold up?
//
//   local backend:      "nothing is isolated yet — a hostile check runs in
//                        your process" (site/src/lib/site.ts)
//   cloudflare backend: each check runs in its own Durable Object isolate
//                        (experiments/isolation-proof/worker)
//
// This script plants a real secret in THIS process (the orchestrator), then
// runs the SAME hostile intent — "read whatever the orchestrator can see" —
// through both backends, and reports whether each one actually leaked it.
// It does not assert an answer; it runs the check and prints what happened.
//
//   bun run experiments/isolation-proof/run.ts

import { localFanout, type TestJob } from "../../src/pipeline.ts";
import { makeCloudflareFanout, type CloudflareJob } from "../../src/ports/cloudflare-fanout.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHECKRUNNER_URL = process.env.CHECKRUNNER_URL ?? "https://airlock-checkrunner.coy.workers.dev";
const SLOT_URL = "https://airlock.coey.dev"; // any real reachable URL; content doesn't matter here

// The secret a real orchestrator would hold: an API token, a signing key, etc.
// Planted as a module-level variable in THIS process, exactly where a real
// deploy/sign/promote credential would live.
const ORCHESTRATOR_SECRET = "sk_live_do_not_leak_" + Math.random().toString(36).slice(2);
process.env.AIRLOCK_ORCHESTRATOR_SECRET = ORCHESTRATOR_SECRET;

type Finding = {
  backend: "local" | "cloudflare";
  check: string;
  leaked: boolean;
  detail: string;
};

const findings: Finding[] = [];

async function runLocalHostileCheck() {
  // A "hostile check" in the local backend is just a TestJob — its `run()`
  // executes as a normal function call in this same Node/Bun process. It has
  // the same access to module state, process.env, and closures as any other
  // code running here, because it IS code running here.
  const hostileJob: TestJob = {
    name: "hostile-read-orchestrator-secret",
    run: () => {
      const leaked = process.env.AIRLOCK_ORCHESTRATOR_SECRET;
      return {
        name: "hostile-read-orchestrator-secret",
        ok: leaked !== ORCHESTRATOR_SECRET, // ok=true would mean NOT leaked
        detail:
          leaked === ORCHESTRATOR_SECRET
            ? `LEAKED: read the real orchestrator secret via process.env (${leaked.slice(0, 12)}…)`
            : "did not read the secret",
      };
    },
  };

  const [result] = await localFanout([hostileJob], { url: SLOT_URL });
  findings.push({
    backend: "local",
    check: "read-orchestrator-secret",
    leaked: !result.ok,
    detail: result.detail,
  });
}

async function runCloudflareHostileCheck() {
  // The Cloudflare backend's equivalent hostile intent: try to read whatever
  // env/bindings are reachable from inside the isolate that runs the check.
  // The orchestrator's secret above was never sent to the Cloudflare Worker
  // at all — it exists only in this Node/Bun process. If the DO isolate can
  // somehow still observe it, that is a real leak across a process boundary,
  // which would be a much worse finding than the local case.
  const fanout = makeCloudflareFanout({ checkrunnerUrl: CHECKRUNNER_URL });
  const job: CloudflareJob = { name: "hostile-read-global-env", backend: "cloudflare", kind: "read-global-env" };

  const [result] = await fanout([job], { url: SLOT_URL });
  findings.push({
    backend: "cloudflare",
    check: "read-orchestrator-secret-or-any-binding",
    leaked: !result.ok,
    detail: result.detail,
  });
}

async function runCloudflareStorageIsolation() {
  const fanout = makeCloudflareFanout({ checkrunnerUrl: CHECKRUNNER_URL });
  const jobA: CloudflareJob = { name: "job-a-plants-nothing-reads-fresh", backend: "cloudflare", kind: "read-do-storage" };
  const jobB: CloudflareJob = { name: "job-b-plants-nothing-reads-fresh", backend: "cloudflare", kind: "read-do-storage" };

  // Two DIFFERENT check jobs, same fanout call. If they shared a DO instance
  // (a bug in the isolation guarantee), job B could observe state job A left
  // behind. Both use fresh newUniqueId() instances per the checkrunner Worker,
  // so both should report "empty on first read."
  const [resultA, resultB] = await fanout([jobA, jobB], { url: SLOT_URL });
  findings.push({
    backend: "cloudflare",
    check: "storage-not-shared-across-two-different-jobs-in-one-fanout-call",
    leaked: !resultA.ok || !resultB.ok,
    detail: `jobA: ${resultA.detail} | jobB: ${resultB.detail}`,
  });
}

async function main() {
  console.log("isolation-proof: planting a real orchestrator secret in this process, then");
  console.log("running the same hostile intent through local and cloudflare fanout.\n");

  await runLocalHostileCheck();
  await runCloudflareHostileCheck();
  await runCloudflareStorageIsolation();

  console.log("findings:");
  for (const f of findings) {
    const tag = f.leaked ? "LEAK" : "contained";
    console.log(`  [${tag.padEnd(9)}] ${f.backend.padEnd(10)} ${f.check}`);
    console.log(`             ${f.detail}`);
  }

  // The claim under test has TWO parts: (1) local SHOULD leak (that is the
  // documented, expected gap), and (2) cloudflare should NOT leak. The claim
  // holds only if both parts match what actually happened.
  const localLeaked = findings.find((f) => f.backend === "local")?.leaked ?? false;
  const cloudflareLeaked = findings.some((f) => f.backend === "cloudflare" && f.leaked);
  const claimHolds = localLeaked === true && cloudflareLeaked === false;
  const receipt = {
    experiment: "isolation-proof",
    ranAt: new Date().toISOString(),
    checkrunnerUrl: CHECKRUNNER_URL,
    claim: "docs say: local backend does not isolate (hostile check runs in your process); cloudflare backend (Durable Object per check) does isolate.",
    findings,
    localLeakedAsExpected: localLeaked,
    cloudflareLeaked,
    verdict: claimHolds
      ? "CLAIM HOLDS — local leaked exactly as documented, cloudflare did not leak in any of the tested checks"
      : "CLAIM FALSIFIED — actual behavior did not match the documented claim, see findings",
  };

  writeFileSync(join(import.meta.dir, "RECEIPT.json"), JSON.stringify(receipt, null, 2));
  console.log(`\n${receipt.verdict}`);
  console.log("receipt written to experiments/isolation-proof/RECEIPT.json");
}

main();
