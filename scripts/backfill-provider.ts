/**
 * Backfill `provider` field on AnalyticsEvent records that have AI classification
 * but are missing the provider (bedrock/anthropic).
 *
 * Strategy:
 *   1. Scan all page_view events that have aiOrganizationType but no provider
 *   2. Group by orgName to avoid redundant classify-org calls
 *   3. Call classify-org Lambda (get-override) to get cached provider per org
 *   4. Update each event's provider field via GraphQL
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/backfill-provider.ts
 *
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *
 * Prerequisites:
 *   - amplify_outputs.json exists in project root
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });
const dryRun = process.argv.includes('--dry-run');

type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

async function authenticate() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
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

/** Get the classify-org API endpoint from amplify outputs */
function getClassifyOrgEndpoint(): string {
  const outputs = amplifyOutputs as any;
  // The classify-org Lambda is behind the /resolve API endpoint
  const endpoint = outputs?.custom?.classifyOrgEndpoint
    || outputs?.custom?.apiEndpoint;
  if (!endpoint) {
    // Fallback: construct from known pattern
    return 'https://api.ninescrolls.com/resolve';
  }
  return endpoint;
}

/** Call classify-org Lambda to get cached classification (including provider) */
async function getOrgProvider(orgName: string): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    const endpoint = getClassifyOrgEndpoint();

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'get-override', orgName }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.provider || null;
  } catch {
    return null;
  }
}

/** Fetch all events with AI classification */
async function fetchEventsWithAI(): Promise<AnalyticsEvent[]> {
  const results: AnalyticsEvent[] = [];
  let nextToken: string | undefined;
  let page = 0;

  // Scan page_view events (AI classification is on page_view records)
  do {
    const result = await (client.models.AnalyticsEvent as any)
      .listAnalyticsEventByEventTypeAndTimestamp(
        { eventType: 'page_view', timestamp: { ge: '2024-01-01T00:00:00Z' } },
        { authMode: 'userPool', limit: 500, nextToken },
      );

    const events = (result.data || []) as AnalyticsEvent[];
    // Filter: has AI classification but missing provider
    const needsBackfill = events.filter((e: any) =>
      e.aiOrganizationType && !e.provider
    );
    results.push(...needsBackfill);
    nextToken = result.nextToken || undefined;
    page++;
    process.stdout.write(`\rScanning page ${page}... (${results.length} events need backfill)`);
  } while (nextToken);

  console.log(`\nFound ${results.length} events needing provider backfill.\n`);
  return results;
}

async function main() {
  await authenticate();

  if (dryRun) console.log('=== DRY RUN MODE ===\n');

  // 1. Find events missing provider
  const events = await fetchEventsWithAI();
  if (events.length === 0) {
    console.log('No events need backfill. Done.');
    return;
  }

  // 2. Group by orgName to minimize classify-org calls
  const orgEvents = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    const org = e.orgName || e.org || 'unknown';
    if (!orgEvents.has(org)) orgEvents.set(org, []);
    orgEvents.get(org)!.push(e);
  }
  console.log(`${orgEvents.size} unique orgs to look up.\n`);

  // 3. Look up provider per org and update events
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [orgName, orgEvts] of orgEvents) {
    const provider = await getOrgProvider(orgName);

    if (!provider) {
      console.log(`  [skip] ${orgName} — no cached provider (${orgEvts.length} events)`);
      skipped += orgEvts.length;
      continue;
    }

    console.log(`  [${provider}] ${orgName} — ${orgEvts.length} events`);

    if (dryRun) {
      updated += orgEvts.length;
      continue;
    }

    // Update each event
    for (const e of orgEvts) {
      try {
        await (client.models.AnalyticsEvent as any).update(
          { id: e.id, provider },
          { authMode: 'userPool' },
        );
        updated++;
      } catch (err) {
        console.error(`    [fail] ${e.id}: ${err}`);
        failed++;
      }
    }

    // Rate limit: small delay between orgs
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped} (no cached provider)`);
  console.log(`Failed:  ${failed}`);
  if (dryRun) console.log('(dry run — no changes made)');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
