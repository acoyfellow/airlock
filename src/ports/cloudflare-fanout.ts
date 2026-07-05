// The fanout^x port, real Cloudflare backend: each check job runs inside its
// own Durable Object instance on airlock-checkrunner (a real deployed Worker,
// see experiments/isolation-proof/worker). Unlike localFanout, a hostile check
// here cannot read the orchestrator's process memory, env vars, or any other
// job's state — those are simply not reachable from inside a DO's own fetch
// handler. This is a structural isolation guarantee (separate V8 isolate per
// job), not a policy one.
//
// Cloudflare Workers disallow `new Function`/eval, so a "check" is not an
// arbitrary string; it's one of a small set of named, real check kinds the
// checkrunner Worker ships (see CheckKind in the worker source). That is a
// narrower fanout than terrarium's free-form task, but it's real code running
// in a real separate isolate — not a claim.

import { localFanout, type RunFanout, type TestJob, type TestResult } from "../pipeline.ts";

export type CloudflareFanoutConfig = {
  checkrunnerUrl: string; // e.g. https://airlock-checkrunner.coey.dev
};

export type CloudflareCheckKind = "http-200" | "read-do-storage" | "read-global-env";

export type CloudflareJob = TestJob & {
  backend?: "cloudflare";
  kind?: CloudflareCheckKind;
};

export function makeCloudflareFanout(cfg: CloudflareFanoutConfig): RunFanout {
  return async (jobs, slot) => {
    const cfJobs = jobs as CloudflareJob[];
    const remote = cfJobs.filter((j) => j.backend === "cloudflare" && j.kind !== undefined);
    const local = cfJobs.filter((j) => !(j.backend === "cloudflare" && j.kind !== undefined));

    const [remoteResults, localResults] = await Promise.all([
      remote.length ? runRemote(cfg, slot.url, remote) : Promise.resolve([] as TestResult[]),
      local.length ? localFanout(local, slot) : Promise.resolve([] as TestResult[]),
    ]);

    const byName = new Map<string, TestResult>();
    for (const r of [...remoteResults, ...localResults]) byName.set(r.name, r);
    return cfJobs.map((j) => byName.get(j.name) ?? { name: j.name, ok: false, detail: "no result" });
  };
}

async function runRemote(
  cfg: CloudflareFanoutConfig,
  slotUrl: string,
  jobs: CloudflareJob[],
): Promise<TestResult[]> {
  const res = await fetch(`${cfg.checkrunnerUrl.replace(/\/$/, "")}/fanout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slotUrl,
      jobs: jobs.map((j) => ({ name: j.name, kind: j.kind })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return jobs.map((j) => ({ name: j.name, ok: false, detail: `checkrunner HTTP ${res.status}: ${text.slice(0, 200)}` }));
  }
  const body = (await res.json()) as { results: TestResult[] };
  return body.results;
}
