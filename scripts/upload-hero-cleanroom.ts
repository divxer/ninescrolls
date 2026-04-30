/**
 * Upload hero-cleanroom-* image variants to the CDN (S3 + CloudFront).
 *
 * Reads files matching `hero-cleanroom-*.{jpg,webp}` from
 * `public/assets/images/` and uploads them to the bucket root so they are
 * served at `https://cdn.ninescrolls.com/hero-cleanroom-*` (matches the path
 * convention in src/config/imageConfig.ts — root-level keys for assets that
 * live directly under /assets/images/).
 *
 * Required env vars (loaded from .env via --env-file):
 *   AWS_PROFILE           IAM user / SSO profile with PutObject on the bucket
 *                         and CreateInvalidation on the distribution
 *   CDN_BUCKET            S3 bucket name backing cdn.ninescrolls.com
 *   CDN_DISTRIBUTION_ID   CloudFront distribution ID (skip with --no-invalidate)
 *
 * Usage:
 *   npm run upload-hero-cleanroom                   # upload + invalidate
 *   npm run upload-hero-cleanroom -- --dry-run
 *   npm run upload-hero-cleanroom -- --no-invalidate
 *   npm run upload-hero-cleanroom -- --force        # overwrite existing
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DIR = path.resolve(__dirname, '..', 'public/assets/images');
const FILE_PATTERN = /^hero-cleanroom-(sm|md|lg|xl)\.(jpg|webp)$/;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noInvalidate = args.includes('--no-invalidate');
const force = args.includes('--force');

const bucket = process.env.CDN_BUCKET;
if (!bucket) {
    console.error('CDN_BUCKET env var is required (S3 bucket backing cdn.ninescrolls.com).');
    process.exit(1);
}

const distributionId = process.env.CDN_DISTRIBUTION_ID;
if (!distributionId && !noInvalidate) {
    console.error('CDN_DISTRIBUTION_ID env var is required (or pass --no-invalidate to skip).');
    process.exit(1);
}

const files = readdirSync(LOCAL_DIR)
    .filter((name) => FILE_PATTERN.test(name))
    .sort();

if (files.length === 0) {
    console.error(`No hero-cleanroom variant files found in ${LOCAL_DIR}`);
    console.error('Expected: hero-cleanroom-{sm,md,lg,xl}.{jpg,webp}');
    process.exit(1);
}

console.log(`Source:      ${LOCAL_DIR}`);
console.log(`Destination: s3://${bucket}/`);
console.log(`Files:       ${files.length}`);
console.log('');

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
        const localPath = path.join(LOCAL_DIR, name);
        const key = name;
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

    const invalidationPath = '/hero-cleanroom-*';
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
    console.log(`Done. Verify at: https://cdn.ninescrolls.com/${files[0]}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
