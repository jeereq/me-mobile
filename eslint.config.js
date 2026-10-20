// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Textes en français : les apostrophes dans le JSX sont voulues.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
  {
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
