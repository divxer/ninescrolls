/**
 * Repeatable migration for two catalog false positives created by earlier runs.
 * Existing records converge to status:archived with a checked removedReason;
 * clean databases remain unchanged. Requires explicit --apply confirmation.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  correctFalsePositives,
  requireApply,
  type EvidenceGraphqlClient,
  type FalsePositiveCorrection,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

const CORRECTIONS: FalsePositiveCorrection[] = [
  {
    slug: 'pub-tailong-sputter-cu-nanotwin-mi-2024',
    removedReason:
      'Archived after full-text verification (2026-07-13): the paper uses a non-Tailong VCT 300 sputter; it does not attribute process equipment to Tailong Electronics.',
  },
  {
    slug: 'pub-tailong-sputter-wo3-sensor-sensors-2025',
    removedReason:
      'Archived after full-text verification (2026-07-13): Tailong refers to the gas supplier Anxing Tailong Gas Chemical, not Beijing Zhongke Tailong process equipment.',
  },
];

async function main() {
  requireApply(process.argv.slice(2), 'correct-evidence-false-positives');
  await authenticate();
  const result = await correctFalsePositives(client, CORRECTIONS);
  console.log(
    `Done. archived=${result.archived} converged=${result.converged} missing=${result.missing}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
