/**
 * RFQ attachment uploads.
 *
 * The RFQ form is public, so attachments never travel through the submit-RFQ
 * request itself: the browser asks submit-rfq for a presigned PUT, uploads the
 * bytes straight to S3 under temp/rfq/, and then sends only the resulting keys
 * as `attachmentKeys` in the JSON payload. submit-rfq moves those keys to
 * rfqs/<rfqId>/ once Turnstile passes; anything left behind in temp/ is dropped
 * by the bucket's 1-day expiry rule.
 */

export const RFQ_API_URL = 'https://api.ninescrolls.com/api/rfq';

export interface RfqUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
}

/** Ask submit-rfq for a presigned PUT URL scoped to this exact file. */
export async function getRfqUploadUrl(file: File): Promise<RfqUploadUrlResponse> {
  const response = await fetch(`${RFQ_API_URL}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getUploadUrl',
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });

  if (!response.ok) {
    // The form Lambdas reject with { success, error, details } — never `message`.
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Could not prepare "${file.name}" for upload.`);
  }

  return (await response.json()) as RfqUploadUrlResponse;
}

/**
 * PUT the file to S3. The URL is signed with the file's exact ContentLength, so
 * the browser's automatic Content-Length must match or S3 rejects the request.
 */
export async function uploadRfqFileToS3(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed for "${file.name}" (status ${response.status}).`);
  }
}

/**
 * Presign + upload each file, returning the temp/rfq/ keys to send as
 * `attachmentKeys`. Throws on the first failure rather than silently submitting
 * an RFQ without the attachments the user chose.
 */
export async function uploadRfqAttachments(files: File[]): Promise<string[]> {
  const keys: string[] = [];
  for (const file of files) {
    const { uploadUrl, s3Key } = await getRfqUploadUrl(file);
    await uploadRfqFileToS3(uploadUrl, file);
    keys.push(s3Key);
  }
  return keys;
}
