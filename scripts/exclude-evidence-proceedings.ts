/**
 * Conference-proceedings policy enforcement (2026-07-18). The product-page
 * "Peer-reviewed research" list is for journal-grade evidence, so conference /
 * proceedings papers are excluded from launch-eligibility by default. For each
 * record below this: cleans meta.journal to a proper short name, tags
 * venueType:'conference', forces launchEligible:false + publishPriority:'wave3',
 * and unpublishes it (status -> draft) so it leaves the public payload.
 *
 * Convergent + idempotent (already-excluded records are skipped). Keep this in
 * sync with the classifier's PROCEEDINGS set — the classifier re-derives the same
 * launch fields; this script additionally owns the draft flip (classifier never
 * touches status).
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/exclude-evidence-proceedings.ts            # dry-run
 *   npx tsx scripts/exclude-evidence-proceedings.ts --apply    # write
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  excludeProceedingsFromLaunch,
  type EvidenceGraphqlClient,
  type ProceedingsExclusion,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

// One entry per conference-proceedings record. `journal` is the cleaned, proper
// conference short name (paired with the record's separate `year` field).
const EXCLUSIONS: ProceedingsExclusion[] = [
  // IEEE RAITS 2026 = 2026 International Conference on Robotics, Automation and
  // Intelligent Transportation Systems (DOI 10.1109/RAITS68656.2026.11580152).
  { slug: 'pub-tailong-sputter-tio2-cuox-robots-raits-2026', journal: 'IEEE RAITS' },
];

function parseArgs(argv: string[]): { apply: boolean } {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length) {
    throw new Error(`exclude-evidence-proceedings: unknown argument(s): ${unknown.join(', ')}`);
  }
  return { apply: argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  await authenticate();

  const tally: Record<string, number> = { excluded: 0, 'would-exclude': 0, converged: 0, missing: 0 };
  for (const exclusion of EXCLUSIONS) {
    const outcome = await excludeProceedingsFromLaunch(client, exclusion, { apply });
    tally[outcome]++;
    console.log(`${outcome}: ${exclusion.slug}  (journal -> "${exclusion.journal}")`);
  }

  console.log(`\n${apply ? 'APPLIED' : 'DRY-RUN'} —`, JSON.stringify(tally));
  if (!apply && tally['would-exclude'] > 0) {
    console.log('Nothing written. Re-run with --apply to exclude + unpublish.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
