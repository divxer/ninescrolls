import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
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
const TURNSTILE_SECRET = () => process.env.TURNSTILE_SECRET_KEY!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'http://localhost:5173',
];

const EQUIPMENT_CATEGORIES = [
    'ICP', 'PECVD', 'Sputter', 'ALD', 'RIE', 'IBE', 'HDP-CVD', 'Other',
] as const;

const ROLES = ['PI', 'Researcher', 'Procurement', 'Lab Manager', 'Other'] as const;

const BUDGET_RANGES = [
    'Prefer not to say',
    'Under $100,000',
    '$100,000 - $200,000',
    '$200,000 - $500,000',
    'Over $500,000',
] as const;

const TIMELINES = [
    'exploring-options',
    'within-3-months',
    'within-6-months',
    'within-12-months',
    'urgent',
] as const;

const FUNDING_STATUSES = [
    'funded',
    'pending-approval',
    'grant-in-progress',
    'early-research',
] as const;

const REFERRAL_SOURCES = [
    'web-search',
    'referral',
    'conference',
    'publication',
    'other',
] as const;

// ---------------------------------------------------------------------------
// Zod Schema — matches §12.10.3 API format
// ---------------------------------------------------------------------------
export const rfqSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(254),
    phone: z.string().max(30).optional(),
    institution: z.string().min(2).max(200),
    department: z.string().max(200).optional(),
    role: z.enum(ROLES),
    equipmentCategory: z.enum(EQUIPMENT_CATEGORIES),
    specificModel: z.string().max(100).optional(),
    applicationDescription: z.string().min(10).max(3000),
    keySpecifications: z.string().max(3000).optional(),
    quantity: z.number().int().positive().default(1),
    budgetRange: z.enum(BUDGET_RANGES).optional(),
    timeline: z.enum(TIMELINES).optional(),
    fundingStatus: z.enum(FUNDING_STATUSES).optional(),
    referralSource: z.enum(REFERRAL_SOURCES).optional(),
    existingEquipment: z.string().max(2000).optional(),
    additionalComments: z.string().max(3000).optional(),
    turnstileToken: z.string().min(1),
    // S3 keys from presigned URL uploads (temp/ prefix)
    attachmentKeys: z.array(z.string().max(500)).max(3).optional(),
});

export type RfqInput = z.infer<typeof rfqSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCorsHeaders(origin?: string) {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '300',
    };
}

function sanitize(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Sanitize all string fields in an object (shallow). */
function sanitizeStrings<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj };
    for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string') {
            (result as Record<string, unknown>)[key] = sanitize(value);
        }
    }
    return result;
}

function generateRfqId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex');
    return `rfq-${date}-${rand}`;
}

function generateReferenceNumber(rfqId: string): string {
    // Extract date and short hash: rfq-20260310-a1b2c3 → RFQ-20260310-A1B2
    const parts = rfqId.split('-');
    const date = parts[1];
    const hash = parts[2].substring(0, 4).toUpperCase();
    return `RFQ-${date}-${hash}`;
}

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
}

function extractEmailDomain(email: string): string {
    return email.split('@')[1]?.toLowerCase() ?? '';
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------
async function verifyTurnstile(token: string): Promise<boolean> {
    const secret = TURNSTILE_SECRET();
    if (!secret) {
        console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
        return true;
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            secret,
            response: token,
        }),
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    if (!result.success) {
        console.error('Turnstile verification failed:', JSON.stringify(result));
    }
    return result.success;
}

// ---------------------------------------------------------------------------
// ORG matching — try email domain first, then institution name
// ---------------------------------------------------------------------------
async function matchOrg(emailDomain: string, _institution: string): Promise<string | null> {
    try {
        // Query GSI2 for ORG entities matching the email domain
        // ORG entities use PK=ORG#<orgId>, and we can look up by domain
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORG_DOMAIN#${emailDomain}` },
            Limit: 1,
        }));

        if (result.Items && result.Items.length > 0) {
            return result.Items[0].orgId as string;
        }
    } catch (err) {
        console.warn('ORG matching failed (non-critical):', err);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Lead Score update — §12.10.10
// ---------------------------------------------------------------------------
async function updateLeadScore(orgId: string, data: RfqInput): Promise<void> {
    let points = 8; // Base: RFQ submission
    if (data.fundingStatus === 'funded') points += 5;
    if (data.timeline === 'urgent') points += 3;

    try {
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `ORG#${orgId}`, SK: 'META' },
            UpdateExpression: 'ADD leadScore :pts SET hasActiveInquiry = :t, latestRFQDate = :d, updatedAt = :now',
            ExpressionAttributeValues: {
                ':pts': points,
                ':t': true,
                ':d': new Date().toISOString(),
                ':now': new Date().toISOString(),
            },
        }));
        console.log(`Lead Score updated: ORG#${orgId} +${points} points`);
    } catch (err) {
        console.warn('Lead Score update failed (non-critical):', err);
    }
}

