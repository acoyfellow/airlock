// The deploy port: push the built site to a Cloudflare Worker that receives no
// production traffic. The Worker is addressed by the candidate digest
// (the existing hostname prefix is `airlock-dark-`) on a *.workers.dev URL. It serves the
// candidate so tests and the gate can look at it, but it is NOT wired to the
// production custom domain (airlock.coey.dev). Deploying is not promoting.
//
// Promotion — pointing the prod route at an admitted candidate — is a separate,
// human-gated step (see setFeatureGate) and is intentionally out of this port.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DeploySlot } from "../pipeline.ts";

export type DeployConfig = {
  repoRoot: string;
  accountId: string;
  // resolved at deploy time; lets the example/gate stay account-agnostic
  wranglerBin?: string;
};

const SITE_DIR = "site";
const BUILD_DIR = ".svelte-kit/cloudflare"; // adapter-cloudflare output
const PREVIEW_CONFIG = ".preview.wrangler.jsonc";

/** A worker name derived from the candidate digest: stable, dns-safe, <= 63 ch. */
export function candidateWorkerName(candidate: string): string {
  const hex = candidate.replace(/^sha256:/, "").toLowerCase();
  return `airlock-dark-${hex.slice(0, 24)}`;
}

function wrangler(cfg: DeployConfig): string {
  return cfg.wranglerBin ?? join(cfg.repoRoot, SITE_DIR, "node_modules/.bin/wrangler");
}

/**
 * Deploy the already-built site to a preview Worker for `candidate`.
 * Requires `site/.svelte-kit/cloudflare` to exist (run the build first).
 */
export function makeDeployer(cfg: DeployConfig) {
  return async (candidate: string): Promise<DeploySlot> => {
    const siteDir = join(cfg.repoRoot, SITE_DIR);
    const name = candidateWorkerName(candidate);

    // @sveltejs/adapter-cloudflare (pinned 7.2.9 in site/package.json) emits
    // _worker.js / _routes.json / _headers into the assets dir; tell wrangler not
    // to publish those as public assets. This list is coupled to the adapter's
    // output layout — revisit it when bumping the adapter pin.
    writeFileSync(
      join(siteDir, BUILD_DIR, ".assetsignore"),
      "_worker.js\n_routes.json\n_headers\n",
    );

    const out = execFileSync(
      wrangler(cfg),
      ["deploy", "--config", PREVIEW_CONFIG, "--name", name],
      {
        cwd: siteDir,
        encoding: "utf8",
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: cfg.accountId },
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    const url = parseWorkersDevUrl(out, name);
    const versionId = /Current Version ID:\s*([0-9a-f-]+)/i.exec(out)?.[1];
    if (!url) {
      throw new Error(`deploy(${name}): could not find a workers.dev URL in wrangler output`);
    }
    if (!versionId) throw new Error(`deploy(${name}): Wrangler output omitted Current Version ID`);
    return { url, versionId, detail: `version ${versionId}` };
  };
}

export function parseWorkersDevUrl(stdout: string, name: string): string | null {
  const matches = stdout.match(/https:\/\/[^\s]+\.workers\.dev/g) ?? [];
  // prefer the URL that carries this worker's name
  const exact = matches.find((u) => u.includes(name));
  return exact ?? matches[0] ?? null;
}
