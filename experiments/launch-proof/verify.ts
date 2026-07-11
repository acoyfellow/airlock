import { createPublicKey, verify as nodeVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Keyring,
  RefStore,
  promote,
  verifySignedProof,
  type ScopedToken,
  type SignedProof,
  type TrustedKeys,
} from "keel";
import { candidateDigest } from "../../src/ports/digest.mjs";

const ROOT = join(import.meta.dir, "../..");
const receipt = JSON.parse(readFileSync(join(import.meta.dir, "RECEIPT.json"), "utf8")) as any;
const markdownReceipt = readFileSync(join(import.meta.dir, "RECEIPT.md"), "utf8");
const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: unknown, detail = "") => checks.push({ name, ok: ok === true, detail });

check("receipt schema", receipt.schema === "airlock+keel/launch-proof@1", receipt.schema);
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: { keel: string } };
const lock = readFileSync(join(ROOT, "bun.lock"), "utf8");
const resolved = /"keel": \["keel@github:acoyfellow\/keel#([0-9a-f]+)"/.exec(lock)?.[1];
check("receipt names the real Keel dependency", receipt.provenance?.dependency === pkg.dependencies.keel, receipt.provenance?.dependency);
check("receipt pins the installed Keel commit", Boolean(resolved) && receipt.provenance?.resolvedCommit === resolved, `${receipt.provenance?.resolvedCommit} == ${resolved}`);
check("honest limits preserved", receipt.limits?.length === 4 && receipt.limits.every((limit: unknown) => typeof limit === "string"), `${receipt.limits?.length ?? 0} limits`);
check("human-readable receipt matches all four outcomes", markdownReceipt.includes("Passing candidate | **ADMITTED**") && (markdownReceipt.match(/\| \*\*REFUSED\*\*/g)?.length ?? 0) === 3 && markdownReceipt.includes(receipt.provenance.resolvedCommit), "1 admitted + 3 refused");

const success = receipt.success;
const successDecision = verifySignedProof(success.proof as SignedProof, success.candidate, receipt.trust.trusted as TrustedKeys);
check("success candidate is the current source-tree digest", success.candidate === candidateDigest(ROOT), success.candidate);
check("success proof independently verifies", successDecision.admitted === true, successDecision.reason);
check("success checks all passed", success.results?.length === 2 && success.results.every((result: any) => result.ok === true), success.evidence);
check("success selected only the proven candidate", success.admitted === true && success.promoted === true && success.selectedAfter === success.candidate && success.selectedBefore !== success.selectedAfter, `${success.selectedBefore} -> ${success.selectedAfter}`);
check("success uses a local preview with no live traffic", typeof success.previewUrl === "string" && success.previewUrl.startsWith("local://preview/"), success.previewUrl);

const failed = receipt.refusals.failedAirlockCheck;
const failedDecision = verifySignedProof(failed.proof as SignedProof, failed.candidate, receipt.trust.trusted as TrustedKeys);
check("failed-check proof independently refuses", failedDecision.admitted === false, failedDecision.reason);
check("one declared Airlock check really failed", failed.results?.some((result: any) => result.ok === false) === true && failed.evidence.includes("preview-smoke=fail"), failed.evidence);
check("failed candidate never selected", failed.admitted === false && failed.promoted === false && failed.selectedBefore === failed.selectedAfter && failed.selectedAfter === success.selectedAfter, `${failed.selectedBefore} -> ${failed.selectedAfter}`);

const revoked = receipt.refusals.revokedKey;
const message = Buffer.from(revoked.messageBase64, "base64");
const signature = Buffer.from(revoked.signatureBase64, "base64");
const cryptoValid = nodeVerify(null, message, createPublicKey(revoked.publicPem), signature);
const ring = new Keyring();
ring.add({ keyId: revoked.keyId, publicPem: revoked.publicPem, notBefore: revoked.keyAddedAt });
ring.revoke(revoked.keyId, revoked.revokedAt);
const revokedDecision = ring.verifyActive(revoked.keyId, message, signature, revoked.checkedAt);
check("revoked signature is cryptographically valid", cryptoValid === true && revoked.cryptographicallyValid === true, `crypto=${cryptoValid}`);
check("real Keel Keyring refuses the revoked key", revokedDecision.trusted === false && revokedDecision.reason === "key revoked" && revoked.keelDecision?.reason === "key revoked", revokedDecision.trusted ? "trusted" : revokedDecision.reason);

const stale = receipt.refusals.staleBaseline;
const store = new RefStore({ [stale.repo]: stale.expectedBaseline });
const advance = promote(
  store,
  {
    repo: stale.repo,
    expectedBaseline: stale.expectedBaseline,
    candidate: stale.newerCandidate,
    token: stale.token as ScopedToken,
    signedProof: stale.newerProof as SignedProof,
  },
  stale.trusted as TrustedKeys,
  stale.checkedAt,
);
const staleAttempt = promote(
  store,
  {
    repo: stale.repo,
    expectedBaseline: stale.expectedBaseline,
    candidate: stale.staleCandidate,
    token: stale.token as ScopedToken,
    signedProof: stale.staleProof as SignedProof,
  },
  stale.trusted as TrustedKeys,
  stale.checkedAt,
);
check("newer candidate advances from the expected baseline", advance.ok === true && stale.initialAdvance?.ok === true, advance.ok ? advance.newHead : advance.reason);
check("real Keel promote refuses stale baseline", staleAttempt.ok === false && staleAttempt.reason.includes("lease stale") && stale.staleAttempt?.reason.includes("lease stale"), staleAttempt.ok ? staleAttempt.newHead : staleAttempt.reason);
check("newer baseline survives stale attempt", store.head(stale.repo) === stale.newerCandidate && stale.headAfterStale === stale.newerCandidate, store.head(stale.repo));

for (const result of checks) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
const failedChecks = checks.filter((result) => !result.ok);
if (failedChecks.length) {
  console.error(`\n${failedChecks.length}/${checks.length} launch-proof checks failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} launch-proof checks passed`);
