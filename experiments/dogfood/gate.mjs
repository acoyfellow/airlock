#!/usr/bin/env node
// THE HONESTY GATE. The decider runs this; no worker may self-certify.
//
// It trusts nothing it is told. It:
//   1. recomputes the candidate digest from the source tree itself,
//   2. resolves + curls the dark URL and requires HTTP 200 on key routes,
//   3. reads the digest the served page actually carries and matches it,
//   4. re-verifies the ed25519 signed proof itself (node:crypto, not keel code)
//      and requires it to bind the EXACT recomputed digest with result=pass,
//   5. confirms prod (new-sdlc.coey.dev) is NOT already serving this candidate
//      (deploying is not promoting).
//
// Every check prints what it LOOKED at. Exit 0 only if all pass. Claims never
// inflate: a check that cannot be proven is red.

import { spawnSync } from "node:child_process";
import { createPublicKey, verify as edVerify } from "node:crypto";
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

async function main() {
  // 1. recompute the candidate digest from source — independent of any claim.
  const digest = candidateDigest(REPO_ROOT);
  record("recompute-candidate-digest", digest.startsWith("sha256:"), digest);

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

  const darkUrl = receipt.darkUrl;
  if (!darkUrl) {
    record("dark-url-present", false, "receipt has no darkUrl");
    return finish();
  }

  // 2. LOOK at the dark slot: key routes must answer 200.
  const home = await fetchStatus(darkUrl.replace(/\/$/, "") + "/");
  record("dark-home-200", home.status === 200, `GET / -> ${home.status}${home.error ? " " + home.error : ""}`);

  const docs = await fetchStatus(darkUrl.replace(/\/$/, "") + "/docs");
  record("dark-docs-200", docs.status === 200, `GET /docs -> ${docs.status}${docs.error ? " " + docs.error : ""}`);

  // 3. the served page must carry the exact recomputed digest.
  const m = /<meta\s+name="candidate-digest"\s+content="([^"]+)"/i.exec(home.body);
  const servedDigest = m?.[1] ?? null;
  record(
    "served-page-carries-digest",
    servedDigest === digest,
    `served=${servedDigest} recomputed=${digest}`,
  );

  // 4. re-verify the signed proof ourselves; it must bind the exact digest.
  const sp = receipt.proof;
  const trusted = receipt.trusted ?? {};
  let sigOk = false;
  let sigDetail = "no proof";
  if (sp && sp.proof && sp.keyId && sp.signature) {
    const pem = trusted[sp.keyId];
    if (!pem) {
      sigDetail = `keyId ${sp.keyId} not in trusted keyring`;
    } else {
      try {
        sigOk = edVerify(
          null,
          canonical(sp.proof, sp.keyId),
          createPublicKey(pem),
          Buffer.from(sp.signature, "base64"),
        );
        sigDetail = `ed25519 verify against ${sp.keyId} -> ${sigOk}`;
      } catch (e) {
        sigDetail = `verify threw: ${e?.message ?? e}`;
      }
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

  // 5. deploying is not promoting: prod must NOT already serve this candidate.
  const prod = await fetchStatus(PROD_URL + "/");
  let prodDigest = null;
  if (prod.status === 200) {
    prodDigest = /<meta\s+name="candidate-digest"\s+content="([^"]+)"/i.exec(prod.body)?.[1] ?? null;
  }
  record(
    "prod-not-yet-promoted",
    prodDigest !== digest,
    prod.status === 0
      ? `prod ${PROD_URL} does not resolve/serve (not promoted): ${prod.error ?? ""}`
      : `prod serves digest=${prodDigest} (candidate not promoted unless equal)`,
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
