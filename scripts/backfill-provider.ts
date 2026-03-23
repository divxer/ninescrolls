/**
 * Backfill `provider` field on AnalyticsEvent records.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/backfill-provider.ts [--dry-run]
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });
const dryRun = process.argv.includes('--dry-run');

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

const ENDPOINT = 'https://api.ninescrolls.com/resolve';

function stripASN(name: string): string {
  return name.replace(/^AS\d+\s+/, '');
}

async function main() {
  // Authenticate
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD.'); process.exit(1); }
  console.log(`Signing in as ${email}...`);
  await signIn({ username: email, password });
  console.log('Authenticated.\n');

  // Get auth token once
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || '';
  if (!token) { console.error('No auth token.'); process.exit(1); }

  if (dryRun) console.log('=== DRY RUN MODE ===\n');

  // 1. Scan events needing backfill
  const events: AnalyticsEvent[] = [];
  let nextToken: string | undefined;
  let page = 0;
  do {
    const result = await (client.models.AnalyticsEvent as any)
      .listAnalyticsEventByEventTypeAndTimestamp(
        { eventType: 'page_view', timestamp: { ge: '2024-01-01T00:00:00Z' } },
        { authMode: 'userPool', limit: 500, nextToken },
      );
    const items = (result.data || []) as AnalyticsEvent[];
    for (const e of items) {
      if ((e as any).aiOrganizationType && !(e as any).provider) {
        events.push(e);
      }
    }
    nextToken = result.nextToken || undefined;
    page++;
    process.stdout.write(`\rScanning page ${page}... (${events.length} need backfill)`);
  } while (nextToken);
  console.log(`\nFound ${events.length} events.\n`);

  if (events.length === 0) { console.log('Nothing to do.'); return; }

  // 2. Group by orgName
  const orgMap = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    const key = e.orgName || e.org || 'unknown';
    if (!orgMap.has(key)) orgMap.set(key, []);
    orgMap.get(key)!.push(e);
  }
  console.log(`${orgMap.size} unique orgs.\n`);

  // 3. Classify each org and update events
  let updated = 0, skipped = 0, failed = 0;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  for (const [orgName, orgEvts] of orgMap) {
    const cleanName = stripASN(orgName);

    // Call classify-org with force to get provider
    let provider: string | null = null;
    try {
      console.log(`    calling ${ENDPOINT} for "${cleanName}"...`);
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orgName: cleanName, force: true }),
      });
      const raw = await res.text();
      console.log(`    response: ${res.status} ${raw.substring(0, 100)}`);
      if (res.ok) {
        const data = JSON.parse(raw);
        provider = data.provider || null;
      }
    } catch (err: any) {
      console.log(`  [err] ${cleanName} — ${err.message}`);
    }

    if (!provider) {
      console.log(`  [skip] ${orgName} — no provider (${orgEvts.length} events)`);
      skipped += orgEvts.length;
      continue;
    }

    console.log(`  [${provider}] ${orgName} → ${orgEvts.length} events`);

    if (!dryRun) {
      for (const e of orgEvts) {
        try {
          // Use raw GraphQL mutation (Amplify client model may not have provider field yet)
          await client.graphql({
            query: `mutation UpdateEvent($input: UpdateAnalyticsEventInput!) {
              updateAnalyticsEvent(input: $input) { id provider }
            }`,
            variables: { input: { id: e.id, provider } },
            authMode: 'userPool',
          } as any);
          updated++;
        } catch (err: any) {
          console.log(`    [fail] ${e.id}: ${err.message || JSON.stringify(err.errors?.[0]?.message)}`);
          failed++;
        }
      }
      await new Promise(r => setTimeout(r, 200));
    } else {
      updated += orgEvts.length;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
  if (dryRun) console.log('(dry run — no changes made)');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
