import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

const monorepoRoot = path.join(__dirname, '../..');

// Load monorepo root .env so NEXT_PUBLIC_* vars match the API workspace
loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {
  transpilePackages: ['@lunara/brand', '@lunara/ui', '@lunara/hooks', '@lunara/config', '@lunara/utils'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
