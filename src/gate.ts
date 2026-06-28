// The PROMOTE GATE node of the napkin, keel-gated. This is where a candidate
// either becomes the served version or is blocked. The whole chain is keel's:
//
//   makeProof  -> signProof  -> verifySignedProof  -> promote (RefStore CAS)
//                                                   -> SignedDecisionLog (audit)
//
// Admission rule (fails closed): a signed proof, bound to THIS exact candidate,
// must verify against the trusted owner key AND report pass. Only then does the
// served ref move (force-with-lease against the current served candidate). A
// failing candidate never moves the ref, so the previously served candidate
// stays served. Every attempt — admit or block — is appended to a hash-chained,
// signed decision log so the audit trail survives an incident.

import {
  makeProof,
  signProof,
  verifySignedProof,
  RefStore,
  promote,
  SignedDecisionLog,
  type SignedProof,
  type TrustedKeys,
} from "../../keel/src/index.ts";
import type { TestResult } from "./pipeline.ts";

export const GATE_POLICY = "new-sdlc/napkin-fanout@1";
export const SERVED_REF = "served"; // the one ref the webapp reads

/** The owner identity that signs admissions. Private PEM stays in memory. */
export type Owner = { keyId: string; privatePem: string; publicPem: string };

/** Evidence string built from fanout results: "name=pass,name=fail,...". */
export function buildEvidence(results: TestResult[]): string {
  return results.map((r) => `${r.name}=${r.ok ? "pass" : "fail"}`).join(",");
}

export type GateOutcome = {
  candidate: string;
  evidence: string;
  proof: SignedProof;
  admitted: boolean;
  promoted: boolean;
  reason: string;
  servedBefore: string | null;
  servedAfter: string | null;
};

/**
 * The keel-gated promote. Owns the served RefStore and the signed decision log.
 * `decide(candidate, results)` runs the full admission chain and only moves the
 * served ref when keel admits. Returns a receipt; the served slot effect is the
 * caller's job (see makeGatedSetFeatureGate), so this stays pure-ish/testable.
 */
export class KeelGate {
  #owner: Owner;
  #trusted: TrustedKeys;
  #refs: RefStore;
  #log: SignedDecisionLog;

  constructor(owner: Owner, refs: RefStore = new RefStore({ [SERVED_REF]: "none" })) {
    this.#owner = owner;
    this.#trusted = { [owner.keyId]: owner.publicPem };
    this.#refs = refs;
    this.#log = new SignedDecisionLog(owner.keyId, owner.privatePem);
  }

  /** Sign exactly what fanout observed, bound to the candidate. keel's signProof. */
  sign(candidate: string, evidence: string, pass: boolean): SignedProof {
    return signProof(
      makeProof({
        artifactDigest: candidate,
        verifier: this.#owner.keyId,
        policy: GATE_POLICY,
        result: pass ? "pass" : "fail",
        evidence,
      }),
      this.#owner.keyId,
      this.#owner.privatePem,
    );
  }

  /** The candidate the served ref currently points at ("none" before first promote). */
  served(): string {
    return this.#refs.head(SERVED_REF) ?? "none";
  }

  get auditLog(): SignedDecisionLog {
    return this.#log;
  }
  get trusted(): TrustedKeys {
    return this.#trusted;
  }

  /**
   * Run the gate for `candidate` given its fanout `results`. Promotes (moves the
   * served ref) only if keel admits a signed proof bound to this candidate.
   */
  decide(candidate: string, results: TestResult[], now: number = Date.now()): GateOutcome {
    const servedBefore = this.served();
    const pass = results.length > 0 && results.every((r) => r.ok);
    const evidence = buildEvidence(results);
    const proof = this.sign(candidate, evidence, pass);

    // keel verifies: signature + binding + pass. Fails closed.
    const decision = verifySignedProof(proof, candidate, this.#trusted);
    if (!decision.admitted) {
      this.#log.append({
        subject: candidate,
        action: "promote",
        argsRef: evidence,
        outcome: "deny",
        reason: decision.reason,
      });
      return {
        candidate, evidence, proof, admitted: false, promoted: false,
        reason: decision.reason, servedBefore, servedAfter: this.served(),
      };
    }

    // admitted: move the served ref with force-with-lease against what's served.
    const out = promote(
      this.#refs,
      {
        repo: SERVED_REF,
        expectedBaseline: servedBefore,
        candidate,
        token: { repo: SERVED_REF, scope: "write", expiresAt: now + 60_000 },
        signedProof: proof,
      },
      this.#trusted,
      now,
    );

    if (!out.ok) {
      this.#log.append({
        subject: candidate, action: "promote", argsRef: evidence,
        outcome: "deny", reason: out.reason,
      });
      return {
        candidate, evidence, proof, admitted: true, promoted: false,
        reason: out.reason, servedBefore, servedAfter: this.served(),
      };
    }

    this.#log.append({
      subject: candidate, action: "promote", argsRef: evidence,
      outcome: "approve", reason: "proof passed",
    });
    return {
      candidate, evidence, proof, admitted: true, promoted: true,
      reason: "proof passed", servedBefore, servedAfter: this.served(),
    };
  }
}
