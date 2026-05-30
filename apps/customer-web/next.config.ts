import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

// Load monorepo root .env so NEXT_PUBLIC_* vars match the API workspace
loadEnvConfig(path.join(__dirname, '../..'));

const nextConfig: NextConfig = {
  transpilePackages: ['@lunara/ui', '@lunara/hooks', '@lunara/config', '@lunara/utils'],
};

export default nextConfig;
