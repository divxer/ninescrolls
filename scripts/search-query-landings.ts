/**
 * Aggregate real captured search queries → landing pages, to find content gaps.
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/search-query-landings.ts [days]
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
// Engine-allowlisted extraction (per-domain param names) — same logic the admin
// Keywords card uses. Never extracts params from arbitrary/first-party URLs.
import { extractSearchQuery } from '../src/services/behaviorAnalytics';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });

const DAYS = Number(process.argv[2] ?? '365');
if (!Number.isInteger(DAYS) || DAYS <= 0 || DAYS > 3650) {
  console.error('Usage: npx tsx scripts/search-query-landings.ts [days]   (days: positive integer ≤ 3650)');
  process.exit(1);
}

async function main() {
  await authenticate();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

  type Row = { query: string; pathname: string; count: number; visitors: Set<string>; orgs: Set<string>; lastSeen: string; engine: string };
  const map = new Map<string, Row>();
  let scanned = 0, withQuery = 0;
  let nextToken: string | null | undefined = undefined;

  do {
    const { data, nextToken: nt, errors } = await (client.models.AnalyticsEvent as any).listAnalyticsEventByEventTypeAndTimestamp(
      { eventType: 'page_view' },
      {
        timestamp: { ge: since },
        limit: 1000,
        nextToken,
        selectionSet: ['pathname', 'isBot', 'visitorId', 'timestamp', 'searchQuery', 'referrer', 'orgName'],
      },
    );
    if (errors) { console.error(errors); process.exit(1); }
    for (const r of data || []) {
      scanned++;
      if (r.isBot) continue;
      const q: string | undefined = (r.searchQuery && String(r.searchQuery).trim()) || extractSearchQuery(r.referrer || undefined);
      if (!q) continue;
      withQuery++;
      const pathname = (r.pathname || '').split('?')[0].replace(/\/$/, '') || '/';
      let engine = '';
      try { engine = r.referrer ? new URL(r.referrer).hostname : ''; } catch { /* ignore */ }
      const key = `${q.toLowerCase()}|||${pathname}`;
      const row = map.get(key);
      if (row) {
        row.count++;
        if (r.visitorId) row.visitors.add(r.visitorId);
        if (r.orgName) row.orgs.add(r.orgName);
        if (r.timestamp > row.lastSeen) row.lastSeen = r.timestamp;
      } else {
        map.set(key, {
          query: q, pathname, count: 1,
          visitors: new Set(r.visitorId ? [r.visitorId] : []),
          orgs: new Set(r.orgName ? [r.orgName] : []),
          lastSeen: r.timestamp, engine,
        });
      }
    }
    nextToken = nt;
  } while (nextToken);

  const rows = [...map.values()].sort((a, b) => b.count - a.count || (b.lastSeen < a.lastSeen ? -1 : 1));
  console.log(`scanned=${scanned} page_views, ${withQuery} with a search query, ${rows.length} unique (query, page) pairs, window=${DAYS}d\n`);
  for (const r of rows) {
    console.log(JSON.stringify({
      q: r.query, page: r.pathname, n: r.count, visitors: r.visitors.size,
      orgs: [...r.orgs].slice(0, 3), last: r.lastSeen.slice(0, 10), engine: r.engine,
    }));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
