const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const icon = path.join(monorepoRoot, 'packages/brand/assets/icon.png');

loadProjectEnv(monorepoRoot);

const appJson = require('./app.json').expo;

// v1 is single-brand (Lunara) only — no partner-brands/ white-label wiring here.
// See apps/customer-mobile/app.config.js if per-partner branding is ever needed for this app.

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson,
  extra: {
    ...appJson.extra,
    eas: {
      ...appJson.extra?.eas,
      // TODO: replace with a real EAS project id (run `eas init` from this directory).
      // Left as a placeholder so it can never collide with rider-mobile's or
      // customer-mobile's real project ids.
      projectId: 'TODO-create-eas-project-for-partner-mobile',
    },
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
  },
};
