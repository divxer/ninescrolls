import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../lib/dynamodb.js';
import { ALLOWED_MIME_TYPES, PRESIGNED_URL_EXPIRY } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';
import crypto from 'node:crypto';

export async function getDocumentUploadUrl(event: AppSyncEvent) {
    const { orderId, fileName, mimeType } = event.arguments as {
        orderId: string;
        fileName: string;
        mimeType: string;
    };

    if (!orderId || !fileName || !mimeType) {
        throw new Error('orderId, fileName, and mimeType are required');
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    const baseName = fileName.split('/').pop()!.split('\\').pop()!;
    const safeName = baseName.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
    const uploadId = crypto.randomBytes(4).toString('hex');
    const s3Key = `temp/${orderId}/${uploadId}_${safeName}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME(),
        Key: s3Key,
        ContentType: mimeType,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch between root and function deps
    const uploadUrl = await getSignedUrl(s3Client as any, command as any, {
        expiresIn: PRESIGNED_URL_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

    return { uploadUrl, s3Key, expiresAt };
}
