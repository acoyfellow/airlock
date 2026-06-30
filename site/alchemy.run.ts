import alchemy from 'alchemy';
import { SvelteKit } from 'alchemy/cloudflare';
import { CloudflareStateStore, FileSystemStateStore } from 'alchemy/state';

class ConfigError extends Error {
  constructor(variable: string) {
    super(`${variable} is required`);
    this.name = 'ConfigError';
  }
}

function requiredEnv(variable: string): string {
  const value = process.env[variable];
  if (!value) throw new ConfigError(variable);
  return value;
}

function cloudflareApiToken(): string {
  const value = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_PERSONAL_API_TOKEN;
  if (!value) throw new ConfigError('CLOUDFLARE_API_TOKEN');
  return value;
}

const projectName = 'airlock';

const project = await alchemy(projectName, {
  password: requiredEnv('ALCHEMY_PASSWORD'),
  stateStore: (scope) =>
    scope.local
      ? new FileSystemStateStore(scope)
      : new CloudflareStateStore(scope, {
          scriptName: `${projectName}-app-state`,
          apiToken: alchemy.secret(cloudflareApiToken()),
          stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN ?? ''),
        }),
});

const isProduction = !project.stage || project.stage === 'production';
const resourcePrefix = isProduction ? projectName : `${projectName}-${project.stage}`;

export const SITE = await SvelteKit(`${resourcePrefix}-site`, {
  name: `${resourcePrefix}-site`,
  ...(isProduction ? { domains: ['airlock.coey.dev'] } : {}),
  adopt: true,
  url: true,
});

console.log({ url: SITE.url });

await project.finalize();
