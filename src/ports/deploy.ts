// The deploy port: push the built site to a NON-serving Cloudflare slot,
// addressed by the candidate digest. The slot is a standalone Worker named for
// the digest (new-sdlc-dark-<hex>) on a *.workers.dev URL. It serves the
// candidate so tests and the gate can look at it, but it is NOT wired to the
// production custom domain (new-sdlc.coey.dev). Deploying is not promoting.
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
const DARK_CONFIG = ".dark.wrangler.jsonc";

/** A worker name derived from the candidate digest: stable, dns-safe, <= 63 ch. */
export function darkWorkerName(candidate: string): string {
  const hex = candidate.replace(/^sha256:/, "").toLowerCase();
  return `new-sdlc-dark-${hex.slice(0, 24)}`;
}

function wrangler(cfg: DeployConfig): string {
  return cfg.wranglerBin ?? join(cfg.repoRoot, SITE_DIR, "node_modules/.bin/wrangler");
}

/**
 * Deploy the already-built site to the dark slot for `candidate`.
 * Requires `site/.svelte-kit/cloudflare` to exist (run the build first).
 */
export function makeDeployer(cfg: DeployConfig) {
  return async (candidate: string): Promise<DeploySlot> => {
    const siteDir = join(cfg.repoRoot, SITE_DIR);
    const name = darkWorkerName(candidate);

    // adapter-cloudflare emits _worker.js / _routes.json / _headers into the
    // assets dir; tell wrangler not to publish those as public assets.
    writeFileSync(
      join(siteDir, BUILD_DIR, ".assetsignore"),
      "_worker.js\n_routes.json\n_headers\n",
    );

    const out = execFileSync(
      wrangler(cfg),
      ["deploy", "--config", DARK_CONFIG, "--name", name],
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
    return { url, detail: versionId ? `version ${versionId}` : name };
  };
}

function parseWorkersDevUrl(stdout: string, name: string): string | null {
  const matches = stdout.match(/https:\/\/[^\s]+\.workers\.dev/g) ?? [];
  // prefer the URL that carries this worker's name
  const exact = matches.find((u) => u.includes(name));
  return exact ?? matches[0] ?? null;
}
