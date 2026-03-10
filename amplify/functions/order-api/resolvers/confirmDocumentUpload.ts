import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { docClient, s3Client, TABLE_NAME, BUCKET_NAME } from '../lib/dynamodb.js';
import { VALID_STAGES, DOCUMENT_TYPES, MAX_FILE_SIZE } from '../lib/types.js';
import { generateDocId } from '../lib/idGenerators.js';
import { buildDocumentResponse } from '../lib/orderHelper.js';
import type { AppSyncEvent, DocumentItem } from '../lib/types.js';

export async function confirmDocumentUpload(event: AppSyncEvent) {
    const args = event.arguments as {
        orderId: string;
        s3Key: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        stage: string;
        docType: string;
        description?: string;
        tags?: string;  // JSON string from a.json()
    };

    if (!args.orderId || !args.s3Key || !args.fileName || !args.mimeType || !args.stage || !args.docType) {
        throw new Error('orderId, s3Key, fileName, mimeType, stage, and docType are required');
    }

    if (!VALID_STAGES.includes(args.stage as typeof VALID_STAGES[number])) {
        throw new Error(`Invalid stage: ${args.stage}`);
    }

    if (!DOCUMENT_TYPES.includes(args.docType as typeof DOCUMENT_TYPES[number])) {
        throw new Error(`Invalid docType: ${args.docType}`);
    }

    if (args.fileSize && args.fileSize > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const bucket = BUCKET_NAME();
    const docId = generateDocId();
    const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destKey = `orders/${args.orderId}/${args.stage}/${docId}_${safeName}`;
    const now = new Date().toISOString();
    const operator = event.identity?.claims?.email as string || event.identity?.sub || 'admin';

    // Parse tags from JSON if provided
    let tags: string[] = [];
    if (args.tags) {
        try {
            tags = typeof args.tags === 'string' ? JSON.parse(args.tags) : args.tags;
        } catch {
            tags = [];
        }
    }

    // Move file from temp/ to final location
    await s3Client.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${args.s3Key}`,
        Key: destKey,
    }));

    await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: args.s3Key,
    }));

    // Create ORDER_DOCUMENT record
    const docItem: DocumentItem = {
        PK: `ORDER#${args.orderId}`,
        SK: `DOC#${args.stage}#${docId}`,
        docId,
        fileName: args.fileName,
        fileSize: args.fileSize || 0,
        mimeType: args.mimeType,
        stage: args.stage,
        docType: args.docType,
        description: args.description || '',
        s3Key: destKey,
        uploadedBy: operator,
        uploadedAt: now,
        tags,
        isLatestVersion: true,
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: docItem,
    }));

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${args.orderId}`,
            SK: `LOG#${now}`,
            action: 'DOCUMENT_UPLOADED',
            operator,
            timestamp: now,
            detail: `${args.docType}: ${args.fileName} (${args.stage})`,
        },
    }));

    return buildDocumentResponse(docItem);
}
