#!/usr/bin/env node
// THE HONESTY GATE. The decider runs this; no worker may self-certify.
//
// It trusts nothing it is told — INCLUDING the receipt. It:
//   1. recomputes the candidate digest from the source tree itself, and
//      requires the worktree to be clean so the digest is reproducible from HEAD,
//   2. derives the EXPECTED dark slot name from that digest and refuses to be
//      pointed at any URL that does not match it (the receipt cannot redirect
//      the gate to an attacker-controlled slot),
//   3. curls the dark URL and requires HTTP 200 on / and /docs,
//   4. reads the source digest the served pages actually carry and matches it
//      on BOTH routes, and checks the served evidence/verifier meta matches the
//      receipt (so the page cannot visually lie about its own proof),
//   5. re-verifies the ed25519 signed proof itself (node:crypto, not keel code)
//      against a PINNED trust anchor committed to git (experiments/dogfood/
//      trusted-keys.json) — NOT the keyring carried in the receipt — and requires
//      it to bind the EXACT recomputed digest with result=pass,
//   6. confirms prod (new-sdlc.coey.dev) is NOT already serving this candidate
//      (deploying is not promoting).
//
// NOTE ON WHAT THE DIGEST PROVES: the candidate digest is a content address of
// the SOURCE tree the build was produced from — not a hash of the deployed Worker
// bytes. The served page carries that source digest and the signed proof binds
// it; the gate confirms source==served==receipt==signed against a pinned key. It
// does not (and cannot, since the page embeds its own signed receipt) hash the
// served HTML into the proof. Read the claims accordingly.
//
// Every check prints what it LOOKED at. Exit 0 only if all pass. Claims never
// inflate: a check that cannot be proven is red.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── TLS self-configuration ────────────────────────────────────────────────────
// The gate must verify dark-URL liveness ITSELF, and on a corp network the dark
// *.workers.dev slot is reached through the Cloudflare WARP TLS proxy, whose root
// is not in Node's bundled CA set. Rather than trust the caller to have exported
// NODE_EXTRA_CA_CERTS (and rather than ever disabling verification), the gate
// re-execs itself ONCE with the system CA store enabled and a known corp root
// bundle as NODE_EXTRA_CA_CERTS. This keeps real TLS verification on: if the
// dark cert genuinely cannot be validated, fetch still throws and the liveness
// check fails closed.
function ensureCorpTls() {
  if (process.env.__GATE_TLS_READY === "1") return;
  const home = process.env.HOME ?? "";
  const caCandidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    home && `${home}/.local/share/cloudflare-warp-certs/CloudflareRootCertificateCombined.pem`,
    "/usr/local/share/ca-certificates/Cloudflare_CA.crt",
  ].filter(Boolean);
  const caFile = caCandidates.find((p) => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  });
  const supportsSystemCa =
    process.allowedNodeEnvironmentFlags?.has?.("--use-system-ca") ?? false;
  const nodeFlags = supportsSystemCa ? ["--use-system-ca"] : [];
  const env = { ...process.env, __GATE_TLS_READY: "1" };
  if (caFile) env.NODE_EXTRA_CA_CERTS = caFile;
  const self = fileURLToPath(import.meta.url);
  const r = spawnSync(
    process.execPath,
    [...nodeFlags, self, ...process.argv.slice(2)],
    { stdio: "inherit", env },
  );
  if (r.error) {
    console.error(`[gate] TLS re-exec failed: ${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}
ensureCorpTls();

const { candidateDigest } = await import("../../src/ports/digest.mjs");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROD_URL = "https://new-sdlc.coey.dev";

const checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}\n       ${detail}`);
}

// Canonical bytes for the signed proof — must match keel/src/signed-proof.ts.
function canonical(proof, keyId) {
  const ordered = {
    keyId,
    proof: {
      artifactDigest: proof.artifactDigest,
      verifier: proof.verifier,
      policy: proof.policy,
      result: proof.result,
      evidence: proof.evidence,
    },
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

async function fetchStatus(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const body = await res.text();
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: "", error: String(e?.message ?? e) };
  }
}

function metaContent(body, name) {
  const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i");
  return re.exec(body)?.[1] ?? null;
}

// Derive the dark slot worker name from a digest, identical to
// src/ports/deploy.ts darkWorkerName(). The gate uses this to refuse any URL
// that is not the slot this exact digest would deploy to.
function darkWorkerName(digest) {
  const hex = digest.replace(/^sha256:/, "").toLowerCase();
  return `new-sdlc-dark-${hex.slice(0, 24)}`;
}

