import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

export interface ImageUploadResult {
  cdnBaseUrl: string;
  heroPrefix: string;
  fallbackExt: string;
  files: string[];
  error?: string | null;
}

/**
 * Step 1: Get a presigned URL for uploading an image to S3 temp/
 */
export async function getImageUploadUrl(
  slug: string,
  fileName: string,
  mimeType: string,
) {
  const { data, errors } = await client.queries.getInsightsImageUploadUrl(
    { slug, fileName, mimeType } as any,
    AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  if (!data) throw new Error('No data returned from getInsightsImageUploadUrl');
  return data as { uploadUrl: string; s3Key: string; expiresAt: string };
}

/**
 * Step 2: Upload the file directly to S3 using the presigned URL
 */
export async function uploadImageToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(file);
  });
}

/**
 * Get a presigned URL for uploading a content image directly to S3 (no resize).
 * Returns the CDN URL where the image will be accessible after upload.
 */
export async function getContentImageUploadUrl(
  slug: string,
  fileName: string,
  mimeType: string,
) {
  const { data, errors } = await client.queries.getContentImageUploadUrl(
    { slug, fileName, mimeType } as any,
    AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  if (!data) throw new Error('No data returned from getContentImageUploadUrl');
  return data as { uploadUrl: string; s3Key: string; cdnUrl: string };
}

/**
 * Delete all S3 images for an article (cover + content).
 * Called when an article is deleted.
 */
export async function deleteInsightsImages(slug: string) {
  const { data, errors } = await client.mutations.deleteInsightsImages(
    { slug } as any,
    AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data as { deletedCount: number; error?: string | null };
}

/**
 * Step 3: Process the uploaded image (resize + WebP optimization via Lambda)
 */
export async function processImage(
  s3Key: string,
  slug: string,
): Promise<ImageUploadResult> {
  const { data, errors } = await client.mutations.processInsightsImage(
    { s3Key, slug } as any,
    AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  if (!data) throw new Error('No data returned from processInsightsImage');
  return data as ImageUploadResult;
}
