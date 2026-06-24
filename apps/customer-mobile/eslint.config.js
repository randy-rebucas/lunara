const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'store-assets/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    files: ['app.config.js', 'metro.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { __dirname: 'readonly', Buffer: 'readonly', process: 'readonly', module: 'readonly', require: 'readonly' },
    },
  },
];
