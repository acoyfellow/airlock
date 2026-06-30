// The verifier identity, loaded from the environment — never hardcoded into
// source, never printed. keel signs a proof with the private key; the trusted
// keyring keel checks admission against is just the matching public key.
//
// Resolution order (first that resolves wins):
//   1. KEEL_VERIFIER_PRIVATE_PEM + KEEL_VERIFIER_PUBLIC_PEM (+ optional
//      KEEL_VERIFIER_KEY_ID) — inline PEM, e.g. injected by CI secrets.
//   2. KEEL_VERIFIER_KEY_FILE — path to a JSON { keyId, privatePem, publicPem }.
//   3. A local bootstrap file (gitignored) at experiments/dogfood/.verifier-key.json.
//      If absent, a fresh ed25519 keypair is minted and persisted there 0600.
//
// Only the PUBLIC key and keyId are ever surfaced. The private PEM stays in
// memory and is handed straight to keel's signProof.

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { makeKeyPair, type TrustedKeys } from "keel";

export type Verifier = {
  keyId: string;
  privatePem: string;
  publicPem: string;
};

export type LoadedVerifier = {
  verifier: Verifier;
  trusted: TrustedKeys;
  source: string; // where the key came from (no secret material)
};

function fingerprintKeyId(publicPem: string): string {
  // Mirror keel's makeKeyPair keyId scheme so a supplied public PEM gets a
  // stable, key-derived id when KEEL_VERIFIER_KEY_ID is not provided.
  const { createPublicKey, createHash } = require("node:crypto");
  const der = createPublicKey(publicPem).export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 16);
}

function fromInlineEnv(): Verifier | null {
  const privatePem = process.env.KEEL_VERIFIER_PRIVATE_PEM;
  const publicPem = process.env.KEEL_VERIFIER_PUBLIC_PEM;
  if (!privatePem || !publicPem) return null;
  const keyId = process.env.KEEL_VERIFIER_KEY_ID ?? fingerprintKeyId(publicPem);
  return { keyId, privatePem, publicPem };
}

function fromKeyFile(path: string): Verifier {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw.privatePem || !raw.publicPem) {
    throw new Error(`verifier key file ${path} missing privatePem/publicPem`);
  }
  const keyId = raw.keyId ?? fingerprintKeyId(raw.publicPem);
  return { keyId, privatePem: raw.privatePem, publicPem: raw.publicPem };
}

function bootstrapKeyFile(path: string): Verifier {
  mkdirSync(dirname(path), { recursive: true });
  const kp = makeKeyPair();
  const v: Verifier = { keyId: kp.keyId, privatePem: kp.privatePem, publicPem: kp.publicPem };
  writeFileSync(path, JSON.stringify(v, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
  return v;
}

export function loadVerifier(repoRoot: string): LoadedVerifier {
  const inline = fromInlineEnv();
  if (inline) {
    return { verifier: inline, trusted: { [inline.keyId]: inline.publicPem }, source: "env:inline-pem" };
  }

  const envPath = process.env.KEEL_VERIFIER_KEY_FILE;
  if (envPath) {
    const path = isAbsolute(envPath) ? envPath : join(repoRoot, envPath);
    const v = fromKeyFile(path);
    return { verifier: v, trusted: { [v.keyId]: v.publicPem }, source: `env:key-file` };
  }

  const defaultPath = join(repoRoot, "experiments/dogfood/.verifier-key.json");
  const v = existsSync(defaultPath) ? fromKeyFile(defaultPath) : bootstrapKeyFile(defaultPath);
  return {
    verifier: v,
    trusted: { [v.keyId]: v.publicPem },
    source: existsSync(defaultPath) ? "bootstrap:local-file" : "bootstrap:minted",
  };
}
