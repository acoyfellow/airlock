// airlock-swarm-registry: a REAL promotion authority multiple independent
// processes race against. One Durable Object instance ("the-one-app") holds
// the served candidate + a monotonic version. /admit does a real
// compare-and-swap: a candidate is admitted (becomes served) only if it still
// expects the CURRENT served version at the moment the DO's single-threaded
// storage transaction runs. Two callers racing to admit different candidates
// against the same expected version: exactly one wins, the loser is told it
// lost and why — not silently overwritten.
//
// This exists to empirically answer, with real concurrent OS processes
// (not JS-event-loop-serialized async), a question the docs used to guess
// at and got wrong once already (see git history): what actually happens
// when a swarm of agents pushes candidates at once?

export interface Env {
  REGISTRY: DurableObjectNamespace;
}

type AdmitRequest = {
  agent: string; // which swarm agent is asking
  candidate: string; // the candidate being proposed
  expectedVersion: number; // the version this agent last observed
};

type AdmitResult =
  | { admitted: true; candidate: string; version: number }
  | { admitted: false; reason: "stale-version"; currentServed: string; currentVersion: number };

export class PromotionRegistry {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/state" && request.method === "GET") {
      const served = (await this.state.storage.get<string>("served")) ?? "none";
      const version = (await this.state.storage.get<number>("version")) ?? 0;
      const log = (await this.state.storage.get<AdmitLogEntry[]>("log")) ?? [];
      return json({ served, version, log });
    }

    if (url.pathname === "/admit" && request.method === "POST") {
      const body = (await request.json()) as AdmitRequest;
      // storage.transaction serializes concurrent calls to THIS DO instance:
      // this is the real, structural compare-and-swap. Cloudflare guarantees
      // one DO instance processes one request at a time; there is no lock we
      // have to write ourselves, the runtime provides it.
      const result = await this.state.storage.transaction(async (txn) => {
        const currentServed = (await txn.get<string>("served")) ?? "none";
        const currentVersion = (await txn.get<number>("version")) ?? 0;

        const entry: AdmitLogEntry = {
          at: new Date().toISOString(),
          agent: body.agent,
          candidate: body.candidate,
          expectedVersion: body.expectedVersion,
          currentVersionAtCheck: currentVersion,
        };

        if (body.expectedVersion !== currentVersion) {
          entry.outcome = "refused-stale-version";
          await appendLog(txn, entry);
          const r: AdmitResult = { admitted: false, reason: "stale-version", currentServed, currentVersion };
          return r;
        }

        const newVersion = currentVersion + 1;
        await txn.put("served", body.candidate);
        await txn.put("version", newVersion);
        entry.outcome = "admitted";
        await appendLog(txn, entry);
        const r: AdmitResult = { admitted: true, candidate: body.candidate, version: newVersion };
        return r;
      });

      return json(result);
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      await this.state.storage.deleteAll();
      return json({ reset: true });
    }

    return new Response("not found", { status: 404 });
  }
}

type AdmitLogEntry = {
  at: string;
  agent: string;
  candidate: string;
  expectedVersion: number;
  currentVersionAtCheck: number;
  outcome?: "admitted" | "refused-stale-version";
};

async function appendLog(txn: DurableObjectTransaction, entry: AdmitLogEntry) {
  const log = (await txn.get<AdmitLogEntry[]>("log")) ?? [];
  log.push(entry);
  await txn.put("log", log);
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ONE global registry instance ("the-one-app") — every agent in the swarm
    // is racing to promote candidates for the same single app.
    const id = env.REGISTRY.idFromName("the-one-app");
    const stub = env.REGISTRY.get(id);
    return stub.fetch(request);
  },
};
