const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sep = '[/\\\\]';

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Keep Metro out of compiled output (API `dist/`, Next `.next/`, package `dist/`).
// Without this, a missing or mid-rebuild `apps/api/dist` path crashes the watcher on Windows.
config.resolver.blockList = [
  new RegExp(`${sep}apps${sep}api${sep}dist${sep}.*`),
  new RegExp(`${sep}apps${sep}[^${sep}]+${sep}\\.next${sep}.*`),
  new RegExp(`${sep}packages${sep}[^${sep}]+${sep}dist${sep}.*`),
];

// Explicit workspace package roots (avoids asset resolution issues).
config.resolver.extraNodeModules = {
  '@lunara/brand': path.join(monorepoRoot, 'packages/brand'),
  '@lunara/config': path.join(monorepoRoot, 'packages/config'),
  '@lunara/types': path.join(monorepoRoot, 'packages/types'),
  '@lunara/utils': path.join(monorepoRoot, 'packages/utils'),
};

module.exports = config;
