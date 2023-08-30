/* eslint-env node */
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'eol-last': ['error', 'always'],
    'max-statements-per-line': ['error', { max: 3 }],
    'max-len': ['error', 120],
    'no-console': 'error',
    'new-cap': ['error', { newIsCap: true, properties: false, capIsNew: false }],
    'newline-before-return': 'error',
    'key-spacing': ['error', { afterColon: true, mode: 'strict' }],
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    'max-classes-per-file': ['error', { ignoreExpressions: true }],
  },
  root: true,
};
