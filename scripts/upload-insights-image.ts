/**
 * Upload an image for an insights article to the CDN (S3 + Lambda resize).
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD \
 *     [AWS_PROFILE=ninescrolls] [CDN_DISTRIBUTION_ID=...] \
 *     npx tsx scripts/upload-insights-image.ts <slug> <image-file> [options]
 *
 * Options:
 *   --name <name>       Custom filename prefix for the image (default: derived from file name)
 *                        e.g. --name cover → cover-sm.webp, cover-lg.webp, etc.
 *   --no-update-cover   Skip updating the article's imageUrl (use for inline/content images)
 *   --no-invalidate     Skip CloudFront invalidation after upload
 *
 * Env:
 *   AWS_PROFILE           IAM profile with cloudfront:CreateInvalidation
 *                         (the SSO admin role does NOT have this; the
 *                         `ninescrolls` IAM user profile does)
 *   CDN_DISTRIBUTION_ID   CloudFront distribution ID (defaults to .env value)
 *
 * Example:
 *   npx tsx scripts/upload-insights-image.ts my-article ~/path/to/photo.png --name cover
 *   npx tsx scripts/upload-insights-image.ts my-article ~/path/to/diagram.png --name diagram --no-update-cover
 *
 * The script:
 *   1. Gets a presigned URL via GraphQL (getInsightsImageUploadUrl)
 *   2. Uploads the image to S3 temp/
 *   3. Triggers Lambda to resize (sm/md/lg/xl) + generate WebP variants
 *   4. Updates the DynamoDB record's imageUrl to point to the CDN
 *      (extension-less `-lg` form; renderer builds responsive <picture>)
 *   5. Invalidates the CloudFront cache for this slug's image directory
 *      so edge nodes pick up the new bytes immediately
 */

import { readFileSync } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

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

async function uploadNewsImage(slug: string, imagePath: string, customName?: string, updateCover = true, skipInvalidate = false) {
  await authenticate();

  // 1. Verify the article exists
  const { data: posts } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });
  if (!posts || posts.length === 0) {
    console.error(`No article found with slug "${slug}". Create the article first.`);
    process.exit(1);
  }
  const post = posts[0];
  console.log(`Found article: ${post.title}`);
  console.log(`  id: ${post.id}\n`);

  // 2. Read the image file
  const originalFileName = path.basename(imagePath);
  const mimeType = getMimeType(imagePath);
  const ext = path.extname(originalFileName);
  // Use custom name if provided, preserving the original extension
  const fileName = customName ? `${customName}${ext}` : originalFileName;
  const fileBuffer = readFileSync(imagePath);
  console.log(`Image: ${originalFileName}${customName ? ` → ${fileName}` : ''} (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  // 3. Get presigned upload URL
  console.log('Getting presigned URL...');
  const { data: uploadData, errors: uploadErrors } = await client.queries.getInsightsImageUploadUrl(
    { slug, fileName, mimeType } as any,
  );
  if (uploadErrors?.length) {
    console.error('Failed to get upload URL:', uploadErrors);
    process.exit(1);
  }
  const { uploadUrl, s3Key } = uploadData as any;
  console.log(`  S3 key: ${s3Key}`);

  // 4. Upload to S3 via presigned URL
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
  console.log('  Upload complete.');

  // 5. Process image (resize + WebP via Lambda)
  console.log('Processing image (resize + WebP)...');
  const { data: result, errors: processErrors } = await client.mutations.processInsightsImage(
    { s3Key, slug } as any,
  );
  if (processErrors?.length) {
    console.error('Image processing failed:', processErrors);
    process.exit(1);
  }

  const { cdnBaseUrl, heroPrefix, files, error } = result as any;
  if (error) {
    console.warn(`  Partial errors: ${error}`);
  }
  console.log(`  Generated ${files.length} files:`);
  for (const f of files) {
    console.log(`    ${cdnBaseUrl}/${f}`);
  }

  // 6. Update the article's imageUrl (unless --no-update-cover)
  //
  // Store the extension-less `-lg` form. InsightsPostPage.tsx detects that
  // shape and builds a responsive <picture> with sm/md/lg/xl .webp sources,
  // so the same record works whether the source was PNG or JPG.
  const cdnImageUrl = `${cdnBaseUrl}/insights/${slug}/${heroPrefix}-lg`;

  if (updateCover) {
    console.log(`\nUpdating imageUrl to: ${cdnImageUrl}`);
    const { errors: updateErrors } = await client.models.InsightsPost.update({
      id: post.id,
      imageUrl: cdnImageUrl,
    });
    if (updateErrors?.length) {
      console.error('Failed to update imageUrl:', updateErrors);
      process.exit(1);
    }
    console.log('\nDone! Cover image uploaded and article updated.');
  } else {
    console.log('\nDone! Image uploaded (cover imageUrl not changed).');
  }

  // 7. Invalidate CloudFront cache for this slug's image directory.
  //    Without this, edge nodes keep serving the old object until TTL
  //    expires (can be hours), even after S3 has the new bytes.
  if (!skipInvalidate) {
    const distributionId = process.env.CDN_DISTRIBUTION_ID;
    if (!distributionId) {
      console.warn('\nCDN_DISTRIBUTION_ID not set; skipping CloudFront invalidation.');
      console.warn('  Edge caches will keep the old image until their TTL expires.');
    } else {
      const invalidationPath = `/insights/${slug}/*`;
      console.log(`\nInvalidating CloudFront ${distributionId} ${invalidationPath} ...`);
      try {
        const out = execFileSync('aws', [
          'cloudfront', 'create-invalidation',
          '--distribution-id', distributionId,
          '--paths', invalidationPath,
          '--query', 'Invalidation.Id',
          '--output', 'text',
        ], { encoding: 'utf-8' });
        console.log(`Invalidation submitted: ${out.trim()}`);
      } catch (err) {
        console.error('\nCloudFront invalidation failed (upload succeeded). Retry with:');
        console.error(`  aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "${invalidationPath}"`);
        console.error('Hint: the SSO admin role lacks this permission; set AWS_PROFILE=ninescrolls.');
      }
    }
  } else {
    console.log('\nCloudFront invalidation skipped (--no-invalidate).');
  }
}

// CLI entry
const nameIdx = process.argv.indexOf('--name');
const customName = nameIdx !== -1 ? process.argv[nameIdx + 1] : undefined;
const noUpdateCover = process.argv.includes('--no-update-cover');
const noInvalidate = process.argv.includes('--no-invalidate');
const positionalArgs = process.argv.slice(2).filter((arg, i, arr) => {
  if (arg === '--name' || arg === '--no-update-cover' || arg === '--no-invalidate') return false;
  if (i > 0 && arr[i - 1] === '--name') return false;
  return true;
});
const slug = positionalArgs[0];
const imagePath = positionalArgs[1];

if (!slug || !imagePath) {
  console.error('Usage: npx tsx scripts/upload-insights-image.ts <slug> <image-file> [--name <name>] [--no-update-cover] [--no-invalidate]');
  process.exit(1);
}

uploadNewsImage(slug, imagePath, customName, !noUpdateCover, noInvalidate).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
