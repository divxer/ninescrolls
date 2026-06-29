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
    // Allow intentionally-unused function params via a leading underscore, and
    // ignore destructured siblings pulled out alongside a `...rest` (used to
    // strip fields). Vars/caught-errors are still checked normally.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
  },
}
