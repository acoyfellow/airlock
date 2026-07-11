import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeKeyPair, makeProof, signProof } from "keel";
import { localFanout, runPipeline, type Ports, type TestJob } from "../../src/pipeline.ts";
import { tasks, type FleetTask } from "./tasks.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const DATA = join(ROOT, ".data/fleet-run");
const REPO = join(DATA, "repo");
const WORKTREES = join(DATA, "worktrees");
const RECEIPT = join(HERE, "RECEIPT.json");

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initFixture(): string {
  rmSync(DATA, { recursive: true, force: true });
  mkdirSync(REPO, { recursive: true });
  mkdirSync(WORKTREES, { recursive: true });
  writeFileSync(join(REPO, "app.json"), JSON.stringify({ banner: "checkout", currency: "USD", checkoutTimeoutMs: 10_000 }) + "\n");
  writeFileSync(join(REPO, "README.md"), "# Fleet checkout fixture\n");
  git(REPO, ["init", "-b", "main"]);
  git(REPO, ["config", "user.name", "fleet-base"]);
  git(REPO, ["config", "user.email", "base@fleet.invalid"]);
  git(REPO, ["add", "."]);
  git(REPO, ["commit", "-m", "fixture: base"]);
  return git(REPO, ["rev-parse", "HEAD"]);
}

type AgentResult = {
  task: string;
  pid: number;
  commit: string;
  parent: string;
  changedFiles: string[];
  patch: string;
};

async function runAgent(task: FleetTask, base: string): Promise<AgentResult> {
  const worktree = join(WORKTREES, task.id);
  git(REPO, ["worktree", "add", "-b", `fleet/${task.id}`, worktree, base]);
  const encoded = Buffer.from(JSON.stringify(task)).toString("base64url");
  const child = spawn(process.execPath, ["run", join(HERE, "agent.ts"), worktree, encoded], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`agent ${task.id} exited ${code}: ${stderr || stdout}`);
  const line = stdout.trim().split("\n").at(-1) ?? "";
  const reported = JSON.parse(line) as { task: string; pid: number; commit: string };
  const commit = git(worktree, ["rev-parse", "HEAD"]);
  if (reported.commit !== commit || reported.task !== task.id) throw new Error(`agent ${task.id} self-report mismatch`);
  const parent = git(worktree, ["rev-parse", "HEAD^"]);
  const changedFiles = git(worktree, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).split("\n").filter(Boolean);
  const patch = git(worktree, ["show", "--format=", "--binary", "HEAD"]);
  return { task: task.id, pid: reported.pid, commit, parent, changedFiles, patch };
}

function classifyContracts() {
  const byKey = new Map<string, Array<{ task: FleetTask; value: string | number }>>();
  for (const task of tasks) {
    for (const [key, value] of Object.entries(task.writes ?? {})) {
      const entries = byKey.get(key) ?? [];
      entries.push({ task, value });
      byKey.set(key, entries);
    }
  }
  const blocked = new Map<string, string>();
  for (const [key, entries] of byKey) {
    if (new Set(entries.map((entry) => JSON.stringify(entry.value))).size > 1) {
      for (const entry of entries) blocked.set(entry.task.id, `incompatible values for ${key}: ${entries.map((x) => `${x.task.id}=${x.value}`).join(", ")}`);
    }
  }
  return {
    accepted: tasks.filter((task) => !blocked.has(task.id)),
    blocked: tasks.filter((task) => blocked.has(task.id)).map((task) => ({ task: task.id, reason: blocked.get(task.id)! })),
  };
}

