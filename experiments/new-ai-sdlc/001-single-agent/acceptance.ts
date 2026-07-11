import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const moduleUrl = pathToFileURL(resolve(root, "site/src/lib/launch-proof.ts")).href;
const receipt = await Bun.file(resolve(root, "experiments/launch-proof/RECEIPT.json")).json();
const { verifyLaunchProofReceipt } = await import(moduleUrl);

async function expect(label: string, value: unknown, ok: boolean) {
  let result;
  try {
    result = await verifyLaunchProofReceipt(value);
  } catch (error) {
    throw new Error(`${label}: verifier threw ${error}`);
  }
  if (result?.ok !== ok) throw new Error(`${label}: expected ok=${ok}, got ${JSON.stringify(result)}`);
  if (typeof result.reason !== "string" || result.reason.length === 0) {
    throw new Error(`${label}: missing bounded reason`);
  }
}

const copy = () => structuredClone(receipt);
await expect("public fixture", copy(), true);

const artifactTamper = copy();
artifactTamper.success.proof.proof.artifactDigest = `sha256:${"0".repeat(64)}`;
await expect("artifact binding tamper", artifactTamper, false);

const signatureTamper = copy();
signatureTamper.success.proof.signature = `A${signatureTamper.success.proof.signature.slice(1)}`;
await expect("signature tamper", signatureTamper, false);

const schemaTamper = copy();
schemaTamper.schema = "unknown@1";
await expect("unknown schema", schemaTamper, false);

const trustTamper = copy();
trustTamper.trust.trusted = {};
await expect("untrusted verifier", trustTamper, false);
await expect("malformed input", null, false);

console.log("PASS launch-proof acceptance 6/6");
