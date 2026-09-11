const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const icon = path.join(monorepoRoot, 'packages/brand/assets/icon.png');

loadProjectEnv(monorepoRoot);

const appJson = require('./app.json').expo;

// Local dev hits the API over plain http:// (LAN IP, no TLS). Android blocks
// cleartext traffic by default once the app targets a modern SDK, which
// silently breaks every fetch/upload in a dev build unless we opt back in
// here — Expo Go was unaffected because its own manifest already allows it.
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const usesCleartextTraffic = !apiUrl || apiUrl.startsWith('http://');

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
  plugins: [...(appJson.plugins ?? [])],
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
    usesCleartextTraffic,
  },
  ios: {
    ...appJson.ios,
  },
};
