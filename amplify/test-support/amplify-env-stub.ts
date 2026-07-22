/**
 * Test-only stand-in for Amplify's generated `$amplify/env/<function>` virtual
 * modules (aliased in vitest.config.ts). Tests normally vi.mock the specific
 * `$amplify/env/<fn>` specifier; this stub only exists so Vite's import
 * analysis can resolve the id before the mock takes over.
 */
export const env = process.env as Record<string, string>;
