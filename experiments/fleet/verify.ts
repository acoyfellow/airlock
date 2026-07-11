import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifySignedProof, type SignedProof, type TrustedKeys } from "keel";

const receipt = JSON.parse(readFileSync(join(import.meta.dir, "RECEIPT.json"), "utf8")) as any;
const checks: Array<[string, boolean]> = [];
const check = (name: string, value: unknown) => checks.push([name, value === true]);

check("experiment passed", receipt.status === "pass");
check("honest limits are preserved", receipt.limits?.length === 4 && receipt.limits.some((limit: string) => limit.includes("not autonomous model agents")) && receipt.limits.some((limit: string) => limit.includes("not arbitrary program semantics")));
check("five independent process receipts", receipt.agents?.length === 5 && new Set(receipt.agents.map((a: any) => a.pid)).size === 5);
check("all commits share the recorded base", receipt.agents?.every((a: any) => a.parent === receipt.base));
check("every worker produced a distinct commit", new Set(receipt.agents?.map((a: any) => a.commit)).size === 5);
check("every worker patch is preserved", receipt.agents?.every((a: any) => typeof a.patch === "string" && a.patch.length > 0));
check("naive integration really collided in app.json", receipt.textCollision?.observed === true && receipt.textCollision.conflictedFiles?.includes("app.json"));
check("compatible contracts accepted", JSON.stringify([...receipt.accepted].sort()) === JSON.stringify(["banner", "currency", "docs"]));
check("incompatible contracts explicitly blocked", JSON.stringify(receipt.blocked?.map((x: any) => x.task).sort()) === JSON.stringify(["timeout-fast", "timeout-slow"]));
check("accepted values survived reconciliation", receipt.integration?.app?.banner === "fleet-ready" && receipt.integration?.app?.currency === "EUR");
check("blocked behavior stayed at the base value", receipt.integration?.app?.checkoutTimeoutMs === 10_000);

const recomputed = `sha256:${createHash("sha256")
  .update(JSON.stringify(receipt.integration.app))
  .update("\n")
  .update(`${receipt.integration.readme}\n`)
  .digest("hex")}`;
check("candidate digest recomputes from the final files", recomputed === receipt.integration.candidate);
check("every combined check passed", receipt.pipeline?.results?.length === 4 && receipt.pipeline.results.every((r: any) => r.ok === true));
check("candidate was admitted and selected", receipt.pipeline?.admitted === true && receipt.pipeline?.promoted === true && receipt.pipeline?.served === recomputed);
const decision = verifySignedProof(receipt.pipeline.proof as SignedProof, recomputed, receipt.pipeline.trusted as TrustedKeys);
check("signed proof verifies independently", decision.admitted === true);

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} verification checks failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} verification checks passed`);
