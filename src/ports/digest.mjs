// Candidate digest: a content address for THIS repo's deliverable source tree.
//
// The digest is computed identically by the deploy path (to name + bind the
// preview Worker) and by the honesty gate (to independently recompute and verify the
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

function treeEntries(repoRoot, commit) {
  const out = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", commit], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });

  return out
    .subarray(0, -1)
    .toString("binary")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      const [mode, type, object] = record.slice(0, tab).split(" ");
      // `binary` is a one-byte encoding, preserving Git's path bytes exactly.
      return { mode, type, object, path: Buffer.from(record.slice(tab + 1), "binary") };
    })
    .filter((entry) => !isExcluded(entry.path.toString("utf8")))
    .sort((a, b) => Buffer.compare(a.path, b.path));
}

function updateField(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  // Length-prefix fields so neither a filename nor a blob can make an ambiguous stream.
  hash.update(String(bytes.length));
  hash.update("\0");
  hash.update(bytes);
  hash.update("\0");
}

/**
 * Digest the immutable Git tree at `commit`, never the worktree. Each retained tree
 * entry contributes its canonical path, Git object type, mode, and raw blob bytes.
 * Symlinks are Git blobs, so their link text is hashed without resolving the link.
 */
export function candidateDigestAtCommit(repoRoot, commit) {
  const top = createHash("sha256");
  for (const entry of treeEntries(repoRoot, commit)) {
    if (entry.type !== "blob") {
      throw new Error(`candidateDigestAtCommit: unsupported Git tree entry type ${entry.type} at ${entry.path}`);
    }
    const bytes = execFileSync("git", ["cat-file", "blob", entry.object], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    updateField(top, entry.path);
    updateField(top, entry.type);
    updateField(top, entry.mode);
    updateField(top, bytes);
  }
  return `sha256:${top.digest("hex")}`;
}
