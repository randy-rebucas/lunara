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

// In this monorepo, expo lives in the root node_modules. When Expo CLI falls back to
// expo/AppEntry.js as the entry point, it imports '../../App' — a path relative to
// the monorepo root, not the project root. Intercept it and redirect to expo-router's
// actual root component so the app always boots through expo-router regardless of
// which directory `expo start` is invoked from.
const expoRouterShim = path.join(projectRoot, 'expo-router-entry-shim.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../../App' &&
    context.originModulePath.replace(/\\/g, '/').includes('/expo/AppEntry')
  ) {
    return { filePath: expoRouterShim, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
