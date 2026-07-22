import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Amplify's generated `$amplify/env/<fn>` virtual modules don't exist in
      // the test environment — resolve them to a stub (tests vi.mock them).
      {
        find: /^\$amplify\/env\/.*$/,
        replacement: path.resolve(__dirname, 'amplify/test-support/amplify-env-stub.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
