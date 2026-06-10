import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

/** Resolve monorepo root `.env` whether the API runs from `apps/api` or repo root. */
export function resolveMonorepoEnvPaths(): string[] {
  const cwd = process.cwd();
  return [
    resolve(cwd, '.env'),
    resolve(cwd, '../../.env'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../../../.env'),
  ].filter((path, index, all) => all.indexOf(path) === index && existsSync(path));
}

export function loadMonorepoEnv(): string | undefined {
  const paths = resolveMonorepoEnvPaths();
  const envPath = paths[0];
  if (!envPath) return undefined;

  config({ path: envPath });
  return envPath;
}
