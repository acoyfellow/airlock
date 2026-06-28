// Assemble the real Ports for delivering THIS repo through its own pipeline.
// Each port is a real effect: deploy to a dark Cloudflare slot, fan tests out on
// terrarium, sign with a keel key from the environment, and a human-gated promote.

export { candidateDigest, sourceFiles, fileDigests, DIGEST_EXCLUDES } from "./digest.mjs";
export { loadVerifier, type Verifier, type LoadedVerifier } from "./keys.ts";
export { makeSigner, SIGN_POLICY } from "./sign.ts";
export { makeDeployer, darkWorkerName, type DeployConfig } from "./deploy.ts";
export {
  makeTerrariumFanout,
  makeTerraChild,
  routeProbeTask,
  terraCommand,
  type TerrariumConfig,
  type FanoutJob,
} from "./fanout.ts";
export { makeHumanGate, type GateConfig } from "./gate.ts";
