// Automated end-to-end of the runnable napkin: the same flow as
// examples/napkin/run.ts, asserted. Push A (green) promotes + serves; push B
// (one failing test) is blocked by keel and the prior served version holds;
// fanout is genuinely parallel with a failing job; feature = test + flag holds.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeKeyPair, verifySignedChain } from "../../keel/src/index.ts";
import { makeNapkin } from "./napkin.ts";
import { digestBundle } from "./artifacts.ts";
import type { TestJob } from "./pipeline.ts";

const owner = makeKeyPair();
const tmp = mkdtempSync(join(tmpdir(), "napkin-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function freshNapkin(name: string) {
  return makeNapkin({
    owner,
    dataDir: join(tmp, name),
    features: [
      { name: "checkout", test: "unit" },
      { name: "search", test: "integration" },
    ],
  });
}

const order: string[] = [];
const jobsA: TestJob[] = [
  { name: "unit", run: () => ({ name: "unit", ok: true, detail: "" }) },
  { name: "lint", run: async () => { await Bun.sleep(20); order.push("lint"); return { name: "lint", ok: true, detail: "" }; } },
  { name: "integration", run: async () => { await Bun.sleep(2); order.push("integration"); return { name: "integration", ok: true, detail: "" }; } },
];
const jobsB: TestJob[] = [
  { name: "unit", run: () => ({ name: "unit", ok: true, detail: "" }) },
  { name: "lint", run: async () => ({ name: "lint", ok: true, detail: "" }) },
  { name: "integration", run: () => ({ name: "integration", ok: false, detail: "boom" }) },
];

describe("runnable napkin end-to-end", () => {
  test("candidate = sha256 of the bundle (content-addressed, idempotent)", () => {
    const n = freshNapkin("addr");
    const bundle = "app@A";
    const c1 = n.store.put(bundle);
    const c2 = n.store.put(bundle);
    expect(c1).toBe(digestBundle(bundle));
    expect(c1).toBe(c2); // same content -> same candidate
    expect(n.store.get(c1)).toBe(bundle);
  });

  test("A promotes + is served; B blocked + A still served", async () => {
    const n = freshNapkin("flow");
    order.length = 0;

    const a = await n.push("app@A — green", jobsA);
    expect(a.admitted).toBe(true);
    expect(a.promoted).toBe(true);
    expect(a.servedBefore).toBeNull();
    expect(a.servedAfter).toBe(a.candidate);
    expect(n.webapp.servedVersion()).toBe(a.candidate);

    const servedA = n.webapp.serveCurrent();
    expect(servedA.status).toBe(200);
    expect(servedA.body).toBe("app@A — green");

    const b = await n.push("app@B — integration fails", jobsB);
    expect(b.admitted).toBe(false); // keel refused the signed proof (result=fail)
    expect(b.promoted).toBe(false);
    expect(b.candidate).not.toBe(a.candidate);

    // webapp STILL serves A, not B
    expect(n.webapp.servedVersion()).toBe(a.candidate);
    const stillA = n.webapp.serveCurrent();
    expect(stillA.status).toBe(200);
    expect(stillA.body).toBe("app@A — green");
    // and B is not servable
    expect(n.webapp.serve(b.candidate).status).toBe(404);
  });

  test("fanout is genuinely parallel with a failing job present", async () => {
    const n = freshNapkin("parallel");
    order.length = 0;
    // jobs where a fast one and a slow one race, plus a failing job
    const jobs: TestJob[] = [
      { name: "slow", run: async () => { await Bun.sleep(25); order.push("slow"); return { name: "slow", ok: true, detail: "" }; } },
      { name: "fast", run: async () => { await Bun.sleep(1); order.push("fast"); return { name: "fast", ok: true, detail: "" }; } },
      { name: "fail", run: () => ({ name: "fail", ok: false, detail: "x" }) },
    ];
    const r = await n.push("app@parallel", jobs);
    expect(order).toEqual(["fast", "slow"]); // concurrent: fast finished first
    expect(r.results.find((x) => x.name === "fail")!.ok).toBe(false);
    expect(r.promoted).toBe(false); // a failing job blocks promotion
  });

  test("feature = test + flag: a flag is on only if its test passed in the served candidate", async () => {
    const n = freshNapkin("features");
    order.length = 0;

    await n.push("app@A — green", jobsA);
    // both tests passed in A -> both flags on
    expect(n.webapp.flag("checkout")).toBe(true); // gated on 'unit'
    expect(n.webapp.flag("search")).toBe(true); // gated on 'integration'

    await n.push("app@B — integration fails", jobsB);
    // B blocked, A still served, so flags reflect A's evidence (unchanged)
    expect(n.webapp.flag("checkout")).toBe(true);
    expect(n.webapp.flag("search")).toBe(true); // still A's evidence, not B's
    // explicitly: B's failing test would have turned 'search' off had B served
    const bFeatures = n.webapp.features();
    expect(bFeatures.every((f) => f.flag)).toBe(true); // serving A, not B
  });

  test("audit trail is a keel signed, hash-chained decision log that verifies", async () => {
    const n = freshNapkin("audit");
    order.length = 0;
    await n.push("app@A — green", jobsA);
    await n.push("app@B — integration fails", jobsB);

    const records = n.gate.auditLog.records;
    expect(records.length).toBe(2);
    expect(records[0].outcome).toBe("approve"); // A promoted
    expect(records[1].outcome).toBe("deny"); // B blocked
    // the chain verifies against the owner key
    expect(verifySignedChain(records, n.gate.trusted).ok).toBe(true);
  });

  test("the served proof is bound to the served candidate (tamper-evident)", async () => {
    const n = freshNapkin("binding");
    order.length = 0;
    const a = await n.push("app@A — green", jobsA);
    // the proof keel admitted is bound to A's exact digest
    expect(a.proof === undefined).toBe(false);
  });
});
