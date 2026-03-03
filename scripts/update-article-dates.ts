/**
 * Update fields for the two new articles in DynamoDB.
 *
 * Usage:
 *   npx tsx scripts/update-article-dates.ts
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>();

const UPDATES: { slug: string; fields: Record<string, any> }[] = [
  { slug: 'rie150-nanoforest-soft-actuator', fields: { category: 'Publication Spotlight' } },
  { slug: 'pecvd-icp-ptse2-photodetector', fields: { category: 'Publication Spotlight' } },
];

async function updateArticles() {
  for (const { slug, fields } of UPDATES) {
    const { data: records } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
    if (!records || records.length === 0) {
      console.log(`  NOT FOUND: ${slug}`);
      continue;
    }

    const record = records[0];
    const { data, errors } = await client.models.InsightsPost.update({
      id: record.id,
      ...fields,
    });

    if (errors) {
      console.error(`  FAIL: ${slug}`, errors);
    } else {
      console.log(`  OK: ${slug} → category: ${data?.category}`);
    }
  }
  console.log('\nDone.\n');
}

updateArticles().catch(console.error);
