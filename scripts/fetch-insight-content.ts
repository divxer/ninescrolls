/**
 * Fetch a single InsightsPost's content from DynamoDB and write it to a file.
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/fetch-insight-content.ts <slug> <out-file>
 */
import { writeFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

async function main() {
  const [slug, outFile] = process.argv.slice(2);
  if (!slug || !outFile) {
    console.error('Usage: npx tsx scripts/fetch-insight-content.ts <slug> <out-file>');
    process.exit(1);
  }

  await authenticate();

  const { data, errors } = await client.models.InsightsPost.listInsightsPostBySlug(
    { slug },
    { limit: 2 } as any,
  );
  if (errors) {
    console.error('errors:', errors);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error(`No post found for slug: ${slug}`);
    process.exit(1);
  }
  const post = data[0];
  console.log(`id: ${post.id}`);
  console.log(`title: ${post.title}`);
  console.log(`updatedAt: ${(post as any).updatedAt}`);
  console.log(`content length: ${post.content?.length ?? 0}`);
  writeFileSync(outFile, post.content ?? '');
  console.log(`wrote ${outFile}`);
}

main();
