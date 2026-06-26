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

// Keep Metro out of compiled web/API output. Do not block packages/*/dist — mobile imports @lunara/* from dist/.
config.resolver.blockList = [
  new RegExp(`${sep}apps${sep}api${sep}dist${sep}.*`),
  new RegExp(`${sep}apps${sep}[^${sep}]+${sep}\\.next${sep}.*`),
];

config.resolver.extraNodeModules = {
  react: path.join(monorepoRoot, 'node_modules/react'),
  'react-native': path.join(monorepoRoot, 'node_modules/react-native'),
  'react-native-svg': path.join(projectRoot, 'node_modules/react-native-svg'),
  '@lunara/brand': path.join(monorepoRoot, 'packages/brand'),
  '@lunara/config': path.join(monorepoRoot, 'packages/config'),
  '@lunara/types': path.join(monorepoRoot, 'packages/types'),
  '@lunara/utils': path.join(monorepoRoot, 'packages/utils'),
};

module.exports = config;
