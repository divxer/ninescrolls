/**
 * One-off script to update the plasma-non-uniform-etch-chamber-solutions article in DynamoDB.
 * Uses Cognito authentication via AppSync (the only auth with write access).
 *
 * Usage:
 *   COGNITO_EMAIL=you@example.com COGNITO_PASSWORD=yourpass npx tsx scripts/update-plasma-uniformity-post.ts
 *
 * Or run without env vars to be prompted interactively.
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';
import { insightsPosts } from './insightsPostsData';
import * as readline from 'readline';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const TARGET_SLUG = 'plasma-non-uniform-etch-chamber-solutions';

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function updatePost() {
  // 1. Sign in with Cognito
  const email = process.env.COGNITO_EMAIL || await ask('Cognito email: ');
  const password = process.env.COGNITO_PASSWORD || await ask('Password: ');

  console.log('Signing in...');
  const { isSignedIn } = await signIn({ username: email, password });
  if (!isSignedIn) {
    console.error('Sign in incomplete (MFA or additional step required)');
    process.exit(1);
  }
  console.log('Signed in.\n');

  // 2. Create authenticated client
  const client = generateClient<Schema>({ authMode: 'userPool' });

  // 3. Find the post in seed data
  const postData = insightsPosts.find((p) => p.slug === TARGET_SLUG);
  if (!postData) {
    console.error(`Post with slug "${TARGET_SLUG}" not found in insightsPostsData.ts`);
    process.exit(1);
  }

  // 4. Look up existing record by slug
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({
    slug: TARGET_SLUG,
  });

  if (!existing || existing.length === 0) {
    console.error(`Post with slug "${TARGET_SLUG}" not found in DynamoDB`);
    process.exit(1);
  }

  const record = existing[0];
  console.log(`Found: id=${record.id}, slug=${record.slug}, current readTime=${record.readTime}`);

  // 5. Update content, readTime, and tags
  const { data, errors } = await client.models.InsightsPost.update({
    id: record.id,
    content: postData.content || null,
    readTime: postData.readTime,
    tags: postData.tags,
  });

  if (errors) {
    console.error('Update failed:', errors);
    process.exit(1);
  }

  console.log(`\nUpdated successfully!`);
  console.log(`  readTime: ${data?.readTime}`);
  console.log(`  tags: ${JSON.stringify(data?.tags)}`);
  console.log(`  content length: ${(data?.content as string)?.length ?? 0} chars`);
}

updatePost().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
