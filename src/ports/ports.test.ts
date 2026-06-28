import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifySignedProof } from "../../../keel/src/index.ts";

import { candidateDigest, sourceFiles } from "./digest.mjs";
import { makeSigner } from "./sign.ts";
import { loadVerifier } from "./keys.ts";
import { darkWorkerName, parseWorkersDevUrl } from "./deploy.ts";
import { routeProbeTask, parseChild } from "./fanout.ts";
import { makeHumanGate } from "./gate.ts";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("candidate digest", () => {
  test("is deterministic and content-addressed (sha256:)", () => {
    const a = candidateDigest(REPO_ROOT);
    const b = candidateDigest(REPO_ROOT);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("excludes the generated receipt and the dogfood harness", () => {
    const files = sourceFiles(REPO_ROOT);
    expect(files).not.toContain("site/src/lib/receipt.ts");
    expect(files.some((f) => f.startsWith("experiments/"))).toBe(false);
  });
});

describe("sign port (keel)", () => {
  const { verifier, trusted } = loadVerifier(REPO_ROOT);
  const sign = makeSigner(verifier);
  const candidate = "sha256:" + "a".repeat(64);

  test("a pass proof is admitted for the exact digest", () => {
    const proof = sign(candidate, "home-200=pass", true);
    expect(verifySignedProof(proof, candidate, trusted).admitted).toBe(true);
  });

  test("a proof does not admit a different digest", () => {
    const proof = sign(candidate, "home-200=pass", true);
    const other = "sha256:" + "b".repeat(64);
    expect(verifySignedProof(proof, other, trusted).admitted).toBe(false);
  });

  test("a fail proof is refused", () => {
    const proof = sign(candidate, "home-200=fail", false);
    expect(verifySignedProof(proof, candidate, trusted).admitted).toBe(false);
  });

  test("a tampered signature is refused", () => {
    const proof = sign(candidate, "home-200=pass", true);
    const tampered = { ...proof, proof: { ...proof.proof, evidence: "all=pass" } };
    expect(verifySignedProof(tampered, candidate, trusted).admitted).toBe(false);
  });
});

describe("deploy port naming", () => {
  test("dark worker name is derived from the digest, dns-safe", () => {
    const name = darkWorkerName("sha256:e8d9a768b85d11af23b0367d9868f5b80");
    expect(name).toBe("new-sdlc-dark-e8d9a768b85d11af23b0367d");
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(name.length).toBeLessThanOrEqual(63);
  });

  test("parses the workers.dev URL from wrangler output, preferring the named one", () => {
    const out = `Deployed new-sdlc-dark-abc triggers\n  https://new-sdlc-dark-abc.sub.workers.dev\nCurrent Version ID: 123`;
    expect(parseWorkersDevUrl(out, "new-sdlc-dark-abc")).toBe(
      "https://new-sdlc-dark-abc.sub.workers.dev",
    );
    expect(parseWorkersDevUrl("no url here", "x")).toBeNull();
  });
});

describe("terrarium fanout parsing", () => {
  test("routeProbeTask targets the slot URL + route", () => {
    const task = routeProbeTask("https://dark.example/", "/docs");
    expect(task).toContain("https://dark.example/docs");
    expect(task).toContain("RESULT: PASS");
  });

  test("parseChild reads the RESULT line and the child exit", () => {
    const pass = JSON.stringify({ ok: true, exitCode: 0, stdoutTail: "blah\nRESULT: PASS\n" });
    expect(parseChild("t", pass).ok).toBe(true);

    const fail = JSON.stringify({ ok: true, exitCode: 0, stdoutTail: "RESULT: FAIL\n" });
    expect(parseChild("t", fail).ok).toBe(false);

    const noResult = JSON.stringify({ ok: true, exitCode: 0, stdoutTail: "did nothing" });
    expect(parseChild("t", noResult).ok).toBe(false);

    const badExit = JSON.stringify({ ok: false, exitCode: 1, stdoutTail: "RESULT: PASS\n" });
    expect(parseChild("t", badExit).ok).toBe(false);
  });
});

describe("human-gated promote port", () => {
  test("records a promotion request and never flips prod", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nsdlc-gate-"));
    mkdirSync(join(dir, "experiments/dogfood"), { recursive: true });
    const gate = makeHumanGate({ repoRoot: dir, darkUrl: () => "https://dark.example/x" });
    await gate("sha256:" + "c".repeat(64), true);
    const reqPath = join(dir, "experiments/dogfood/PROMOTE_REQUEST.json");
    expect(existsSync(reqPath)).toBe(true);
    const req = JSON.parse(readFileSync(reqPath, "utf8"));
    expect(req.darkUrl).toBe("https://dark.example/x");
    rmSync(dir, { recursive: true, force: true });
  });

  test("turning the gate off is a no-op (no request written)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nsdlc-gate-"));
    mkdirSync(join(dir, "experiments/dogfood"), { recursive: true });
    const gate = makeHumanGate({ repoRoot: dir, darkUrl: () => undefined });
    await gate("sha256:" + "d".repeat(64), false);
    expect(existsSync(join(dir, "experiments/dogfood/PROMOTE_REQUEST.json"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("an armed prod flip fails closed (owner-held)", async () => {
    const gate = makeHumanGate({ repoRoot: REPO_ROOT, darkUrl: () => "x", allowProdFlip: true });
    await expect(gate("sha256:" + "e".repeat(64), true)).rejects.toThrow(/owner-held/);
  });
});

describe("verifier key loading", () => {
  test("inline PEM env yields a matching trusted keyring", () => {
    // mint a throwaway pair via the bootstrap path, then feed it back inline
    const { verifier } = loadVerifier(REPO_ROOT);
    const prev = {
      pk: process.env.KEEL_VERIFIER_PRIVATE_PEM,
      pub: process.env.KEEL_VERIFIER_PUBLIC_PEM,
      id: process.env.KEEL_VERIFIER_KEY_ID,
    };
    process.env.KEEL_VERIFIER_PRIVATE_PEM = verifier.privatePem;
    process.env.KEEL_VERIFIER_PUBLIC_PEM = verifier.publicPem;
    process.env.KEEL_VERIFIER_KEY_ID = verifier.keyId;
    try {
      const loaded = loadVerifier(REPO_ROOT);
      expect(loaded.source).toBe("env:inline-pem");
      expect(loaded.trusted[verifier.keyId]).toBe(verifier.publicPem);
    } finally {
      process.env.KEEL_VERIFIER_PRIVATE_PEM = prev.pk;
      process.env.KEEL_VERIFIER_PUBLIC_PEM = prev.pub;
      process.env.KEEL_VERIFIER_KEY_ID = prev.id;
    }
  });
});
