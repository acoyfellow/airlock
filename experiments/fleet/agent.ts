import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FleetTask } from "./tasks.ts";

const [worktree, encodedTask] = process.argv.slice(2);
if (!worktree || !encodedTask) throw new Error("usage: agent.ts <worktree> <base64-task>");
const task = JSON.parse(Buffer.from(encodedTask, "base64url").toString("utf8")) as FleetTask;

if (task.writes) {
  const appPath = join(worktree, "app.json");
  const app = JSON.parse(readFileSync(appPath, "utf8")) as Record<string, string | number>;
  Object.assign(app, task.writes);
  // Intentionally one line: independent key changes collide under a naive
  // cherry-pick, forcing the coordinator to reason from task contracts.
  writeFileSync(appPath, JSON.stringify(app) + "\n");
}

if (task.appendReadme) {
  const readmePath = join(worktree, "README.md");
  const current = readFileSync(readmePath, "utf8").trimEnd();
  writeFileSync(readmePath, `${current}\n${task.appendReadme}\n`);
}

mkdirSync(join(worktree, "proposals"), { recursive: true });
writeFileSync(join(worktree, "proposals", `${task.id}.json`), JSON.stringify(task, null, 2) + "\n");
execFileSync("git", ["add", "app.json", "README.md", "proposals"], { cwd: worktree });
execFileSync("git", ["commit", "-m", `fleet: ${task.id}`], {
  cwd: worktree,
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: `fleet-${task.id}`,
    GIT_AUTHOR_EMAIL: `${task.id}@fleet.invalid`,
    GIT_COMMITTER_NAME: `fleet-${task.id}`,
    GIT_COMMITTER_EMAIL: `${task.id}@fleet.invalid`,
  },
  stdio: "ignore",
});

const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: worktree, encoding: "utf8" }).trim();
console.log(JSON.stringify({ task: task.id, commit, pid: process.pid }));
