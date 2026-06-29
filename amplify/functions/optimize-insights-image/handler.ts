import type { Schema } from '../../data/resource';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'node:crypto';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const s3Client = new S3Client({});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const BUCKET_NAME = () => process.env.INSIGHTS_ASSETS_BUCKET!;
const CDN_BASE_URL = () => process.env.CDN_BASE_URL!;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SIZES: Record<string, number> = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
};

const WEBP_QUALITY = 80;
const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes
const MAX_RETRIES = 3;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putWithRetry(
    params: { Bucket: string; Key: string; Body: Buffer; ContentType: string },
    retries = MAX_RETRIES,
): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await s3Client.send(new PutObjectCommand(params));
            return;
        } catch (err) {
            if (attempt === retries) throw err;
            const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
            console.warn(`S3 put attempt ${attempt} failed for ${params.Key}, retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
}

function sanitizeFileName(fileName: string): string {
    const baseName = fileName.split('/').pop()!.split('\\').pop()!;
    return baseName.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
}

function getExtFromMime(mimeType: string): string {
    switch (mimeType) {
        case 'image/jpeg': return '.jpg';
        case 'image/png': return '.png';
        case 'image/webp': return '.webp';
        default: return '.jpg';
    }
}

// ---------------------------------------------------------------------------
// Handler: getInsightsImageUploadUrl
// Generates presigned PUT URL for uploading original image to temp/
// ---------------------------------------------------------------------------
export const getInsightsImageUploadUrl: Schema['getInsightsImageUploadUrl']['functionHandler'] =
    async (event) => {
        const { slug, fileName, mimeType } = event.arguments;

        if (!slug || !fileName || !mimeType) {
            throw new Error('slug, fileName, and mimeType are required');
        }

        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new Error(`Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
        }

        const safeName = sanitizeFileName(fileName);
        const uploadId = crypto.randomBytes(4).toString('hex');
        const s3Key = `temp/${slug}/${uploadId}_${safeName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME(),
            Key: s3Key,
            ContentType: mimeType,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch
        const uploadUrl = await getSignedUrl(s3Client as any, command as any, {
            expiresIn: PRESIGNED_URL_EXPIRY,
        });

        const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

        console.log(`Presigned URL generated for insights image: ${s3Key}`);

        return {
            uploadUrl,
            s3Key,
            expiresAt,
        };
    };

// ---------------------------------------------------------------------------
// Handler: getContentImageUploadUrl
// Generates presigned PUT URL for uploading content images directly to insights/
// (no resize — images are used as-is in article body)
// ---------------------------------------------------------------------------
export const getContentImageUploadUrl: Schema['getContentImageUploadUrl']['functionHandler'] =
    async (event) => {
        const { slug, fileName, mimeType } = event.arguments;

        if (!slug || !fileName || !mimeType) {
            throw new Error('slug, fileName, and mimeType are required');
        }

        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new Error(`Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
        }

        const safeName = sanitizeFileName(fileName);
        const uploadId = crypto.randomBytes(4).toString('hex');
        const ext = getExtFromMime(mimeType);
        const nameWithoutExt = path.basename(safeName, path.extname(safeName));
        const s3Key = `insights/${slug}/content/${uploadId}_${nameWithoutExt}${ext}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME(),
            Key: s3Key,
            ContentType: mimeType,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch
        const uploadUrl = await getSignedUrl(s3Client as any, command as any, {
            expiresIn: PRESIGNED_URL_EXPIRY,
        });

        const cdnUrl = `${CDN_BASE_URL()}/${s3Key}`;

        console.log(`Content image presigned URL generated: ${s3Key}`);

        return {
            uploadUrl,
            s3Key,
            cdnUrl,
        };
    };

// ---------------------------------------------------------------------------
// Handler: processInsightsImage
// Downloads from S3 temp/, resizes to 4 sizes × 2 formats, uploads to insights/
// ---------------------------------------------------------------------------
export const processInsightsImage: Schema['processInsightsImage']['functionHandler'] =
    async (event) => {
        const { s3Key, slug } = event.arguments;

        if (!s3Key || !slug) {
            throw new Error('s3Key and slug are required');
        }

        const bucket = BUCKET_NAME();
        const cdnBase = CDN_BASE_URL();

        // 1. Download original from S3
        let imageBuffer: Buffer;
        let originalMime: string;
        try {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: s3Key,
            }));
            imageBuffer = Buffer.from(await response.Body!.transformToByteArray());
            originalMime = response.ContentType || 'image/jpeg';
        } catch (err) {
            console.error(`Failed to download ${s3Key}:`, err);
            throw new Error('Failed to download uploaded image. It may have expired.');
        }

        // Derive prefix from filename: temp/slug/abc12345_hero.png -> hero
        const originalFileName = path.basename(s3Key);
        const nameWithoutUploadId = originalFileName.replace(/^[a-f0-9]+_/, '');
        const prefix = path.basename(nameWithoutUploadId, path.extname(nameWithoutUploadId));
        const fallbackExt = getExtFromMime(originalMime).replace('.', '');

        // 2. Verify image can be processed
        try {
            await sharp(imageBuffer).metadata();
        } catch (err) {
            console.error('Sharp metadata check failed:', err);
            throw new Error('Uploaded file is not a valid image or is corrupted.');
        }

        // 3. Resize and upload
        const files: string[] = [];
        const errors: string[] = [];

        for (const [size, width] of Object.entries(SIZES)) {
            // Original format
            const origKey = `insights/${slug}/${prefix}-${size}.${fallbackExt}`;
            try {
                const resized = await sharp(imageBuffer)
                    .resize(width, null, {
                        fit: 'contain',
                        withoutEnlargement: true,
                    })
                    .toBuffer();

                await putWithRetry({
                    Bucket: bucket,
                    Key: origKey,
                    Body: resized,
                    ContentType: originalMime,
                });
                files.push(origKey);
                console.log(`Generated: ${origKey}`);
            } catch (err) {
                const msg = `Failed to generate ${origKey}: ${err instanceof Error ? err.message : err}`;
                console.error(msg);
                errors.push(msg);
            }

            // WebP format
            const webpKey = `insights/${slug}/${prefix}-${size}.webp`;
            try {
                const resized = await sharp(imageBuffer)
                    .resize(width, null, {
                        fit: 'contain',
                        withoutEnlargement: true,
                    })
                    .webp({ quality: WEBP_QUALITY })
                    .toBuffer();

                await putWithRetry({
                    Bucket: bucket,
                    Key: webpKey,
                    Body: resized,
                    ContentType: 'image/webp',
                });
                files.push(webpKey);
                console.log(`Generated: ${webpKey}`);
            } catch (err) {
                const msg = `Failed to generate ${webpKey}: ${err instanceof Error ? err.message : err}`;
                console.error(msg);
                errors.push(msg);
            }
        }

        // 4. Cleanup temp file (best effort)
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: s3Key,
            }));
            console.log(`Cleaned up temp file: ${s3Key}`);
        } catch (err) {
            console.warn(`Failed to cleanup temp file ${s3Key}:`, err);
        }

        const errorMsg = errors.length > 0 ? errors.join('; ') : null;

        console.log(`Image processing complete for ${slug}/${prefix}: ${files.length} files generated`);
        if (errorMsg) {
            console.error(`Partial errors: ${errorMsg}`);
        }

        return {
            cdnBaseUrl: cdnBase,
            heroPrefix: prefix,
            fallbackExt,
            files,
            error: errorMsg,
        };
    };

// ---------------------------------------------------------------------------
// Handler: deleteInsightsImages
// Deletes all S3 objects under insights/{slug}/ (cover + content images)
// ---------------------------------------------------------------------------
export const deleteInsightsImages: Schema['deleteInsightsImages']['functionHandler'] =
    async (event) => {
        const { slug } = event.arguments;
        const dryRun = (event.arguments as any).dryRun ?? false;

        if (!slug) {
            throw new Error('slug is required');
        }

        // Validate slug format: alphanumeric, hyphens, underscores only
        if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
            throw new Error('Invalid slug format. Only alphanumeric characters, hyphens, and underscores are allowed.');
        }

        const bucket = BUCKET_NAME();
        const prefix = `insights/${slug}/`;
        let deletedCount = 0;
        const keys: string[] = [];

        try {
            // List all objects under the prefix (paginated)
            let continuationToken: string | undefined;
            do {
                const listResponse = await s3Client.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                }));

                const objects = listResponse.Contents;
                if (!objects || objects.length === 0) break;

                if (dryRun) {
                    keys.push(...objects.map((obj) => obj.Key!));
                    deletedCount += objects.length;
                } else {
                    // Batch delete (up to 1000 per request)
                    await s3Client.send(new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: {
                            Objects: objects.map((obj) => ({ Key: obj.Key! })),
                            Quiet: true,
                        },
                    }));
                    deletedCount += objects.length;
                }

                continuationToken = listResponse.NextContinuationToken;
            } while (continuationToken);

            if (dryRun) {
                console.log(`[DRY RUN] Would delete ${deletedCount} objects under ${prefix}:`, keys);
            } else {
                console.log(`Deleted ${deletedCount} objects under ${prefix}`);
            }
        } catch (err) {
            console.error(`Failed to delete objects under ${prefix}:`, err);
            return { deletedCount, error: err instanceof Error ? err.message : 'Delete failed' };
        }

        return { deletedCount, error: null };
    };

// ---------------------------------------------------------------------------
// Main dispatcher — Amplify Gen 2 AppSync resolver entry point
// Routes to the correct handler based on event.fieldName
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolvers: Record<string, (...args: any[]) => any> = {
    getInsightsImageUploadUrl,
    getContentImageUploadUrl,
    processInsightsImage,
    deleteInsightsImages,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
    const fieldName = event.info?.fieldName ?? event.fieldName;

    if (!fieldName) {
        console.error('optimize-insights-image: full event:', JSON.stringify(event));
        throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
    }

    console.log(`optimize-insights-image: resolving ${fieldName}`);

    const resolver = resolvers[fieldName];
    if (!resolver) {
        throw new Error(`No resolver for field: ${fieldName}`);
    }

    return resolver(event);
};
