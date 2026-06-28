// The WEBAPP node of the napkin: it serves the artifacts version the gate told
// it to, and nothing else. `servedVersion()` reads the served candidate; the
// gate is the only thing that changes it. `serve(candidate)` returns THAT
// candidate's exact bytes out of the artifacts store (404 if the webapp is
// asked for a version it was never told to serve).
//
// "each feature = a test + a flag": a feature's flag is ON only if its named
// test PASSED in the candidate currently served. A blocked candidate never
// becomes served, so a feature whose test failed never has its flag flip on.

import type { ArtifactStore } from "./artifacts.ts";
import type { TestResult } from "./pipeline.ts";

export type Feature = {
  name: string; // the flag name
  test: string; // the test (job) name whose pass gates this flag
  flag: boolean; // resolved: on iff `test` passed in the served candidate
};

/** A feature definition: a flag bound to the name of the test that gates it. */
export type FeatureDef = { name: string; test: string };

export type ServeResponse =
  | { status: 200; candidate: string; body: string }
  | { status: 404; candidate: string; body: string };

/**
 * The served webapp. It holds a pointer to the served candidate and the test
 * evidence that admitted it, plus the artifacts store to read bytes from.
 */
export class Webapp {
  #store: ArtifactStore;
  #served: string | null = null;
  // test results recorded for the served candidate, by candidate
  #evidence = new Map<string, TestResult[]>();
  #features: FeatureDef[];

  constructor(store: ArtifactStore, features: FeatureDef[] = []) {
    this.#store = store;
    this.#features = features;
  }

  /**
   * The gate calls this when (and only when) a candidate is promoted: point the
   * webapp at `candidate` and record the evidence that admitted it.
   */
  setServed(candidate: string, results: TestResult[]): void {
    this.#served = candidate;
    this.#evidence.set(candidate, results);
  }

  /** The candidate the webapp currently serves, or null before the first promote. */
  servedVersion(): string | null {
    return this.#served;
  }

  /** Serve a specific candidate's bytes. 404 unless it is the served version. */
  serve(candidate: string): ServeResponse {
    if (candidate !== this.#served) {
      return { status: 404, candidate, body: `not served: ${candidate}` };
    }
    const body = this.#store.get(candidate);
    if (body === null) {
      return { status: 404, candidate, body: `unknown artifact: ${candidate}` };
    }
    return { status: 200, candidate, body };
  }

  /** Serve whatever is currently promoted. */
  serveCurrent(): ServeResponse {
    if (this.#served === null) {
      return { status: 404, candidate: "none", body: "nothing served yet" };
    }
    return this.serve(this.#served);
  }

  /**
   * Resolve the feature registry against the served candidate's evidence.
   * A feature's flag is ON iff its gating test passed in the served candidate.
   */
  features(): Feature[] {
    const results = this.#served ? this.#evidence.get(this.#served) ?? [] : [];
    const passed = new Set(results.filter((r) => r.ok).map((r) => r.name));
    return this.#features.map((f) => ({ name: f.name, test: f.test, flag: passed.has(f.test) }));
  }

  /** True iff the named feature's flag is on in the served candidate. */
  flag(name: string): boolean {
    return this.features().find((f) => f.name === name)?.flag ?? false;
  }
}
