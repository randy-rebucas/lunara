const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const icon = path.join(monorepoRoot, 'packages/brand/assets/icon.png');

loadProjectEnv(monorepoRoot);

const appJson = require('./app.json').expo;
const websiteUrl = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim() || 'https://lunara.app';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson,
  extra: {
    ...appJson.extra,
    eas: {
      ...appJson.extra?.eas,
      projectId: '08355e56-d5dc-4fe0-b11c-8b6a27691dc5',
    },
    privacyUrl: `${websiteUrl}/privacy`,
    termsUrl: `${websiteUrl}/terms`,
  },
  icon,
  splash: {
    image: icon,
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  android: {
    ...appJson.android,
    adaptiveIcon: {
      foregroundImage: icon,
      backgroundColor: '#ffffff',
    },
  },
  ios: {
    ...appJson.ios,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
};
