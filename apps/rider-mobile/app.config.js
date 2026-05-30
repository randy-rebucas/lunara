const path = require('path');
const { loadProjectEnv } = require('@expo/env');

// Load monorepo root .env so EXPO_PUBLIC_* vars are available when bundling.
loadProjectEnv(path.resolve(__dirname, '../..'));

/** @type {import('expo/config').ExpoConfig} */
module.exports = require('./app.json').expo;