function proveNaiveTextCollision(base: string, agents: AgentResult[]) {
  const path = join(WORKTREES, "naive");
  git(REPO, ["worktree", "add", "-b", "fleet/naive", path, base]);
  const banner = agents.find((agent) => agent.task === "banner")!;
  const currency = agents.find((agent) => agent.task === "currency")!;
  git(path, ["cherry-pick", banner.commit]);
  const result = spawnSync("git", ["cherry-pick", currency.commit], { cwd: path, encoding: "utf8" });
  const conflictedFiles = git(path, ["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
  spawnSync("git", ["cherry-pick", "--abort"], { cwd: path, stdio: "ignore" });
  return { observed: result.status !== 0, conflictedFiles, first: banner.task, second: currency.task };
}

async function main() {
  const startedAt = new Date().toISOString();
  const base = initFixture();

  // All workers are launched from the same base before any result is integrated.
  const agents = await Promise.all(tasks.map((task) => runAgent(task, base)));
  if (agents.some((agent) => agent.parent !== base)) throw new Error("an agent did not commit directly on the shared base");
  if (new Set(agents.map((agent) => agent.pid)).size !== agents.length) throw new Error("agents did not run as separate processes");

  const textCollision = proveNaiveTextCollision(base, agents);
  if (!textCollision.observed || !textCollision.conflictedFiles.includes("app.json")) throw new Error("expected textual collision was not observed");

  const { accepted, blocked } = classifyContracts();
  if (blocked.length !== 2) throw new Error(`expected two explicitly blocked incompatible tasks, got ${blocked.length}`);

  const integration = join(WORKTREES, "integration");
  git(REPO, ["worktree", "add", "-b", "fleet/integration", integration, base]);
  const appPath = join(integration, "app.json");
  const app = JSON.parse(readFileSync(appPath, "utf8")) as Record<string, string | number>;
  for (const task of accepted) Object.assign(app, task.writes ?? {});
  writeFileSync(appPath, JSON.stringify(app) + "\n");
  const readmeLines = [readFileSync(join(integration, "README.md"), "utf8").trimEnd(), ...accepted.flatMap((task) => task.appendReadme ?? [])];
  writeFileSync(join(integration, "README.md"), readmeLines.join("\n") + "\n");
  mkdirSync(join(integration, "proposals"), { recursive: true });
  for (const task of accepted) writeFileSync(join(integration, "proposals", `${task.id}.json`), JSON.stringify(task, null, 2) + "\n");
  git(integration, ["add", "."]);
  git(integration, ["commit", "-m", "fleet: reconcile compatible task contracts"]);
  const integrationCommit = git(integration, ["rev-parse", "HEAD"]);

  const finalApp = JSON.parse(readFileSync(appPath, "utf8")) as Record<string, string | number>;
  const finalReadme = readFileSync(join(integration, "README.md"), "utf8");
  const candidate = `sha256:${createHash("sha256").update(JSON.stringify(finalApp)).update("\n").update(finalReadme).digest("hex")}`;
  const owner = makeKeyPair();
  let served: string | null = null;
  const jobs: TestJob[] = accepted.map((task) => ({
    name: task.id,
    run: () => {
      const writesPass = Object.entries(task.writes ?? {}).every(([key, value]) => finalApp[key] === value);
      const docsPass = task.appendReadme ? finalReadme.includes(task.appendReadme) : true;
      return { name: task.id, ok: writesPass && docsPass, detail: writesPass && docsPass ? "task contract retained" : "task contract lost" };
    },
  }));
  jobs.push({
    name: "blocked-conflict-left-base-intact",
    run: () => ({
      name: "blocked-conflict-left-base-intact",
      ok: finalApp.checkoutTimeoutMs === 10_000,
      detail: `checkoutTimeoutMs=${finalApp.checkoutTimeoutMs}`,
    }),
  });
  const ports: Ports = {
    deploy: async () => ({ url: `file://${integration}`, detail: "local preview with no live traffic" }),
    runFanout: localFanout,
    sign: (artifactDigest, evidence, pass) => signProof(makeProof({ artifactDigest, verifier: owner.keyId, policy: "airlock/fleet-spike@1", result: pass ? "pass" : "fail", evidence }), owner.keyId, owner.privatePem),
    trusted: { [owner.keyId]: owner.publicPem },
    setFeatureGate: async (subject, on) => { if (on) served = subject; },
  };
  const pipeline = await runPipeline({ repo: "fleet-fixture", candidate }, jobs, ports);
  if (!pipeline.promoted || served !== candidate) throw new Error("reconciled candidate did not pass the airlock gate");

  const receipt = {
    experiment: "airlock/fleet-spike@1",
    startedAt,
    finishedAt: new Date().toISOString(),
    status: "pass",
    claim: "Independent worker processes committed from one shared base; a real textual collision was observed; compatible task contracts were reconciled; incompatible contracts were explicitly blocked; the combined candidate passed a signed airlock gate.",
    limits: [
      "Workers are deterministic scripts, not autonomous model agents.",
      "Reconciliation handles declared key/value task contracts, not arbitrary program semantics.",
      "The preview is local and file-backed; this run does not deploy a fleet-built application to Cloudflare.",
      "A passing receipt proves only the declared task contracts and checks.",
    ],
    base,
    agents,
    textCollision,
    accepted: accepted.map((task) => task.id),
    blocked,
    integration: { commit: integrationCommit, candidate, app: finalApp, readme: finalReadme.trimEnd() },
    pipeline: {
      previewUrl: pipeline.slot.url,
      evidence: pipeline.evidence,
      results: pipeline.results,
      admitted: pipeline.admitted,
      promoted: pipeline.promoted,
      served,
      proof: pipeline.proof,
      trusted: { [owner.keyId]: owner.publicPem },
    },
  };
  writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`fleet: ${agents.length} independent commits from ${base.slice(0, 12)}`);
  console.log(`text collision: ${textCollision.conflictedFiles.join(", ")}`);
  console.log(`accepted: ${receipt.accepted.join(", ")}`);
  console.log(`blocked: ${blocked.map((item) => item.task).join(", ")}`);
  console.log(`candidate: ${candidate}`);
  console.log(`gate: admitted=${pipeline.admitted} promoted=${pipeline.promoted}`);
  console.log(`receipt: ${RECEIPT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
