import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(path.join(__dirname, '../..'));

const nextConfig: NextConfig = {
  transpilePackages: ['@lunara/brand', '@lunara/ui', '@lunara/config', '@lunara/utils', '@lunara/hooks'],
};

export default nextConfig;
