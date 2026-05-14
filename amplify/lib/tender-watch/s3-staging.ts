import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({});

export interface StagingRef {
    bucket: string;
    key: string;
}

export async function writeStagedJson<T>(bucket: string, key: string, payload: T): Promise<StagingRef> {
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: 'application/json',
    }));
    return { bucket, key };
}

export async function readStagedJson<T>(ref: StagingRef): Promise<T> {
    const res = await client.send(new GetObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key,
    }));
    if (!res.Body) throw new Error(`S3 object ${ref.bucket}/${ref.key} has no body`);
    const text = await res.Body.transformToString('utf-8');
    return JSON.parse(text) as T;
}

/**
 * Generate a staged-payload S3 key. Step Functions execution id segments the path.
 * Example: tender-watch/2026-05-14T02:00:00.000Z-abc123/fetch-sam/output.json
 */
export function stagedKey(executionId: string, kind: string, name: string): string {
    return `tender-watch/${executionId}/${kind}/${name}.json`;
}
