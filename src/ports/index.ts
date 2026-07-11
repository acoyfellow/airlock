// Assemble the real Ports for delivering THIS repo through its own pipeline.
// Each port is a real effect: deploy to a preview Worker with no live traffic, fan tests out on
// terrarium, sign with a keel key from the environment, and a human-gated promote.

export { candidateDigest, candidateDigestAtCommit, sourceFiles, fileDigests, DIGEST_EXCLUDES } from "./digest.mjs";
export { loadVerifier, type Verifier, type LoadedVerifier } from "./keys.ts";
export { makeSigner, SIGN_POLICY } from "./sign.ts";
export { makeDeployer, candidateWorkerName, type DeployConfig } from "./deploy.ts";
export {
  makeTerrariumFanout,
  makeTerraChild,
  routeProbeTask,
  terraCommand,
  type TerrariumConfig,
  type FanoutJob,
} from "./fanout.ts";
export { makeHumanGate, type GateConfig } from "./gate.ts";
