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

config.resolver.blockList = [
  new RegExp(`${sep}apps${sep}api${sep}dist${sep}.*`),
  new RegExp(`${sep}apps${sep}[^${sep}]+${sep}\\.next${sep}.*`),
  new RegExp(`${sep}packages${sep}[^${sep}]+${sep}dist${sep}.*`),
];

config.resolver.extraNodeModules = {
  react: path.join(monorepoRoot, 'node_modules/react'),
  'react-native': path.join(monorepoRoot, 'node_modules/react-native'),
  '@lunara/brand': path.join(monorepoRoot, 'packages/brand'),
  '@lunara/config': path.join(monorepoRoot, 'packages/config'),
  '@lunara/hooks': path.join(monorepoRoot, 'packages/hooks'),
  '@lunara/types': path.join(monorepoRoot, 'packages/types'),
  '@lunara/utils': path.join(monorepoRoot, 'packages/utils'),
};

module.exports = config;
