/**
 * Delete all S3 images for an insights article.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/delete-insights-images.ts <slug>
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

async function main(slug: string) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }
  console.log(`Signing in as ${email}...`);
  await signIn({ username: email, password });
  console.log('Authenticated.\n');

  console.log(`Deleting all images under insights/${slug}/...`);
  const { data, errors } = await client.mutations.deleteInsightsImages({ slug } as any);
  if (errors?.length) {
    console.error('Delete failed:', errors);
    process.exit(1);
  }
  const { deletedCount, error } = data as any;
  if (error) {
    console.error('Partial error:', error);
  }
  console.log(`Deleted ${deletedCount} objects.`);
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/delete-insights-images.ts <slug>');
  process.exit(1);
}

main(slug).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