async function main() {
  // 1. recompute the candidate digest from source — independent of any claim.
  const digest = candidateDigest(REPO_ROOT);
  record("recompute-candidate-digest", digest.startsWith("sha256:"), digest);

  // 1b. the digest must be reproducible from HEAD: refuse a dirty worktree, or
  // untracked-but-not-ignored files would silently fold into the candidate id.
  let porcelain = "";
  try {
    porcelain = execFileSync("git", ["status", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch (e) {
    porcelain = `<git status failed: ${e?.message ?? e}>`;
  }
  record(
    "source-tree-clean",
    porcelain === "",
    porcelain === ""
      ? "git status --porcelain empty (digest reproducible from HEAD)"
      : `worktree not clean:\n       ${porcelain.replace(/\n/g, "\n       ")}`,
  );

  // 2. load the PINNED trust anchor from git — NOT from the receipt. A receipt
  // that brings its own self-issued key is therefore worthless to an attacker.
  let pinned = {};
  try {
    const pinnedRaw = JSON.parse(
      readFileSync(join(REPO_ROOT, "experiments/dogfood/trusted-keys.json"), "utf8"),
    );
    pinned = pinnedRaw.keys ?? {};
  } catch (e) {
    record("trust-anchor-loaded", false, `trusted-keys.json unreadable: ${e?.message ?? e}`);
    return finish();
  }
  const pinnedIds = Object.keys(pinned);
  record(
    "trust-anchor-loaded",
    pinnedIds.length > 0,
    `pinned verifier key id(s): ${pinnedIds.join(", ") || "<none>"}`,
  );

  // read the receipt the loop produced (but verify everything in it).
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(join(REPO_ROOT, "experiments/dogfood/RECEIPT.json"), "utf8"));
  } catch (e) {
    record("read-receipt", false, `RECEIPT.json unreadable: ${e?.message ?? e}`);
    return finish();
  }
  record("read-receipt", true, `darkUrl=${receipt.darkUrl}`);

  record(
    "receipt-binds-recomputed-digest",
    receipt.candidate === digest,
    `receipt=${receipt.candidate} recomputed=${digest}`,
  );

  // 3. the dark URL must be the slot THIS digest deploys to — derived, not trusted.
  const darkUrl = receipt.darkUrl;
  const expectedName = darkWorkerName(digest);
  const urlHostOk =
    typeof darkUrl === "string" &&
    /^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/i.test(darkUrl) &&
    darkUrl.includes(expectedName);
  record(
    "dark-url-matches-digest",
    urlHostOk,
    `darkUrl=${darkUrl} expected slot name=${expectedName} (*.workers.dev)`,
  );
  if (!darkUrl) return finish();

  // 4. LOOK at the dark slot: key routes must answer 200.
  const base = darkUrl.replace(/\/$/, "");
  const home = await fetchStatus(base + "/");
  record("dark-home-200", home.status === 200, `GET / -> ${home.status}${home.error ? " " + home.error : ""}`);

  const docs = await fetchStatus(base + "/docs");
  record("dark-docs-200", docs.status === 200, `GET /docs -> ${docs.status}${docs.error ? " " + docs.error : ""}`);

  // 5. BOTH served routes must carry the exact recomputed source digest.
  const servedHomeDigest = metaContent(home.body, "candidate-digest");
  record(
    "served-home-carries-digest",
    servedHomeDigest === digest,
    `served / =${servedHomeDigest} recomputed=${digest}`,
  );
  const servedDocsDigest = metaContent(docs.body, "candidate-digest");
  record(
    "served-docs-carries-digest",
    servedDocsDigest === digest,
    `served /docs =${servedDocsDigest} recomputed=${digest}`,
  );

  // 6. the served page's machine-readable proof meta must match the receipt, so
  // the marketing surface cannot visually claim a different proof than the one
  // the gate verifies below.
  const servedEvidence = metaContent(home.body, "candidate-evidence");
  const servedVerifier = metaContent(home.body, "candidate-verifier");
  const evidenceOk =
    servedEvidence === receipt.evidence &&
    servedVerifier === receipt.proof?.proof?.verifier;
  record(
    "served-evidence-matches-receipt",
    evidenceOk,
    `served evidence=${servedEvidence} verifier=${servedVerifier}; receipt evidence=${receipt.evidence} verifier=${receipt.proof?.proof?.verifier}`,
  );

  // 7. re-verify the signed proof ourselves against the PINNED key.
  const sp = receipt.proof;
  const keyId = sp?.keyId;
  const pem = keyId ? pinned[keyId] : null;
  record(
    "proof-key-is-pinned",
    Boolean(pem),
    pem
      ? `proof keyId ${keyId} is in the committed trust anchor`
      : `proof keyId ${keyId ?? "<none>"} is NOT in the pinned trust anchor (would-be forgery rejected)`,
  );

  let sigOk = false;
  let sigDetail = "no proof or unpinned key";
  if (sp && sp.proof && keyId && sp.signature && pem) {
    try {
      sigOk = edVerify(
        null,
        canonical(sp.proof, keyId),
        createPublicKey(pem),
        Buffer.from(sp.signature, "base64"),
      );
      sigDetail = `ed25519 verify against PINNED ${keyId} -> ${sigOk}`;
    } catch (e) {
      sigDetail = `verify threw: ${e?.message ?? e}`;
    }
  }
  record("proof-signature-verifies", sigOk, sigDetail);

  const boundDigest = sp?.proof?.artifactDigest;
  record(
    "proof-binds-exact-digest",
    boundDigest === digest,
    `proof.artifactDigest=${boundDigest} recomputed=${digest}`,
  );
  record(
    "proof-result-pass",
    sp?.proof?.result === "pass",
    `proof.result=${sp?.proof?.result}`,
  );

  // 8. deploying is not promoting: prod must NOT already serve this candidate.
  // Distinguish "prod unreachable" (vacuously safe) from "prod reachable, other
  // digest" so a future DNS break can never masquerade as a real promotion check.
  const prod = await fetchStatus(PROD_URL + "/");
  const prodDigest = prod.status === 200 ? metaContent(prod.body, "candidate-digest") : null;
  record(
    "prod-not-serving-this-candidate",
    prodDigest !== digest,
    prod.status === 0
      ? `prod ${PROD_URL} unreachable (not promoted): ${prod.error ?? ""}`
      : prod.status === 200
        ? `prod reachable, serves digest=${prodDigest} (candidate ${prodDigest === digest ? "IS" : "is NOT"} promoted)`
        : `prod ${PROD_URL} -> HTTP ${prod.status} (not serving this candidate)`,
  );

  return finish();
}

function finish() {
  const failed = checks.filter((c) => !c.ok);
  console.log("\n──────── gate summary ────────");
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.log("RED — not green. Failed checks:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("GREEN — dark candidate proven by looking. Prod promotion remains owner-held.");
  process.exit(0);
}

main();
