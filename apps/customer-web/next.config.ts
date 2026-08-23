import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

const monorepoRoot = path.join(__dirname, '../..');

// @next/env caches its result at module scope and returns that cache on any later call within
// the same process, ignoring the directory argument — Next's own internal bootstrap already
// calls loadEnvConfig() once using this app's own directory (which has no .env file here, since
// it's shared from the monorepo root), so our call below needs forceReload=true or it's a no-op.
loadEnvConfig(monorepoRoot, process.env.NODE_ENV !== 'production', console, true);

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
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },
};

export default nextConfig;
