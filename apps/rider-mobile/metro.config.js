const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Single React instance for the whole monorepo (avoids invalid hook call).
config.resolver.extraNodeModules = {
  react: path.join(monorepoRoot, 'node_modules/react'),
  'react-native': path.join(monorepoRoot, 'node_modules/react-native'),
};

module.exports = config;
