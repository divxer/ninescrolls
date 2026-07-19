/**
 * Publish every launch-eligible (meta.launchEligible === true) publication
 * Evidence record: status draft -> published, stamping publishDate when absent.
 * Idempotent + convergent (already-published records are counted, not rewritten).
 * Dry-run by default; pass --apply to write. Tier-B / incidental records are
 * NOT launch-eligible and are never touched.
 *
 * PREREQUISITE: the whitelist-projection Lambda (handler.ts) MUST already be
 * deployed to the target backend, so published records return OEM-free payloads.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/publish-launch-eligible-evidence.ts            # dry-run
 *   npx tsx scripts/publish-launch-eligible-evidence.ts --apply    # write
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import { publishLaunchEligible, type EvidenceGraphqlClient } from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

function parseArgs(argv: string[]): { apply: boolean } {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length) {
    throw new Error(`publish-launch-eligible-evidence: unknown argument(s): ${unknown.join(', ')}`);
  }
  return { apply: argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  await authenticate();
  // Full ISO 8601 datetime — identical format to the admin auto-stamp
  // (evidenceAdminService withPublishDate uses new Date().toISOString()).
  const publishDate = new Date().toISOString();
  const res = await publishLaunchEligible(client, { apply, publishDate });
  console.log(
    `${apply ? 'APPLIED' : 'DRY-RUN'} — launchEligible=${res.eligible} published=${res.published} alreadyPublished=${res.alreadyPublished}`,
  );
  console.log('  byProduct:', JSON.stringify(res.byProduct));
  if (!apply) console.log('\nNothing written. Re-run with --apply to publish.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
