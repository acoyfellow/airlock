// Candidate digest: a content address for THIS repo's deliverable source tree.
//
// The digest is computed identically by the deploy path (to name + bind the
// dark slot) and by the honesty gate (to independently recompute and verify the
// keel proof binds the exact same bytes). It must therefore be deterministic and
// depend only on tracked source, never on build artifacts, secrets, or the
// generated receipt it later carries.
//
// Source set = `git ls-files --cached --others --exclude-standard` (the working
// tree minus anything .gitignore excludes: node_modules, build output, .env).
// We then drop the dogfood harness and the generated receipt, because those are
// not part of the product being delivered and would otherwise make the digest
// chase its own tail.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Paths excluded from the candidate identity (prefix match on POSIX relpath).
export const DIGEST_EXCLUDES = [
  "experiments/", // the dogfood loop harness (SPEC, gate, receipts, logs)
  "site/src/lib/receipt.ts", // generated: the receipt the served site carries
  "RECEIPT.json",
];

function isExcluded(relPath) {
  return DIGEST_EXCLUDES.some((p) =>
    p.endsWith("/") ? relPath.startsWith(p) : relPath === p,
  );
}

/** The sorted list of source files (POSIX relpaths) that define the candidate. */
export function sourceFiles(repoRoot) {
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !isExcluded(l))
    .sort();
}

/**
 * Per-file digest table: relpath -> sha256(content) hex. Useful for debugging
 * digest drift between the deployer and the gate.
 */
export function fileDigests(repoRoot) {
  const table = {};
  for (const rel of sourceFiles(repoRoot)) {
    const bytes = readFileSync(join(repoRoot, rel));
    table[rel] = createHash("sha256").update(bytes).digest("hex");
  }
  return table;
}

/**
 * The candidate digest: sha256 over the canonical "<relpath>\0<filehash>\n"
 * stream across the sorted source set. Returns "sha256:<hex>".
 */
export function candidateDigest(repoRoot) {
  const table = fileDigests(repoRoot);
  const top = createHash("sha256");
  for (const rel of Object.keys(table).sort()) {
    top.update(rel);
    top.update("\0");
    top.update(table[rel]);
    top.update("\n");
  }
  return `sha256:${top.digest("hex")}`;
}
