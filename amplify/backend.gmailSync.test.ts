// Source-contract test for the gmail-sync infra wiring in backend.ts (Part 2 Task 9).
// Local CDK synth doesn't exist in this repo (Amplify Console build is the binding synth
// gate), so this test pins the load-bearing source patterns pre-merge: LeadingKeys IAM
// condition, base-table-only grant, sandbox+secret-gated cron in the gmail-sync stack,
// and synth-time GMAIL_SA_SECRET_ARN validation gating the secret grant.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// NOTE: plan's `new URL('./backend.ts', import.meta.url)` fails under the jsdom test
// environment (import.meta.url is an http: URL there); __dirname is equivalent and works.
const src = readFileSync(join(__dirname, 'backend.ts'), 'utf8');

describe('gmail-sync IAM source contract', () => {
  it('carries the LeadingKeys condition exactly', () =>
    expect(src).toMatch(/ForAllValues:StringLike[\s\S]{0,120}dynamodb:LeadingKeys[\s\S]{0,80}GMAIL_SYNC#\*/));
  it('grants the base table ARN only (no /index/*) for gmail-sync dynamo access', () =>
    expect(src).not.toMatch(/gmailSync[\s\S]{0,400}index\/\*/));
  it('cron rule lives in the gmail-sync stack, gated on sandbox AND secret configuration', () => {
    expect(src).toMatch(/if \(!isSandbox && gmailSyncEnabled\)[\s\S]{0,600}GmailSyncRule/);
    expect(src).toMatch(/Stack\.of\(backend\.gmailSync\.resources\.lambda\)/);
  });
  it('validates GMAIL_SA_SECRET_ARN format at synth and gates the secret grant on it', () => {
    expect(src).toMatch(/SECRET_ARN_RE/);
    expect(src).toMatch(/if \(gmailSyncEnabled\)[\s\S]{0,300}fromSecretCompleteArn/);
  });
});
