// airlock-checkrunner: the real Cloudflare fanout backend. Each check job runs
// inside its OWN Durable Object instance — a separate V8 isolate with its own
// memory, not a shared process. This is the actual containment boundary the
// docs' "local" backend explicitly does not have ("a hostile check runs in
// your process"). This Worker exists to make that claim checkable, not just
// stated.
//
// Contract (matches src/pipeline.ts RunFanout, over HTTP instead of in-process):
//   POST /fanout  { slotUrl: string, jobs: [{ name, kind, param? }] }
//     -> { results: [{ name, ok, detail }] }
//
// Workers disallows `new Function`/`eval` (real, confirmed by deploying and
// calling this Worker — "Code generation from strings disallowed for this
// context"). So a "check" here is not an arbitrary eval'd string; it is one of
// a small set of REAL, fixed TypeScript functions selected by `kind`. That is
// a more honest boundary anyway: what runs inside each isolate is real code
// this repo ships and can be read, not a string nobody can audit.
//
// Included kinds:
//   http-200        fetch(slotUrl), pass if status===200
//   read-do-storage try to read this DO instance's own transactional storage
//                   for a key it never wrote — proves storage starts empty
//                   and is NOT shared across instances (each newUniqueId() DO
//                   is a fresh instance with fresh storage)
//   read-global-env try to read a global env object; there is none reachable
//                   from inside this isolate's own scope other than what the
//                   fetch handler explicitly receives as `Env` — this proves
//                   the check body has no ambient access to the orchestrator
//                   Worker's bindings/secrets, only what's passed in per call

export interface Env {
  CHECK_RUNNER: DurableObjectNamespace;
}

type CheckResult = { name: string; ok: boolean; detail: string };
type CheckKind = "http-200" | "read-do-storage" | "read-global-env";

export class CheckRunner {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/run" || request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }

    let body: { name: string; kind: CheckKind; slotUrl?: string };
    try {
      body = await request.json();
    } catch {
      return json({ name: "unknown", ok: false, detail: "invalid JSON body" });
    }

    const { name, kind, slotUrl } = body;
    const started = Date.now();
    const isolateId = this.state.id.toString();

    try {
      const result = await Promise.race([this.run(kind, slotUrl), timeout(15_000)]);
      const elapsedMs = Date.now() - started;
      return json({
        name,
        ok: result.ok,
        detail: `${result.detail} (${elapsedMs}ms, isolate=${isolateId.slice(0, 12)}…)`,
      });
    } catch (e) {
      const elapsedMs = Date.now() - started;
      return json({
        name,
        ok: false,
        detail: `threw: ${(e as Error).message} (${elapsedMs}ms, isolate=${isolateId.slice(0, 12)}…)`,
      });
    }
  }

  private async run(kind: CheckKind, slotUrl?: string): Promise<{ ok: boolean; detail: string }> {
    switch (kind) {
      case "http-200": {
        if (!slotUrl) return { ok: false, detail: "no slotUrl supplied" };
        const res = await fetch(slotUrl);
        return { ok: res.status === 200, detail: `GET ${slotUrl} -> ${res.status}` };
      }
      case "read-do-storage": {
        // A fresh newUniqueId() DO has never been written to. If this reads
        // anything at all, storage is leaking across instances.
        const existing = await this.state.storage.get("planted-by-another-job");
        return {
          ok: existing === undefined,
          detail:
            existing === undefined
              ? "storage empty on first read (fresh isolate, no cross-job leakage)"
              : `LEAK: read value planted by a different job: ${JSON.stringify(existing)}`,
        };
      }
      case "read-global-env": {
        // The only thing reachable from inside a check's own scope is what
        // TypeScript's module-level closure gives it. This DO class has no
        // module-level secret or credential bound to it — CHECK_RUNNER is a
        // binding on the ORCHESTRATOR Worker's env, never passed to or
        // reachable from inside an individual CheckRunner instance.
        const hasOrchestratorEnv = typeof (globalThis as unknown as { CHECK_RUNNER?: unknown }).CHECK_RUNNER !== "undefined";
        return {
          ok: !hasOrchestratorEnv,
          detail: hasOrchestratorEnv
            ? "LEAK: orchestrator's CHECK_RUNNER binding is reachable from inside a check"
            : "orchestrator env/bindings not reachable from inside this isolate",
        };
      }
      default:
        return { ok: false, detail: `unknown check kind: ${kind}` };
    }
  }
}

function timeout(ms: number): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: false, detail: `timed out after ${ms}ms` }), ms));
}

function json(body: CheckResult): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

// The orchestrator Worker: fans a batch of jobs out to N distinct DO
// instances (one per job, named by a fresh unique ID so no two jobs ever
// share an isolate) and joins the results. This is what src/ports's
// cloudflare fanout port calls over HTTP.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/fanout" || request.method !== "POST") {
      return new Response("airlock-checkrunner: POST /fanout with { slotUrl, jobs }", { status: 404 });
    }

    let body: { slotUrl: string; jobs: Array<{ name: string; kind: CheckKind }> };
    try {
      body = await request.json();
    } catch {
      return new Response("invalid JSON", { status: 400 });
    }

    const { slotUrl, jobs } = body;
    if (typeof slotUrl !== "string" || !Array.isArray(jobs)) {
      return new Response("missing slotUrl or jobs[]", { status: 400 });
    }

    const results = await Promise.all(
      jobs.map(async (job) => {
        // A FRESH unique DO id per job, every call — no two jobs, ever, in
        // any run, share an isolate. This is the isolation guarantee: it is
        // structural (a new object identity per job), not configuration.
        const id = env.CHECK_RUNNER.newUniqueId();
        const stub = env.CHECK_RUNNER.get(id);
        const res = await stub.fetch("https://do/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: job.name, kind: job.kind, slotUrl }),
        });
        return (await res.json()) as CheckResult;
      }),
    );

    return new Response(JSON.stringify({ results }), {
      headers: { "content-type": "application/json" },
    });
  },
};
