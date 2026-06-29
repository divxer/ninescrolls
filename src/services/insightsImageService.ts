import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

// Generated Amplify input type for a given query/mutation's first argument.
// Used to narrow conditionally-built args objects to the exact generated input
// shape (instead of an `any` cast).
type AmplifyClient = ReturnType<typeof client>;
type QueryArgs<K extends keyof AmplifyClient['queries']> =
  Parameters<AmplifyClient['queries'][K]>[0];
type MutationArgs<K extends keyof AmplifyClient['mutations']> =
  Parameters<AmplifyClient['mutations'][K]>[0];

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
  const { data, errors } = await client().queries.getInsightsImageUploadUrl(
    { slug, fileName, mimeType } as QueryArgs<'getInsightsImageUploadUrl'>,
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
  const { data, errors } = await client().queries.getContentImageUploadUrl(
    { slug, fileName, mimeType } as QueryArgs<'getContentImageUploadUrl'>,
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
  const { data, errors } = await client().mutations.deleteInsightsImages(
    { slug } as MutationArgs<'deleteInsightsImages'>,
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
  const { data, errors } = await client().mutations.processInsightsImage(
    { s3Key, slug } as MutationArgs<'processInsightsImage'>,
    AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  if (!data) throw new Error('No data returned from processInsightsImage');
  return data as ImageUploadResult;
}
