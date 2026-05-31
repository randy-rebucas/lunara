const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const icon = path.join(monorepoRoot, 'packages/brand/assets/icon.png');

loadProjectEnv(monorepoRoot);

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...require('./app.json').expo,
  icon,
  splash: {
    image: icon,
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  android: {
    ...require('./app.json').expo.android,
    adaptiveIcon: {
      foregroundImage: icon,
      backgroundColor: '#ffffff',
    },
  },
};
