const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    files: ['app.config.js', 'metro.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', process: 'readonly', module: 'readonly', require: 'readonly' },
    },
  },
];
