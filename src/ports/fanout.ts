// The fanout^x port, terrarium backend. Each integration test is a bounded
// terra child run that looks at the dark URL itself (HTTP status, key routes,
// page markers) and reports a single RESULT line. Children run in parallel and
// join into TestResult[]. Unit tests (pure, in-process) fall back to localFanout.
//
//   terra --read-only --json "<task that ends in RESULT: PASS|FAIL>"
//
// We never trust a child's prose: we parse the explicit RESULT line out of the
// child's captured stdout, and a non-zero exit or a missing/!=PASS result is a
// failure. The honesty gate re-checks the same artifact independently afterward.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { localFanout, type RunFanout, type TestJob, type TestResult } from "../pipeline.ts";

const execFileP = promisify(execFile);

export type TerrariumConfig = {
  terraBin: string; // e.g. node /path/to/terrarium/src/cli.js — see terraCommand
  cwd: string;
  model?: string;
  timeoutMs?: number;
};

// terra is a node CLI (`node <cli.js>`). We must launch it with node, NOT with
// whatever runtime launched us — under bun, process.execPath is bun, which does
// not run terra correctly. Honor TERRA_NODE, else the current node, else PATH.
export function terraCommand(cliPath: string): { bin: string; pre: string[] } {
  const node =
    process.env.TERRA_NODE ??
    (process.execPath.endsWith("node") ? process.execPath : "node");
  return { bin: node, pre: [cliPath] };
}

/** Build a terra task that probes one URL+route and ends in a RESULT line. */
export function routeProbeTask(darkUrl: string, route: string, marker?: string): string {
  const url = `${darkUrl.replace(/\/$/, "")}${route}`;
  const markerClause = marker
    ? ` Also confirm the response body contains the exact text ${JSON.stringify(marker)}.`
    : "";
  return [
    `Run exactly this shell command and read its output:`,
    `curl -s -o /tmp/body.$$ -w '%{http_code}' ${url} ; echo ; cat /tmp/body.$$ | head -c 4000`,
    `The route passes only if the HTTP status code is 200${marker ? " and the body contains the marker" : ""}.${markerClause}`,
    `Do not fix anything. On the final line print exactly "RESULT: PASS" if it passed, otherwise "RESULT: FAIL".`,
  ].join("\n");
}

export type TerraChild = (name: string, task: string) => Promise<TestResult>;

export function makeTerraChild(cfg: TerrariumConfig): TerraChild {
  const { bin, pre } = terraCommand(cfg.terraBin);
  return async (name, task) => {
    // NB: not --read-only. terra's read-only preset routes to opencode's
    // `explore` subagent, which cannot run shell commands (curl), so it can
    // never observe the route. The default agent runs the bounded probe.
    const args = [...pre, "--json"];
    if (cfg.model) args.push("--model", cfg.model);
    args.push(task);
    try {
      const { stdout } = await execFileP(bin, args, {
        cwd: cfg.cwd,
        timeout: cfg.timeoutMs ?? 180_000,
        maxBuffer: 32 * 1024 * 1024,
        env: process.env,
      });
      return parseChild(name, stdout);
    } catch (e) {
      const err = e as { stdout?: string; message?: string };
      // terra may exit non-zero but still have emitted JSON; try to parse it.
      if (err.stdout) {
        try {
          return parseChild(name, err.stdout);
        } catch {
          /* fall through */
        }
      }
      return { name, ok: false, detail: `terra child failed: ${err.message ?? "unknown"}` };
    }
  };
}

function parseChild(name: string, stdout: string): TestResult {
  let run: { ok?: boolean; exitCode?: number; stdoutTail?: string };
  try {
    run = JSON.parse(stdout);
  } catch {
    // not JSON (shouldn't happen with --json); inspect raw text
    run = { stdoutTail: stdout };
  }
  const tail = run.stdoutTail ?? "";
  const result = /RESULT:\s*(PASS|FAIL)/i.exec(tail)?.[1]?.toUpperCase();
  const childOk = run.ok !== false && (run.exitCode === undefined || run.exitCode === 0);
  const ok = childOk && result === "PASS";
  const detail = result ? `child:${result}${childOk ? "" : " (exit!=0)"}` : "no RESULT line from child";
  return { name, ok, detail };
}

/**
 * A fanout that runs `terra` route probes against the dark slot and `local`
 * unit jobs in-process. A job opts into terrarium with backend:"terra" and a
 * `route` (+ optional body `marker`); the probe task is built from the slot URL
 * at run time, so the child always tests the exact slot that was deployed.
 */
export type FanoutJob = TestJob & {
  backend?: "terra" | "local";
  route?: string;
  marker?: string;
};

export function makeTerrariumFanout(cfg: TerrariumConfig): RunFanout {
  const child = makeTerraChild(cfg);
  return async (jobs, slot) => {
    const fjobs = jobs as FanoutJob[];
    const terra = fjobs.filter((j) => j.backend === "terra" && j.route !== undefined);
    const local = fjobs.filter((j) => !(j.backend === "terra" && j.route !== undefined));

    const [terraResults, localResults] = await Promise.all([
      Promise.all(
        terra.map((j) => child(j.name, routeProbeTask(slot.url, j.route as string, j.marker))),
      ),
      local.length ? localFanout(local, slot) : Promise.resolve([] as TestResult[]),
    ]);

    // preserve original job order
    const byName = new Map<string, TestResult>();
    for (const r of [...terraResults, ...localResults]) byName.set(r.name, r);
    return fjobs.map(
      (j) => byName.get(j.name) ?? { name: j.name, ok: false, detail: "no result" },
    );
  };
}
