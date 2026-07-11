import { createHash, createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Keyring,
  RefStore,
  makeKeyPair,
  makeProof,
  promote,
  signProof,
  type ScopedToken,
  type TrustedKeys,
} from "keel";
import { localFanout, runPipeline, type Ports, type TestJob } from "../../src/pipeline.ts";
import { candidateDigest } from "../../src/ports/digest.mjs";

const ROOT = join(import.meta.dir, "../..");
const RECEIPT_PATH = join(import.meta.dir, "RECEIPT.json");
const RECEIPT_MARKDOWN_PATH = join(import.meta.dir, "RECEIPT.md");
const digest = (label: string) => `sha256:${createHash("sha256").update(label).digest("hex")}`;

function keelProvenance() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: { keel: string } };
  const lock = readFileSync(join(ROOT, "bun.lock"), "utf8");
  const resolved = /"keel": \["keel@github:acoyfellow\/keel#([0-9a-f]+)"/.exec(lock)?.[1];
  if (!resolved) throw new Error("launch-proof: pinned Keel commit not found in bun.lock");
  return {
    dependency: pkg.dependencies.keel,
    resolvedCommit: resolved,
    importedApis: ["Keyring", "RefStore", "makeKeyPair", "makeProof", "promote", "signProof"],
  };
}

