// The DEPLOY node of the napkin: stage a candidate to a NON-serving slot.
// Deploying records the candidate in a "staged" slot — it does NOT change what
// the webapp serves. Only the gate (gate.ts) flips the served slot, and only
// for an admitted candidate. Tests can reach the staged candidate; users still
// see the previously promoted version.
//
// Local backend: a single JSON file under .data/ (gitignored) holding both
// slots. Cloud-portable: the same { served, staged } record lives in KV/DO.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DeploySlot } from "./pipeline.ts";

type Slots = {
  served: string | null; // candidate currently answering production traffic
  staged: string | null; // candidate deployed for testing, awaiting the gate
};

/** A file-backed two-slot model: one served, one staged for testing. */
export class SlotStore {
  #path: string;
  constructor(path: string) {
    this.#path = path;
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) this.#write({ served: null, staged: null });
  }
  #read(): Slots {
    return JSON.parse(readFileSync(this.#path, "utf8")) as Slots;
  }
  #write(s: Slots): void {
    // Atomic: write to a temp file then rename, so a crash mid-write can never
    // leave the served-pointer file half-written (which would throw on next
    // read). The cloud port gets this for free from a DO storage.put.
    const tmp = `${this.#path}.tmp`;
    writeFileSync(tmp, JSON.stringify(s, null, 2));
    renameSync(tmp, this.#path);
  }
  /** Stage a candidate for testing. Does NOT touch the served slot. */
  stage(candidate: string): void {
    const s = this.#read();
    s.staged = candidate;
    this.#write(s);
  }
  /** Promote: the served slot now points at `candidate`. Called only by the gate. */
  serve(candidate: string): void {
    const s = this.#read();
    s.served = candidate;
    this.#write(s);
  }
  served(): string | null {
    return this.#read().served;
  }
  staged(): string | null {
    return this.#read().staged;
  }
}

/**
 * A `deploy` port (matches Ports.deploy) that stages the candidate for testing
 * and returns a URL addressed by the candidate. Staging never changes
 * the served version.
 */
export function makeLocalDeployer(slots: SlotStore, baseUrl = "local://preview") {
  return async (candidate: string): Promise<DeploySlot> => {
    slots.stage(candidate);
    return { url: `${baseUrl}/${candidate.replace(/^sha256:/, "")}`, detail: "staged (non-serving)" };
  };
}
