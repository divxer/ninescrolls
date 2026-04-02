/**
 * Shared authentication helper for admin scripts.
 *
 * Loads credentials from .env file (if present) then falls back to
 * environment variables ADMIN_EMAIL and ADMIN_PASSWORD.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { signIn } from 'aws-amplify/auth';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    // Don't override existing env vars
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export async function authenticate(): Promise<void> {
  loadEnvFile();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Missing credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env or environment.');
    process.exit(1);
  }
  console.log(`Signing in as ${email}...`);
  const { isSignedIn } = await signIn({ username: email, password });
  if (!isSignedIn) {
    console.error('Sign-in failed.');
    process.exit(1);
  }
  console.log('Authenticated.\n');
}
