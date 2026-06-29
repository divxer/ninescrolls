module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Downgraded to a warning: there is a large pre-existing backlog of `any`
    // (mostly in service/API layers). Keeping it visible without blocking the
    // lint gate; the backlog is being cleaned up gradually.
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow intentionally-unused identifiers via a leading underscore (e.g.
    // required-by-signature callback params).
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
}
