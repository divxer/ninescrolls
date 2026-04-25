/**
 * Upload product images to the CDN (S3 + CloudFront).
 *
 * Reads all files from `public/assets/images/products/<slug>/` and uploads
 * them to `s3://<bucket>/products/<slug>/<filename>` so they are served at
 * `https://cdn.ninescrolls.com/products/<slug>/<filename>` (matches the path
 * convention in src/config/imageConfig.ts).
 *
 * Why a script:
 *   Product images are gitignored (CDN-only) but the original upload workflow
 *   was undocumented. This script captures it so future products only need:
 *
 *     npm run upload-product-images <slug>
 *
 * Required env vars (loaded from .env via --env-file):
 *   AWS_PROFILE           IAM user / SSO profile with PutObject on the bucket
 *                         and CreateInvalidation on the distribution
 *   CDN_BUCKET            S3 bucket name backing cdn.ninescrolls.com
 *                         (the InsightsAssetsBucket in amplify/backend.ts)
 *   CDN_DISTRIBUTION_ID   CloudFront distribution ID (optional;
 *                         skip invalidation with --no-invalidate)
 *
 * Usage:
 *   npm run upload-product-images -- <slug>                   # upload + invalidate
 *   npm run upload-product-images -- <slug> --dry-run         # show what would upload
 *   npm run upload-product-images -- <slug> --no-invalidate
 *   npm run upload-product-images -- <slug> --force           # overwrite even if S3 has same key
 *
 * Examples:
 *   npm run upload-product-images -- e-beam
 *   npm run upload-product-images -- sputter --dry-run
 *
 * Note: <slug> is the LOCAL DIRECTORY name under public/assets/images/products/,
 * not the URL slug (e.g. "e-beam" maps to /products/e-beam-evaporator).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ── Config ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_PRODUCTS_DIR = path.resolve(__dirname, '..', 'public/assets/images/products');
const S3_PREFIX = 'products';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
};

// ── CLI parsing ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const noInvalidate = args.includes('--no-invalidate');
const force = args.includes('--force');

if (!slug) {
    console.error('Usage: npx tsx scripts/upload-product-images.ts <slug> [--dry-run] [--no-invalidate] [--force]');
    console.error('');
    console.error('Reads from: public/assets/images/products/<slug>/');
    console.error('Uploads to: s3://$CDN_BUCKET/products/<slug>/');
    process.exit(1);
}

const bucket = process.env.CDN_BUCKET;
if (!bucket) {
    console.error('CDN_BUCKET env var is required (S3 bucket backing cdn.ninescrolls.com).');
    console.error('Find it in CloudFormation: look for InsightsAssetsBucket output in the insights-assets-stack.');
    process.exit(1);
}

const distributionId = process.env.CDN_DISTRIBUTION_ID;
if (!distributionId && !noInvalidate) {
    console.error('CDN_DISTRIBUTION_ID env var is required (or pass --no-invalidate to skip).');
    process.exit(1);
}

// ── Discover files ───────────────────────────────────────────────────────────
const localDir = path.join(LOCAL_PRODUCTS_DIR, slug);
let entries: string[];
try {
    entries = readdirSync(localDir);
} catch {
    console.error(`Directory not found: ${localDir}`);
    process.exit(1);
}

const files = entries
    .filter((name) => {
        const full = path.join(localDir, name);
        return statSync(full).isFile() && MIME_TYPES[path.extname(name).toLowerCase()];
    })
    .sort();

if (files.length === 0) {
    console.error(`No image files found in ${localDir}`);
    process.exit(1);
}

console.log(`Slug:        ${slug}`);
console.log(`Source:      ${localDir}`);
console.log(`Destination: s3://${bucket}/${S3_PREFIX}/${slug}/`);
console.log(`Files:       ${files.length}`);
console.log('');

// ── Upload ───────────────────────────────────────────────────────────────────
const s3 = new S3Client({});

async function objectExists(key: string): Promise<boolean> {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket!, Key: key }));
        return true;
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'NotFound') {
            return false;
        }
        throw err;
    }
}

async function main() {
    let uploaded = 0;
    let skipped = 0;

    for (const name of files) {
        const localPath = path.join(localDir, name);
        const key = `${S3_PREFIX}/${slug}/${name}`;
        const ext = path.extname(name).toLowerCase();
        const mimeType = MIME_TYPES[ext];
        const size = statSync(localPath).size;

        if (dryRun) {
            console.log(`[dry-run] ${name.padEnd(28)} → s3://${bucket}/${key} (${(size / 1024).toFixed(0)} KB, ${mimeType})`);
            continue;
        }

        if (!force) {
            const exists = await objectExists(key);
            if (exists) {
                console.log(`SKIP  ${name.padEnd(28)} (already in S3, use --force to overwrite)`);
                skipped++;
                continue;
            }
        }

        const body = readFileSync(localPath);
        await s3.send(
            new PutObjectCommand({
                Bucket: bucket!,
                Key: key,
                Body: body,
                ContentType: mimeType,
                CacheControl: CACHE_CONTROL,
            }),
        );
        console.log(`PUT   ${name.padEnd(28)} (${(size / 1024).toFixed(0)} KB)`);
        uploaded++;
    }

    if (dryRun) {
        console.log('');
        console.log(`(dry-run) ${files.length} files would be uploaded.`);
        return;
    }

    console.log('');
    console.log(`Uploaded ${uploaded} file(s); skipped ${skipped}.`);

    if (uploaded === 0) {
        console.log('Nothing changed; skipping CloudFront invalidation.');
        return;
    }

    if (noInvalidate) {
        console.log('CloudFront invalidation skipped (--no-invalidate).');
        return;
    }

    const invalidationPath = `/${S3_PREFIX}/${slug}/*`;
    console.log(`Invalidating CloudFront ${distributionId} ${invalidationPath} ...`);
    try {
        const out = execFileSync('aws', [
            'cloudfront', 'create-invalidation',
            '--distribution-id', distributionId!,
            '--paths', invalidationPath,
            '--query', 'Invalidation.Id',
            '--output', 'text',
        ], { encoding: 'utf-8' });
        console.log(`Invalidation submitted: ${out.trim()}`);
    } catch (err) {
        console.error('CloudFront invalidation failed (uploads succeeded). You can retry with:');
        console.error(`  aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "${invalidationPath}"`);
        throw err;
    }

    console.log('');
    console.log(`Done. Verify at: https://cdn.ninescrolls.com/${S3_PREFIX}/${slug}/${files[0]}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
