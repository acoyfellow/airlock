import { describe, expect, test } from "bun:test";
import { makeKeyPair } from "keel";
import { runPipeline, localFanout, makeProof, signProof, type Ports, type TestJob } from "./pipeline.ts";

const owner = makeKeyPair();
const trusted = { [owner.keyId]: owner.publicPem };
const digest = (hex: string) => `sha256:${hex.repeat(64)}`;

function ports(): { ports: Ports; gate: () => string } {
  let live = "none";
  return {
    gate: () => live,
    ports: {
      runFanout: localFanout,
      deploy: async (c) => ({ url: `https://preview.example/${c}`, versionId: `v-${c.slice(-8)}` }),
      setFeatureGate: async (c, on) => {
        if (on) live = c;
        return { productionChanged: on, requestRecorded: false };
      },
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
    const candidate = digest("a");
    const r = await runPipeline({ repo: "x", candidate }, green, p);
    expect(r.promoted).toBe(true);
    expect(gate()).toBe(candidate);
  });

  test("one failing test -> keel refuses -> gate stays off", async () => {
    const { ports: p, gate } = ports();
    const jobs = [...green, { name: "c", run: () => ({ name: "c", ok: false, detail: "boom" }) }];
    const r = await runPipeline({ repo: "x", candidate: digest("b") }, jobs, p);
    expect(r.promoted).toBe(false);
    expect(gate()).toBe("none");
  });

  test("a thrown test counts as a failure, not a crash", async () => {
    const { ports: p } = ports();
    const jobs = [...green, { name: "c", run: () => { throw new Error("oops"); } }];
    const r = await runPipeline({ repo: "x", candidate: digest("c") }, jobs, p);
    expect(r.promoted).toBe(false);
    expect(r.results.find((x) => x.name === "c")!.ok).toBe(false);
  });

  test("malformed candidate fails before deploy", async () => {
    const { ports: p } = ports();
    await expect(runPipeline({ repo: "x", candidate: "sha256:not-a-digest" }, green, p)).rejects.toThrow("lowercase SHA-256");
  });

  test("empty preview URL or version fails before checks and signing", async () => {
    const { ports: missingUrl } = ports();
    missingUrl.deploy = async () => ({ url: "", versionId: "v1" });
    await expect(runPipeline({ repo: "x", candidate: digest("f") }, green, missingUrl)).rejects.toThrow("slot URL and version");

    const { ports: missingVersion } = ports();
    missingVersion.deploy = async () => ({ url: "https://preview.example", versionId: "" });
    await expect(runPipeline({ repo: "x", candidate: digest("f") }, green, missingVersion)).rejects.toThrow("slot URL and version");
  });

  test("refusal path fails closed if a port reports a production change", async () => {
    const { ports: p } = ports();
    p.setFeatureGate = async () => ({ productionChanged: true, requestRecorded: false });
    const jobs = [{ name: "fail", run: () => ({ name: "fail", ok: false, detail: "no" }) }];
    await expect(runPipeline({ repo: "x", candidate: digest("e") }, jobs, p)).rejects.toThrow("refusal path changed production");
  });

  test("fanout runs jobs in parallel", async () => {
    const { ports: p } = ports();
    const order: string[] = [];
    const jobs: TestJob[] = [
      { name: "slow", run: async () => { await Bun.sleep(20); order.push("slow"); return { name: "slow", ok: true, detail: "" }; } },
      { name: "fast", run: async () => { await Bun.sleep(1); order.push("fast"); return { name: "fast", ok: true, detail: "" }; } },
    ];
    await runPipeline({ repo: "x", candidate: digest("d") }, jobs, p);
    expect(order).toEqual(["fast", "slow"]); // fast finished first => concurrent, not sequential
  });
});
