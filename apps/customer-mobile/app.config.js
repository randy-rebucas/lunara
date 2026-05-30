const path = require('path');
const { loadProjectEnv } = require('@expo/env');

loadProjectEnv(path.resolve(__dirname, '../..'));

/** @type {import('expo/config').ExpoConfig} */
module.exports = require('./app.json').expo;
