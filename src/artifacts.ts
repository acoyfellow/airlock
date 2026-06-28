// The ARTIFACTS REPO node of the napkin: a content-addressed store. The
// candidate IS the content — candidate = "sha256:" + sha256(bundle) — so a
// bundle cannot lie about its own name and two pushes of identical content
// collapse to one candidate (idempotent put). `onPush` is the trigger the agent
// calls after a put; it hands the candidate to whatever the pipeline wired in.
//
// Local backend: a directory under .data/ (gitignored). Each object is one file
// named for its digest, holding the raw bundle bytes. Cloud-portable: the same
// shape sits on R2/KV by swapping the two fs calls for bucket get/put.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** candidate = "sha256:<hex>" of the exact bundle bytes. Verifiable by anyone. */
export function digestBundle(bundle: string): string {
  return "sha256:" + createHash("sha256").update(bundle, "utf8").digest("hex");
}

export interface ArtifactStore {
  /** Store a bundle and return its content address (the candidate). Idempotent. */
  put(bundle: string): string;
  /** Fetch the exact bytes a candidate addresses, or null if unknown. */
  get(candidate: string): string | null;
  /** True if the store holds this candidate. */
  has(candidate: string): boolean;
}

/** A directory-backed content-addressed store under `dir` (e.g. .data/artifacts). */
export class FileArtifactStore implements ArtifactStore {
  #dir: string;
  constructor(dir: string) {
    this.#dir = dir;
    mkdirSync(dir, { recursive: true });
  }
  #path(candidate: string): string {
    // file name is the hex digest; ":" is not path-safe everywhere
    return join(this.#dir, candidate.replace(/^sha256:/, "") + ".bundle");
  }
  put(bundle: string): string {
    const candidate = digestBundle(bundle);
    const p = this.#path(candidate);
    if (!existsSync(p)) writeFileSync(p, bundle);
    return candidate;
  }
  get(candidate: string): string | null {
    const p = this.#path(candidate);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  }
  has(candidate: string): boolean {
    return existsSync(this.#path(candidate));
  }
}

export type PushHandler = (candidate: string) => Promise<unknown>;

/**
 * The repo + its push trigger. `push(bundle)` stores the bundle (deriving the
 * candidate) and fires the handler — exactly the "agent pushes a candidate ->
 * on push" edge of the napkin. Returns the candidate and the handler's result.
 */
export class ArtifactsRepo {
  #store: ArtifactStore;
  #onPush: PushHandler;
  constructor(store: ArtifactStore, onPush: PushHandler) {
    this.#store = store;
    this.#onPush = onPush;
  }
  get store(): ArtifactStore {
    return this.#store;
  }
  async push(bundle: string): Promise<{ candidate: string; result: unknown }> {
    const candidate = this.#store.put(bundle);
    const result = await this.#onPush(candidate);
    return { candidate, result };
  }
}
