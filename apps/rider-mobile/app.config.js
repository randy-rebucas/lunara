const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const icon = path.join(monorepoRoot, 'packages/brand/assets/icon.png');

loadProjectEnv(monorepoRoot);

const appJson = require('./app.json').expo;

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson,
  extra: {
    ...appJson.extra,
    eas: {
      ...appJson.extra?.eas,
      projectId: '2a1569f7-a2e2-4d55-85de-f695de891c44',
    },
  },
  icon,
  plugins: [
    ...appJson.plugins,
    [
      'expo-splash-screen',
      {
        image: icon,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
  ],
  android: {
    ...appJson.android,
    adaptiveIcon: {
      foregroundImage: icon,
      backgroundColor: '#ffffff',
    },
  },
  ios: {
    ...appJson.ios,
  },
};
