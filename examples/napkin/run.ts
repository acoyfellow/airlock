// THE AGENT-DRIVEN RUN of the napkin, end-to-end, local.
//
//   push candidate A (all tests pass)  -> flows through -> webapp SERVES A
//   push candidate B (one test fails)  -> keel BLOCKS B  -> webapp STILL serves A
//                                                        -> B's failing flag stays off
//
// The agent in the napkin diagram is THIS script. It pushes bundles to the
// content-addressed artifacts repo; everything downstream (deploy -> fanout ->
// keel gate -> serve) is real, file-backed under .data/ (gitignored). It prints
// a receipt per run: candidate, evidence, admitted, served-before/after.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { makeKeyPair } from "../../../keel/src/index.ts";
import { makeNapkin, type NapkinReceipt } from "../../src/napkin.ts";
import type { TestJob } from "../../src/pipeline.ts";

const REPO_ROOT = join(import.meta.dir, "../..");
const DATA_DIR = join(REPO_ROOT, ".data/napkin-run");

// fresh run: clear any prior local state so the demo is deterministic
rmSync(DATA_DIR, { recursive: true, force: true });

const owner = makeKeyPair();

// each feature = a test + a flag (serve.ts resolves the flag from served evidence)
const napkin = makeNapkin({
  owner,
  dataDir: DATA_DIR,
  features: [
    { name: "checkout", test: "unit" },
    { name: "search", test: "integration" }, // gated on the test B fails
  ],
});

// A: all green. Includes a deliberately slow job + a fast job so the parallel
// fanout is observable (fast finishes first under Promise.all).
const order: string[] = [];
const jobsA: TestJob[] = [
  { name: "unit", run: () => ({ name: "unit", ok: true, detail: "12/12" }) },
  { name: "lint", run: async () => { await Bun.sleep(15); order.push("lint"); return { name: "lint", ok: true, detail: "clean" }; } },
  { name: "integration", run: async () => { await Bun.sleep(2); order.push("integration"); return { name: "integration", ok: true, detail: "200 ok" }; } },
];

// B: same shape but integration FAILS (one failing job in the parallel fanout)
const jobsB: TestJob[] = [
  { name: "unit", run: () => ({ name: "unit", ok: true, detail: "12/12" }) },
  { name: "lint", run: async () => ({ name: "lint", ok: true, detail: "clean" }) },
  { name: "integration", run: () => ({ name: "integration", ok: false, detail: "timeout hitting /search" }) },
];

function receipt(label: string, r: NapkinReceipt): void {
  console.log(`--- receipt: ${label} ---`);
  console.log(`  candidate      ${r.candidate}`);
  console.log(`  slot           ${r.slot.url} (${r.slot.detail})`);
  console.log(`  evidence       ${r.evidence}`);
  console.log(`  admitted       ${r.admitted}`);
  console.log(`  promoted       ${r.promoted}`);
  console.log(`  reason         ${r.reason}`);
  console.log(`  served before  ${r.servedBefore ?? "none"}`);
  console.log(`  served after   ${r.servedAfter ?? "none"}`);
}

async function main() {
  console.log("napkin: agent ⟲ -> artifacts -> deploy -> fanout^x -> keel gate -> serve\n");

  // ---- PUSH A (all tests pass) ----
  console.log("agent push A: bundle 'app@A — all tests pass'");
  const a = await napkin.push("app@A — all tests pass", jobsA);
  const featuresA = JSON.stringify(napkin.webapp.features());
  receipt("A", a);
  const servedA = napkin.webapp.serveCurrent();
  console.log(`  webapp serves  [${servedA.status}] ${servedA.candidate}: "${servedA.body}"`);
  console.log(`  fanout order   ${order.join(" -> ")} (fast 'integration' before slow 'lint' => parallel)`);
  console.log(`  features       ${JSON.stringify(napkin.webapp.features())}\n`);

  // ---- PUSH B (one test fails) ----
  console.log("agent push B: bundle 'app@B — integration fails'");
  const b = await napkin.push("app@B — integration fails", jobsB);
  receipt("B", b);
  const servedAfterB = napkin.webapp.serveCurrent();
  console.log(`  webapp serves  [${servedAfterB.status}] ${servedAfterB.candidate}: "${servedAfterB.body}"`);
  console.log(`  features       ${JSON.stringify(napkin.webapp.features())}\n`);

  // ---- assertions: the napkin actually worked ----
  const checks: Array<[string, boolean]> = [
    ["A promoted", a.promoted],
    ["webapp served A", napkin.webapp.servedVersion() === a.candidate],
    ["B blocked (not promoted)", !b.promoted],
    ["B admitted=false (keel refused)", b.admitted === false],
    ["webapp STILL serves A (not B)", servedAfterB.candidate === a.candidate],
    // B's failing 'integration' test never flips a flag, because B is never
    // served — the served flags stay exactly A's evidence, unchanged by B.
    ["B's failure flips no flags (served flags unchanged from A)", JSON.stringify(napkin.webapp.features()) === featuresA],
    ["served 'search' flag reflects A (passed in A), never B's fail", napkin.webapp.flag("search") === true],
    ["A's 'checkout' flag on (its test passed)", napkin.webapp.flag("checkout") === true],
    ["fanout parallel (fast finished before slow)", order[0] === "integration"],
    ["A != B (distinct content addresses)", a.candidate !== b.candidate],
  ];

  console.log("checks:");
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${name}`);
    ok &&= pass;
  }

  // audit trail is keel's signed, hash-chained decision log
  console.log(`\naudit log: ${napkin.gate.auditLog.records.length} signed decisions`);
  for (const rec of napkin.gate.auditLog.records) {
    console.log(`  ${rec.outcome.padEnd(8)} ${rec.subject}  (${rec.reason})`);
  }

  console.log(ok ? "\nPASS: A served, B blocked, prior version held, feature=test+flag holds" : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main();
