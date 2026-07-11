// Type declarations for digest.mjs (kept as .mjs so node-run gate.mjs can import
// the exact same implementation the deploy/sign path uses).
export const DIGEST_EXCLUDES: string[];
export function sourceFiles(repoRoot: string): string[];
export function fileDigests(repoRoot: string): Record<string, string>;
export function candidateDigest(repoRoot: string): string;
export function candidateDigestAtCommit(repoRoot: string, commit: string): string;
