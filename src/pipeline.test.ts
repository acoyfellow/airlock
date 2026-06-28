import { describe, expect, test } from "bun:test";
import { makeKeyPair } from "../../keel/src/index.ts";
import { runPipeline, localFanout, makeProof, signProof, type Ports, type TestJob } from "./pipeline.ts";

const owner = makeKeyPair();
const trusted = { [owner.keyId]: owner.publicPem };

function ports(): { ports: Ports; gate: () => string } {
  let live = "none";
  return {
    gate: () => live,
    ports: {
      runFanout: localFanout,
      deploy: async () => {},
      setFeatureGate: async (c, on) => { if (on) live = c; },
      sign: (candidate, evidence, pass) =>
        signProof(makeProof({ artifactDigest: candidate, verifier: owner.keyId, policy: "t@1", result: pass ? "pass" : "fail", evidence }), owner.keyId, owner.privatePem),
      trusted,
    },
  };
}

const green: TestJob[] = [
  { name: "a", run: () => ({ name: "a", ok: true, detail: "" }) },
  { name: "b", run: async () => ({ name: "b", ok: true, detail: "" }) },
];

describe("new sdlc pipeline", () => {
  test("all tests pass -> keel admits -> feature gate promoted", async () => {
    const { ports: p, gate } = ports();
    const r = await runPipeline({ repo: "x", candidate: "sha-good" }, green, p);
    expect(r.promoted).toBe(true);
    expect(gate()).toBe("sha-good");
  });

  test("one failing test -> keel refuses -> gate stays off", async () => {
    const { ports: p, gate } = ports();
    const jobs = [...green, { name: "c", run: () => ({ name: "c", ok: false, detail: "boom" }) }];
    const r = await runPipeline({ repo: "x", candidate: "sha-bad" }, jobs, p);
    expect(r.promoted).toBe(false);
    expect(gate()).toBe("none");
  });

  test("a thrown test counts as a failure, not a crash", async () => {
    const { ports: p } = ports();
    const jobs = [...green, { name: "c", run: () => { throw new Error("oops"); } }];
    const r = await runPipeline({ repo: "x", candidate: "sha-throw" }, jobs, p);
    expect(r.promoted).toBe(false);
    expect(r.results.find((x) => x.name === "c")!.ok).toBe(false);
  });

  test("fanout runs jobs in parallel", async () => {
    const { ports: p } = ports();
    const order: string[] = [];
    const jobs: TestJob[] = [
      { name: "slow", run: async () => { await Bun.sleep(20); order.push("slow"); return { name: "slow", ok: true, detail: "" }; } },
      { name: "fast", run: async () => { await Bun.sleep(1); order.push("fast"); return { name: "fast", ok: true, detail: "" }; } },
    ];
    await runPipeline({ repo: "x", candidate: "sha-par" }, jobs, p);
    expect(order).toEqual(["fast", "slow"]); // fast finished first => concurrent, not sequential
  });
});
