import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

const monorepoRoot = path.join(__dirname, '../..');

loadEnvConfig(monorepoRoot, process.env.NODE_ENV !== 'production', console, true);

const nextConfig: NextConfig = {
  transpilePackages: ['@lunara/brand', '@lunara/ui', '@lunara/config', '@lunara/utils'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },
};

export default nextConfig;
