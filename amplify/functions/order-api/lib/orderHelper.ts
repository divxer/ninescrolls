import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { docClient, s3Client, TABLE_NAME, BUCKET_NAME, SLACK_WEBHOOK_URL } from './dynamodb.js';
import type { OrderItem, ContactItem, DocumentItem, ContactRole } from './types.js';
import { CONTACT_ROLES } from './types.js';

/** Sanitize a role value from DynamoDB to a valid ContactRole enum value. */
function sanitizeRole(raw: string): ContactRole {
    if (CONTACT_ROLES.includes(raw as ContactRole)) return raw as ContactRole;
    // Handle legacy mixed-case values from RFQ conversion
    const upper = raw.toUpperCase().replace(/\s+/g, '_');
    if (CONTACT_ROLES.includes(upper as ContactRole)) return upper as ContactRole;
    const LEGACY_MAP: Record<string, ContactRole> = {
        'RESEARCH_SCIENTIST': 'RESEARCHER',
        'POSTDOC': 'RESEARCHER',
        'GRADUATE_STUDENT': 'RESEARCHER',
        'ENGINEER': 'OTHER',
        'BUSINESS_DEVELOPMENT': 'OTHER',
    };
    return LEGACY_MAP[upper] ?? 'OTHER';
}

/**
 * Fetch a single ORDER entity from DynamoDB.
 */
export async function fetchOrder(orderId: string): Promise<OrderItem | null> {
    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `ORDER#${orderId}`, SK: 'META' },
    }));
    return (result.Item as OrderItem) || null;
}

/**
 * Fetch all contacts for an order.
 */
export async function fetchContacts(orderId: string): Promise<ContactItem[]> {
    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `ORDER#${orderId}`,
            ':sk': 'CONTACT#',
        },
    }));
    return (result.Items || []) as ContactItem[];
}

/**
 * Build a full Order GraphQL response object from a DynamoDB item + contacts.
 */
export function buildOrderResponse(order: OrderItem, contacts: ContactItem[]): Record<string, unknown> {
    const now = new Date();
    const updatedAt = order.updatedAt ? new Date(order.updatedAt) : now;
    const daysSinceLastUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
        orderId: order.orderId,
        quoteNumber: order.quoteNumber || null,
        poNumber: order.poNumber || null,
        status: order.status,
        institution: order.institution,
        department: order.department || null,
        productModel: order.productModel,
        productName: order.productName || null,
        configuration: order.configuration || null,
        quoteAmount: order.quoteAmount || null,
        notes: order.notes || null,
        matchedOrgId: order.matchedOrgId || null,
        contacts: contacts.map(c => ({
            contactId: c.contactId,
            contactName: c.contactName,
            contactEmail: c.contactEmail,
            contactPhone: c.contactPhone || null,
            role: sanitizeRole(c.role),
            department: c.department || null,
            isPrimary: c.isPrimary,
            feedbackInvite: c.feedbackInvite,
            notes: c.notes || null,
        })),
        quoteDate: order.quoteDate || null,
        poDate: order.poDate || null,
        estimatedDelivery: order.estimatedDelivery || null,
        productionStartDate: order.productionStartDate || null,
        shipDate: order.shipDate || null,
        installDate: order.installDate || null,
        closeDate: order.closeDate || null,
        warrantyEndDate: order.warrantyEndDate || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        createdBy: order.createdBy,
        feedbackScheduleCreated: order.feedbackScheduleCreated || false,
        feedbackCount: 0, // computed separately if needed
        daysSinceLastUpdate,
        source: order.source || 'MANUAL',
        rfqId: order.rfqId || null,
        declineReason: order.declineReason || null,
    };
}

/**
 * Build a full Order response by fetching order + contacts.
 */
export async function buildFullOrderResponse(orderId: string): Promise<Record<string, unknown> | null> {
    const order = await fetchOrder(orderId);
    if (!order) return null;
    const contacts = await fetchContacts(orderId);
    return buildOrderResponse(order, contacts);
}

/**
 * Build a document response with presigned download/preview URLs.
 */
export async function buildDocumentResponse(doc: DocumentItem): Promise<Record<string, unknown>> {
    let downloadUrl: string | null = null;
    let previewUrl: string | null = null;

    if (doc.s3Key) {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME(),
                Key: doc.s3Key,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch between root and function deps
            downloadUrl = await getSignedUrl(s3Client as any, command as any, { expiresIn: 900 });

            const previewTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
            if (previewTypes.includes(doc.mimeType)) {
                previewUrl = downloadUrl;
            }
        } catch {
            // S3 object may not exist
        }
    }

    return {
        docId: doc.docId,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        stage: doc.stage,
        docType: doc.docType,
        description: doc.description || null,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        tags: doc.tags || [],
        isLatestVersion: doc.isLatestVersion,
        downloadUrl,
        previewUrl,
    };
}

/**
 * Send a Slack notification (best-effort).
 */
export async function sendSlackNotification(text: string): Promise<void> {
    const webhookUrl = SLACK_WEBHOOK_URL();
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
    } catch (err) {
        console.warn('Slack notification failed:', err);
    }
}
