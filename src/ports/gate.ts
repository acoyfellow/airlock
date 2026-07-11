// The setFeatureGate port: the ONLY promote effect. Promotion means pointing
// production routing (airlock.coey.dev) at the admitted candidate's slot.
//
// For prod this is HUMAN-GATED by design — it is the whole point of the loop.
// In the dogfood configuration this port never flips prod. When keel admits and
// the pipeline asks to promote, it records a promotion REQUEST (the proof + slot
// the owner would approve) and leaves the prod route untouched. Turning the gate
// off is a no-op record. An actual prod flip is refused unless explicitly armed.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export type GateConfig = {
  repoRoot: string;
  previewUrl: () => string | undefined; // resolved preview URL for the request record
  // Only an owner, out of band, would arm a real prod flip. Default: refuse.
  allowProdFlip?: boolean;
};

export function makeHumanGate(cfg: GateConfig) {
  return async (candidate: string, on: boolean): Promise<void> => {
    if (!on) return; // leaving the gate off needs no effect

    if (!cfg.allowProdFlip) {
      const request = {
        candidate,
        previewUrl: cfg.previewUrl() ?? null,
        requestedAt: new Date().toISOString(),
        note: "keel admitted this candidate. Promotion to airlock.coey.dev is human-gated; prod route left unchanged.",
      };
      writeFileSync(
        join(cfg.repoRoot, "experiments/dogfood/PROMOTE_REQUEST.json"),
        JSON.stringify(request, null, 2),
      );
      return;
    }

    // Armed prod promotion is intentionally not automated here: pointing the
    // custom domain at a version is the owner-held action. Fail closed.
    throw new Error("prod promotion is owner-held and not automated by this port");
  };
}