// ---------------------------------------------------------------------------
// Move attachments from temp/ to rfqs/<rfqId>/
// ---------------------------------------------------------------------------
async function moveAttachments(rfqId: string, tempKeys: string[]): Promise<string[]> {
    const bucket = BUCKET_NAME();
    const finalKeys: string[] = [];

    for (const tempKey of tempKeys) {
        const fileName = tempKey.split('/').pop() ?? tempKey;
        const destKey = `rfqs/${rfqId}/${fileName}`;

        try {
            await s3Client.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${tempKey}`,
                Key: destKey,
            }));

            await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: tempKey,
            }));

            finalKeys.push(destKey);
            console.log(`Attachment moved: ${tempKey} → ${destKey}`);
        } catch (err) {
            console.error(`Failed to move attachment ${tempKey}:`, err);
        }
    }

    return finalKeys;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Send confirmation email to customer via SendGrid — §12.10.9 */
async function sendConfirmationEmail(data: RfqInput, referenceNumber: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping confirmation email');
        return;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: data.email }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Technology' },
            subject: `We've received your quote request — Reference ${referenceNumber}`,
            content: [{
                type: 'text/html',
                value: `
<p>Dear ${sanitize(data.name)},</p>

<p>Thank you for your interest in NineScrolls ${sanitize(data.equipmentCategory)} systems.</p>

<p>We've received your quote request and assigned it reference number
<strong>${referenceNumber}</strong>. Our engineering team will review your requirements
and respond within 1-2 business days.</p>

<p><strong>Your Request Summary:</strong></p>
<ul>
  <li>Equipment: ${sanitize(data.equipmentCategory)}${data.specificModel ? ' — ' + sanitize(data.specificModel) : ''}</li>
  <li>Institution: ${sanitize(data.institution)}</li>
</ul>

<p>If you have any questions in the meantime, please reply to this email
or contact us at sales@ninescrolls.com.</p>

<p>Best regards,<br>NineScrolls Technology LLC</p>
                `.trim(),
            }],
            reply_to: { email: 'sales@ninescrolls.com', name: 'NineScrolls Sales' },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`SendGrid error ${response.status}: ${errBody}`);
    } else {
        console.log(`Confirmation email sent to ${data.email}`);
    }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('submit-rfq Lambda invoked');

    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    const method = event.requestContext?.http?.method
        || (event as unknown as { httpMethod?: string }).httpMethod;

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        // 0. Parse body
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Request body is required' }),
            };
        }

        let rawBody: unknown;
        try {
            rawBody = JSON.parse(event.body);
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
            };
        }

        // 1. Validate Turnstile CAPTCHA
        const ip = event.requestContext?.http?.sourceIp
            || (event.headers?.['x-forwarded-for']?.split(',')[0]?.trim())
            || '0.0.0.0';

        const turnstileToken = (rawBody as Record<string, unknown>).turnstileToken as string;
        if (!turnstileToken) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'CAPTCHA verification required' }),
            };
        }

        const turnstileValid = await verifyTurnstile(turnstileToken);
        if (!turnstileValid) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'CAPTCHA verification failed' }),
            };
        }

        // 2. Schema validation with Zod
        const parseResult = rfqSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errors = parseResult.error.issues.map(i => ({
                field: i.path.join('.'),
                message: i.message,
            }));
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Validation failed', details: errors }),
            };
        }

        const data = parseResult.data;

        // 3. Sanitize input (XSS)
        const sanitized = sanitizeStrings(data);

        // 4. Generate IDs
        const rfqId = generateRfqId();
        const referenceNumber = generateReferenceNumber(rfqId);
        const submittedAt = new Date().toISOString();
        const ipHashed = hashIp(ip);

        // 5. Match ORG entity
        const emailDomain = extractEmailDomain(data.email);
        const matchedOrgId = await matchOrg(emailDomain, data.institution);

        // 6. Create RFQ_SUBMISSION entity in DynamoDB — §12.10.4
        const item: Record<string, unknown> = {
            PK: `RFQ#${rfqId}`,
            SK: 'META',
            GSI1PK: 'RFQ_STATUS#pending',
            GSI1SK: `${submittedAt}#${rfqId}`,
            rfqId,
            referenceNumber,
            status: 'pending',
            submittedAt,
            ipHash: ipHashed,
            // All form fields (sanitized)
            name: sanitized.name,
            email: sanitized.email,
            phone: sanitized.phone,
            institution: sanitized.institution,
            department: sanitized.department,
            role: sanitized.role,
            equipmentCategory: sanitized.equipmentCategory,
            specificModel: sanitized.specificModel,
            applicationDescription: sanitized.applicationDescription,
            keySpecifications: sanitized.keySpecifications,
            quantity: sanitized.quantity,
            budgetRange: sanitized.budgetRange,
            timeline: sanitized.timeline,
            fundingStatus: sanitized.fundingStatus,
            referralSource: sanitized.referralSource,
            existingEquipment: sanitized.existingEquipment,
            additionalComments: sanitized.additionalComments,
            TTL: 0, // No expiry
        };

        // Add ORG association if matched
        if (matchedOrgId) {
            item.matchedOrgId = matchedOrgId;
            item.GSI2PK = `ORG#${matchedOrgId}`;
            item.GSI2SK = `RFQ#${submittedAt}`;
        }

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: item,
        }));
        console.log(`RFQ_SUBMISSION created: ${rfqId}`);

        // 7. Move attachments from temp/ → rfqs/<rfqId>/
        let attachmentKeys: string[] = [];
        if (data.attachmentKeys && data.attachmentKeys.length > 0) {
            attachmentKeys = await moveAttachments(rfqId, data.attachmentKeys);

            // Update the record with final attachment keys
            if (attachmentKeys.length > 0) {
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
                    UpdateExpression: 'SET attachmentKeys = :keys',
                    ExpressionAttributeValues: { ':keys': attachmentKeys },
                }));
            }
        }

        // 8. Lead Score update (if ORG matched) — §12.10.10
        if (matchedOrgId) {
            await updateLeadScore(matchedOrgId, data);
        }

        // 9. Send confirmation email (best-effort)
        await sendConfirmationEmail(data, referenceNumber).catch(err =>
            console.warn('Confirmation email failed (non-critical):', err)
        );

        // 10. Return success — §12.10.3
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                rfqId,
                message: "Thank you. We'll respond within 1-2 business days.",
                referenceNumber,
            }),
        };

    } catch (error) {
        console.error('Error in submit-rfq Lambda:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error. Please try again later.' }),
        };
    }
};
