import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient, PutCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
const BUCKET_NAME = () => process.env.DOCUMENTS_BUCKET!;

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://admin.ninescrolls.com',
    'https://ninescrolls.com',
    'http://localhost:5173',
];

function getCorsHeaders(origin?: string) {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age': '300',
    };
}

// ---------------------------------------------------------------------------
// Constants — §12.9.8
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/zip',
];

const VALID_STAGES = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'WARRANTY',
];

const VALID_DOC_TYPES = [
    'QUOTATION', 'TECHNICAL_SPEC', 'REQUIREMENTS', 'PURCHASE_ORDER',
    'CONTRACT', 'VENDOR_FORM', 'DRAWING', 'TEST_REPORT', 'PROGRESS_PHOTO',
    'SHIPPING_DOC', 'INSTALLATION_DOC', 'TRAINING_RECORD', 'WARRANTY',
    'MAINTENANCE', 'CORRESPONDENCE', 'OTHER',
];

const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GetUploadUrlRequest {
    action: 'getUploadUrl';
    orderId: string;
    fileName: string;
    mimeType: string;
}

interface ConfirmUploadRequest {
    action: 'confirmUpload';
    orderId: string;
    s3Key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    stage: string;
    docType: string;
    description?: string;
    tags?: string[];
    uploadedBy: string;
}

type DocumentRequest = GetUploadUrlRequest | ConfirmUploadRequest;

// ---------------------------------------------------------------------------
// Handler — §12.9.5
// Routes on `action` field: getUploadUrl | confirmUpload
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('document-upload Lambda invoked');

    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    const method = event.requestContext?.http?.method
        || (event as unknown as { httpMethod?: string }).httpMethod;

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Request body is required' }),
            };
        }

        let req: DocumentRequest;
        try {
            req = JSON.parse(event.body) as DocumentRequest;
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
            };
        }

        if (req.action === 'getUploadUrl') {
            return await handleGetUploadUrl(req, corsHeaders);
        } else if (req.action === 'confirmUpload') {
            return await handleConfirmUpload(req, corsHeaders);
        } else {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid action. Use "getUploadUrl" or "confirmUpload".',
                }),
            };
        }

    } catch (error) {
        console.error('Error in document-upload:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error' }),
        };
    }
};

// ---------------------------------------------------------------------------
// getUploadUrl — §12.9.5 step 1
// Generates presigned PUT URL for temp/ directory
// ---------------------------------------------------------------------------
async function handleGetUploadUrl(
    req: GetUploadUrlRequest,
    corsHeaders: Record<string, string>,
) {
    if (!req.orderId || !req.fileName || !req.mimeType) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'orderId, fileName, and mimeType are required',
            }),
        };
    }

    if (!ALLOWED_MIME_TYPES.includes(req.mimeType)) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Unsupported file type: ${req.mimeType}`,
                allowedTypes: ALLOWED_MIME_TYPES,
            }),
        };
    }

    // Sanitize fileName: strip path components, remove traversal, keep extension
    const baseName = req.fileName.split('/').pop()!.split('\\').pop()!;
    const safeName = baseName.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
    const uploadId = crypto.randomBytes(4).toString('hex');
    const s3Key = `temp/${req.orderId}/${uploadId}_${safeName}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME(),
        Key: s3Key,
        ContentType: req.mimeType,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch between root and function deps
    const uploadUrl = await getSignedUrl(s3Client as any, command as any, {
        expiresIn: PRESIGNED_URL_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

    console.log(`Presigned URL generated: ${s3Key}`);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            uploadUrl,
            s3Key,
            expiresAt,
        }),
    };
}

// ---------------------------------------------------------------------------
// confirmUpload — §12.9.5 step 3
// Move from temp/ to orders/<orderId>/<stage>/, create ORDER_DOCUMENT record
// ---------------------------------------------------------------------------
async function handleConfirmUpload(
    req: ConfirmUploadRequest,
    corsHeaders: Record<string, string>,
) {
    // Validate required fields
    if (!req.orderId || !req.s3Key || !req.fileName || !req.mimeType || !req.stage || !req.docType || !req.uploadedBy) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'orderId, s3Key, fileName, mimeType, fileSize, stage, docType, and uploadedBy are required',
            }),
        };
    }

    if (!VALID_STAGES.includes(req.stage)) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: `Invalid stage: ${req.stage}` }),
        };
    }

    if (!VALID_DOC_TYPES.includes(req.docType)) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: `Invalid docType: ${req.docType}` }),
        };
    }

    if (req.fileSize && req.fileSize > MAX_FILE_SIZE) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            }),
        };
    }

    const bucket = BUCKET_NAME();
    const docId = `doc-${crypto.randomBytes(3).toString('hex')}`;
    const safeName = req.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destKey = `orders/${req.orderId}/${req.stage}/${docId}_${safeName}`;
    const now = new Date().toISOString();

    // Move file from temp/ to final location
    try {
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${req.s3Key}`,
            Key: destKey,
        }));

        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: req.s3Key,
        }));
    } catch (err) {
        console.error(`Failed to move file from ${req.s3Key} to ${destKey}:`, err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to process uploaded file. It may have expired.',
            }),
        };
    }

    // Create ORDER_DOCUMENT record — §12.9.4
    const docItem = {
        PK: `ORDER#${req.orderId}`,
        SK: `DOC#${req.stage}#${docId}`,
        docId,
        fileName: req.fileName,
        fileSize: req.fileSize || 0,
        mimeType: req.mimeType,
        stage: req.stage,
        docType: req.docType,
        description: req.description || '',
        s3Key: destKey,
        uploadedBy: req.uploadedBy,
        uploadedAt: now,
        tags: req.tags || [],
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
            PK: `ORDER#${req.orderId}`,
            SK: `LOG#${now}`,
            action: 'DOCUMENT_UPLOADED',
            operator: req.uploadedBy,
            timestamp: now,
            detail: `${req.docType}: ${req.fileName} (${req.stage})`,
        },
    }));

    console.log(`Document confirmed: ${docId} → ${destKey}`);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            document: {
                docId,
                fileName: req.fileName,
                fileSize: req.fileSize,
                mimeType: req.mimeType,
                stage: req.stage,
                docType: req.docType,
                description: req.description || '',
                s3Key: destKey,
                uploadedBy: req.uploadedBy,
                uploadedAt: now,
                tags: req.tags || [],
                isLatestVersion: true,
            },
        }),
    };
}
