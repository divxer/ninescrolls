/**
 * Upload an inline content image for an insights article to the CDN (S3, no resize).
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/upload-content-image.ts <slug> <image-file> [--name <name>]
 *
 * Options:
 *   --name <name>  Custom filename for the image on S3 (default: derived from file name)
 *
 * Example:
 *   npx tsx scripts/upload-content-image.ts my-article ~/path/to/diagram.png --name diagram-1
 *
 * The script:
 *   1. Gets a presigned URL via GraphQL (getContentImageUploadUrl)
 *   2. Uploads the image directly to S3 insights/<slug>/ (no Lambda resize)
 *   3. Prints the CDN URL for use in article HTML
 */

import { readFileSync } from 'fs';
import path from 'path';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

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

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported image format: ${ext}`);
  }
}

async function uploadContentImage(slug: string, imagePath: string, customName?: string) {
  await authenticate();

  // 1. Read the image file
  const originalFileName = path.basename(imagePath);
  const mimeType = getMimeType(imagePath);
  const ext = path.extname(originalFileName);
  const fileName = customName ? `${customName}${ext}` : originalFileName;
  const fileBuffer = readFileSync(imagePath);
  console.log(`Image: ${originalFileName}${customName ? ` → ${fileName}` : ''} (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  // 2. Get presigned upload URL (content image — no resize)
  console.log('Getting presigned URL...');
  const { data: uploadData, errors: uploadErrors } = await client.queries.getContentImageUploadUrl(
    { slug, fileName, mimeType } as any,
  );
  if (uploadErrors?.length) {
    console.error('Failed to get upload URL:', uploadErrors);
    process.exit(1);
  }
  const { uploadUrl, cdnUrl } = uploadData as any;

  // 3. Upload to S3 via presigned URL
  console.log('Uploading to S3...');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: fileBuffer,
  });
  if (!uploadResponse.ok) {
    console.error(`Upload failed: HTTP ${uploadResponse.status}`);
    process.exit(1);
  }

  console.log('Done!');
  console.log(`  CDN URL: ${cdnUrl}`);
  return cdnUrl;
}

// CLI entry
const nameIdx = process.argv.indexOf('--name');
const customName = nameIdx !== -1 ? process.argv[nameIdx + 1] : undefined;
const positionalArgs = process.argv.slice(2).filter((arg, i, arr) => {
  if (arg === '--name') return false;
  if (i > 0 && arr[i - 1] === '--name') return false;
  return true;
});
const slug = positionalArgs[0];
const imagePath = positionalArgs[1];

if (!slug || !imagePath) {
  console.error('Usage: npx tsx scripts/upload-content-image.ts <slug> <image-file> [--name <name>]');
  process.exit(1);
}

uploadContentImage(slug, imagePath, customName).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
