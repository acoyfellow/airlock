// The sign port: the verifier signs exactly what fanout observed, bound to the
// exact candidate digest. This is keel's real signProof over a real makeProof —
// no self-grading, no inline trust. The private key arrives via loadVerifier
// and is never logged here.

import { makeProof, signProof, type SignedProof } from "keel";
import type { Verifier } from "./keys.ts";

export const SIGN_POLICY = "airlock/self-deliver-fanout@1";

export function makeSigner(verifier: Verifier) {
  return (candidate: string, evidence: string, pass: boolean): SignedProof =>
    signProof(
      makeProof({
        artifactDigest: candidate,
        verifier: verifier.keyId,
        policy: SIGN_POLICY,
        result: pass ? "pass" : "fail",
        evidence,
      }),
      verifier.keyId,
      verifier.privatePem,
    );
}