async function main() {
  const baseline = digest("launch-proof/baseline");
  const passingCandidate = candidateDigest(ROOT);
  const failingCandidate = digest(`${passingCandidate}/injected-failing-candidate`);
  const verifier = makeKeyPair();
  const trusted: TrustedKeys = { [verifier.keyId]: verifier.publicPem };
  let selected = baseline;

  const ports: Ports = {
    deploy: async (candidate) => ({
      url: `local://preview/${candidate.replace(/^sha256:/, "")}`,
      versionId: `launch-proof-${candidate.slice(-12)}`,
      detail: "file-backed preview; no live traffic",
    }),
    runFanout: localFanout,
    sign: (artifactDigest, evidence, pass) =>
      signProof(
        makeProof({
          artifactDigest,
          verifier: verifier.keyId,
          policy: "airlock/launch-proof@1",
          result: pass ? "pass" : "fail",
          evidence,
        }),
        verifier.keyId,
        verifier.privatePem,
      ),
    trusted,
    setFeatureGate: async (candidate, on) => {
      if (on) selected = candidate;
      return { productionChanged: on, requestRecorded: false };
    },
  };

  const passingJobs: TestJob[] = [
    { name: "unit", run: () => ({ name: "unit", ok: true, detail: "declared unit check passed" }) },
    { name: "preview-smoke", run: () => ({ name: "preview-smoke", ok: true, detail: "preview returned expected marker" }) },
  ];
  const success = await runPipeline({ repo: "launch-proof", candidate: passingCandidate }, passingJobs, ports);
  const selectedAfterSuccess = selected;
  if (!success.admitted || !success.promoted || selected !== passingCandidate) throw new Error("launch-proof: passing candidate was not selected");

  const selectedBeforeFailure = selected;
  const failingJobs: TestJob[] = [
    { name: "unit", run: () => ({ name: "unit", ok: true, detail: "declared unit check passed" }) },
    { name: "preview-smoke", run: () => ({ name: "preview-smoke", ok: false, detail: "injected preview failure" }) },
  ];
  const failedCheck = await runPipeline({ repo: "launch-proof", candidate: failingCandidate }, failingJobs, ports);
  const selectedAfterFailure = selected;
  if (failedCheck.admitted || failedCheck.promoted || selected !== selectedBeforeFailure) throw new Error("launch-proof: failed candidate changed the selected digest");

  // A real Ed25519 signature remains cryptographically valid, but Keel's
  // Keyring refuses the key after revocation. Signature validity alone is not
  // authority.
  const revokedSigner = makeKeyPair();
  const signedMessage = Buffer.from("airlock+keel launch proof: revoked key", "utf8");
  const validSignature = nodeSign(null, signedMessage, createPrivateKey(revokedSigner.privatePem));
  const cryptographicallyValid = nodeVerify(null, signedMessage, createPublicKey(revokedSigner.publicPem), validSignature);
  const keyring = new Keyring();
  const keyAddedAt = 1_000;
  const revokedAt = 2_000;
  const checkedAt = 3_000;
  keyring.add({ keyId: revokedSigner.keyId, publicPem: revokedSigner.publicPem, notBefore: keyAddedAt });
  keyring.revoke(revokedSigner.keyId, revokedAt);
  const revokedDecision = keyring.verifyActive(revokedSigner.keyId, signedMessage, validSignature, checkedAt);
  if (!cryptographicallyValid || revokedDecision.trusted || revokedDecision.reason !== "key revoked") throw new Error("launch-proof: revoked-key case did not fail for revocation");

  // Keel's real promote() first advances the baseline, then refuses a second
  // valid candidate carrying the stale expected baseline. The newer head stays.
  const repo = "launch-proof/repo";
  const staleBaseline = digest("launch-proof/stale-baseline");
  const newerCandidate = digest("launch-proof/newer-candidate");
  const staleCandidate = digest("launch-proof/stale-candidate");
  const promotionSigner = makeKeyPair();
  const promotionTrusted: TrustedKeys = { [promotionSigner.keyId]: promotionSigner.publicPem };
  const now = 1_000_000;
  const token: ScopedToken = { repo, scope: "write", expiresAt: now + 60_000 };
  const store = new RefStore({ [repo]: staleBaseline });
  const newerProof = signProof(
    makeProof({ artifactDigest: newerCandidate, verifier: promotionSigner.keyId, policy: "airlock/launch-proof-cas@1", result: "pass", evidence: "checks=pass" }),
    promotionSigner.keyId,
    promotionSigner.privatePem,
  );
  const staleProof = signProof(
    makeProof({ artifactDigest: staleCandidate, verifier: promotionSigner.keyId, policy: "airlock/launch-proof-cas@1", result: "pass", evidence: "checks=pass" }),
    promotionSigner.keyId,
    promotionSigner.privatePem,
  );
  const advance = promote(store, { repo, expectedBaseline: staleBaseline, candidate: newerCandidate, token, signedProof: newerProof }, promotionTrusted, now);
  const stale = promote(store, { repo, expectedBaseline: staleBaseline, candidate: staleCandidate, token, signedProof: staleProof }, promotionTrusted, now);
  const headAfterStale = store.head(repo);
  if (!advance.ok || stale.ok || !stale.reason.includes("lease stale") || headAfterStale !== newerCandidate) throw new Error("launch-proof: stale candidate was not refused with newer baseline intact");

  const receipt = {
    schema: "airlock+keel/launch-proof@1",
    generatedAt: new Date().toISOString(),
    claim: "One integrated run uses Airlock's runPipeline and the pinned Keel dependency to show one admitted candidate and three fail-closed refusals.",
    provenance: keelProvenance(),
    limits: [
      "The preview is file-backed and receives no live traffic; this run does not deploy to Cloudflare.",
      "The Airlock success candidate is the source-tree digest computed by src/ports/digest.mjs; the Keel compare-and-swap case uses deterministic synthetic candidate digests.",
      "The selected pointer is local demo state; production promotion remains caller-owned.",
      "This proves these fixed cases, not production readiness, universal test isolation, or agent safety at scale.",
    ],
    trust: { verifierKeyId: verifier.keyId, trusted },
    success: {
      candidate: passingCandidate,
      previewUrl: success.slot.url,
      evidence: success.evidence,
      results: success.results,
      proof: success.proof,
      admitted: success.admitted,
      promoted: success.promoted,
      selectedBefore: baseline,
      selectedAfter: selectedAfterSuccess,
    },
    refusals: {
      failedAirlockCheck: {
        candidate: failingCandidate,
        previewUrl: failedCheck.slot.url,
        evidence: failedCheck.evidence,
        results: failedCheck.results,
        proof: failedCheck.proof,
        admitted: failedCheck.admitted,
        promoted: failedCheck.promoted,
        selectedBefore: selectedBeforeFailure,
        selectedAfter: selectedAfterFailure,
        reason: failedCheck.reason,
      },
      revokedKey: {
        keyId: revokedSigner.keyId,
        publicPem: revokedSigner.publicPem,
        messageBase64: signedMessage.toString("base64"),
        signatureBase64: validSignature.toString("base64"),
        keyAddedAt,
        revokedAt,
        checkedAt,
        cryptographicallyValid,
        keelDecision: revokedDecision,
      },
      staleBaseline: {
        repo,
        expectedBaseline: staleBaseline,
        newerCandidate,
        staleCandidate,
        token,
        checkedAt: now,
        trusted: promotionTrusted,
        newerProof,
        staleProof,
        initialAdvance: advance,
        staleAttempt: stale,
        headAfterStale,
      },
    },
  };

  writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
  writeFileSync(
    RECEIPT_MARKDOWN_PATH,
    `# Airlock + Keel launch-proof receipt\n\n` +
      `Pinned Keel commit: \`${receipt.provenance.resolvedCommit}\`\n\n` +
      `| Case | Decision | Evidence |\n` +
      `|---|---|---|\n` +
      `| Passing candidate | **ADMITTED** | \`${success.evidence}\`; selected \`${passingCandidate}\` |\n` +
      `| Failed Airlock check | **REFUSED** | \`${failedCheck.evidence}\`; prior selection remained \`${selectedAfterFailure}\` |\n` +
      `| Valid signature, revoked key | **REFUSED** | cryptographic signature valid; Keel decision: \`${revokedDecision.reason}\` |\n` +
      `| Valid stale candidate | **REFUSED** | \`${stale.ok ? "unexpectedly admitted" : stale.reason}\`; newer baseline remained \`${headAfterStale}\` |\n\n` +
      `Run \`bun run launch-proof:verify\` to independently check the JSON receipt.\n\n` +
      `## Limits\n\n${receipt.limits.map((limit) => `- ${limit}`).join("\n")}\n`,
  );
  console.log("PASS success: passing candidate selected after signed proof verification");
  console.log("PASS refusal 1: failed Airlock check left prior candidate selected");
  console.log("PASS refusal 2: valid signature refused because Keel key was revoked");
  console.log("PASS refusal 3: stale Keel promotion refused; newer baseline survived");
  console.log(`RECEIPT ${RECEIPT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
