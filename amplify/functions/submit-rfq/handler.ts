import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import crypto from 'node:crypto';
import { RFQ_FIELD_LIMITS as L } from '../../lib/rfq/limits';
import { invokeOrganizationApi } from '../../lib/organization/invoke-org-api';
import { computeRfqScore } from '../../lib/organization/lead-score';
import { emitTimelineEventToCrm, invokeCrmAction } from '../../lib/crm/invoke-crm-api';
import { buildRfqEmitArgs } from '../../lib/crm/emit-builders';
import { toSend, upsertVisitorBridge } from '../../lib/crm/visitor-bridge';

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
    'ICP', 'PECVD', 'Sputter', 'E-Beam', 'ALD', 'RIE', 'IBE', 'HDP-CVD',
    'Plasma-Cleaner', 'Stripper', 'Coater-Developer', 'Probe-Station', 'Other',
] as const;

const ROLES = [
    'PI', 'Research Scientist', 'Postdoc', 'Researcher', 'Graduate Student', 'Engineer',
    'Procurement', 'Lab Manager', 'Business Development', 'Other',
] as const;

const BUDGET_RANGES = [
    'Under $10k',
    '$10k - $30k',
    '$30k - $80k',
    '$80k - $150k',
    'Over $150k',
    'Not yet defined',
] as const;

const TIMELINES = [
    'immediate',
    'within-3-months',
    'within-6-months',
    '6-plus-months',
    'budgetary-planning',
] as const;

const FUNDING_STATUSES = [
    'funded',
    'budget-under-review',
    'grant-pending',
    'exploring',
    'prefer-not-to-say',
] as const;

const REFERRAL_SOURCES = [
    'web-search',
    'google-ads',
    'referral',
    'linkedin',
    'conference',
    'publication',
    'existing-customer',
    'direct-outreach',
    'other',
] as const;

// ---------------------------------------------------------------------------
// Zod Schema — matches §12.10.3 API format
// ---------------------------------------------------------------------------
// Length caps derive from the shared source of truth (amplify/lib/rfq/limits)
// so client (maxLength + validateField) and server can never drift.
export const rfqSchema = z.object({
    name: z.string().min(L.name.min).max(L.name.max),
    email: z.string().email().max(L.email.max),
    phone: z.string().max(L.phone.max).optional(),
    institution: z.string().min(L.institution.min).max(L.institution.max),
    department: z.string().max(L.department.max).optional(),
    role: z.enum(ROLES).optional(),
    equipmentCategory: z.enum(EQUIPMENT_CATEGORIES),
    specificModel: z.string().max(L.specificModel.max).optional(),
    applicationDescription: z.string().min(L.applicationDescription.min).max(L.applicationDescription.max),
    keySpecifications: z.string().max(L.keySpecifications.max).optional(),
    quantity: z.number().int().positive().default(1),
    budgetRange: z.enum(BUDGET_RANGES).optional(),
    timeline: z.enum(TIMELINES).optional(),
    fundingStatus: z.enum(FUNDING_STATUSES).optional(),
    referralSource: z.enum(REFERRAL_SOURCES).optional(),
    existingEquipment: z.string().max(L.existingEquipment.max).optional(),
    additionalComments: z.string().max(L.additionalComments.max).optional(),
    turnstileToken: z.string().min(1),
    // Browser visitor identity for the VISITOR# bridge (2C-analytics)
    visitorId: z.string().max(L.visitorId.max).optional(),
    // S3 keys from presigned URL uploads (temp/ prefix)
    attachmentKeys: z.array(z.string().max(500)).max(3).optional(),
    // Budgetary quote with shipping address for tax calculation
    needsBudgetaryQuote: z.boolean().optional(),
    shippingAddress: z.string().max(L.shippingAddress.max).optional(),
    shippingCity: z.string().max(L.shippingCity.max).optional(),
    shippingState: z.string().max(L.shippingState.max).optional(),
    shippingZipCode: z.string().max(L.shippingZipCode.max).optional(),
    shippingCountry: z.string().max(L.shippingCountry.max).optional(),
    // Article attribution — silently dropped if invalid (never blocks submission)
    referrerSource: z
        .string()
        .optional()
        .transform((v) => {
            if (!v) return undefined;
            if (v.length > L.referrerSource.max || !/^(insights|news|products)\/[a-z0-9-]+$/.test(v)) {
                console.warn(`Invalid referrerSource ignored: ${v.slice(0, 50)}`);
                return undefined;
            }
            return v;
        }),
}).refine(
    (data) => {
        if (!data.needsBudgetaryQuote) return true;
        return !!(data.shippingAddress?.trim() && data.shippingCity?.trim() &&
                  data.shippingState?.trim() && data.shippingZipCode?.trim());
    },
    { message: 'Shipping address is required for budgetary quote', path: ['shippingAddress'] },
);

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

/** Human-readable labels for equipment category values (used in Request Summary) */
const equipmentCategoryLabels: Record<string, string> = {
    'ICP': 'ICP Etching System',
    'PECVD': 'PECVD System',
    'Sputter': 'Sputter Deposition System',
    'ALD': 'ALD System',
    'RIE': 'RIE System',
    'IBE': 'Ion Beam Etching System',
    'HDP-CVD': 'HDP-CVD System',
    'Plasma-Cleaner': 'Plasma Cleaner',
    'Probe-Station': 'Wafer Probe Station',
    'Other': 'Other / Need Recommendation',
};

/** Short product-family phrase for the greeting line (no trailing "system/systems") */
const equipmentGreetingPhrase: Record<string, string> = {
    'ICP': 'ICP etching',
    'PECVD': 'PECVD',
    'Sputter': 'sputter deposition',
    'ALD': 'ALD',
    'RIE': 'RIE',
    'IBE': 'ion beam etching',
    'HDP-CVD': 'HDP-CVD',
    'Plasma-Cleaner': 'plasma cleaner',
    'Probe-Station': 'wafer probe',
};

/** Send confirmation email to customer via SendGrid — §12.10.9 */
async function sendConfirmationEmail(data: RfqInput, referenceNumber: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping confirmation email');
        return;
    }

    const equipmentLabel = equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory;

    // Build summary rows — only include fields that have values
    const summaryRows = [
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Equipment:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(equipmentLabel)}${data.specificModel ? ' — ' + sanitize(data.specificModel) : ''}</td></tr>`,
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Quantity:</td><td style="padding:6px 0;vertical-align:top;">${data.quantity}</td></tr>`,
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Institution:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.institution)}</td></tr>`,
        data.applicationDescription ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Application:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.applicationDescription.length > 120 ? data.applicationDescription.slice(0, 120) + '…' : data.applicationDescription)}</td></tr>` : '',
        data.keySpecifications ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Key Specs:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.keySpecifications.length > 120 ? data.keySpecifications.slice(0, 120) + '…' : data.keySpecifications)}</td></tr>` : '',
        data.needsBudgetaryQuote && data.shippingCountry ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Shipping Location:</td><td style="padding:6px 0;vertical-align:top;">${[data.shippingState, data.shippingCountry].filter(Boolean).map(s => sanitize(s!)).join(', ')}</td></tr>` : '',
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: data.email }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Sales Team' },
            subject: `Quote Request Received – ${referenceNumber}`,
            content: [{
                type: 'text/html',
                value: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">

<p>Dear ${sanitize(data.name)},</p>

<p>Thank you for your interest in our ${equipmentGreetingPhrase[data.equipmentCategory] ? sanitize(equipmentGreetingPhrase[data.equipmentCategory]) + ' systems' : 'plasma processing systems'}.</p>

<p>Your request has been logged under reference number <strong>${referenceNumber}</strong>. Our sales and technical team will review the submitted requirements and respond with the appropriate recommendation and quotation within 1–2 business days.</p>

<p style="font-weight:600;margin-bottom:8px;">Request Summary</p>
<table style="border-collapse:collapse;font-size:14px;">
${summaryRows}
</table>

<p style="margin-top:20px;">If you need to add any specifications or supporting documents, simply reply to this email or contact us at <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a>. Please reference <strong>${referenceNumber}</strong> in any future communications regarding this request.</p>

<p style="color:#888;font-size:13px;margin-top:20px;">This is an automated acknowledgment of your request. A member of our team will follow up shortly.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0 16px;">
<p style="font-size:13px;color:#666;margin:0;">
  Best regards,<br>
  <strong>NineScrolls Sales Team</strong><br>
  NineScrolls LLC<br>
  <a href="mailto:sales@ninescrolls.com" style="color:#1a73e8;text-decoration:none;">sales@ninescrolls.com</a>
  &nbsp;·&nbsp;
  <a href="https://ninescrolls.com" style="color:#1a73e8;text-decoration:none;">ninescrolls.com</a>
</p>

</div>
                `.trim(),
            }],
            reply_to: { email: 'sales@ninescrolls.com', name: 'NineScrolls Sales Team' },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`SendGrid error ${response.status}: ${errBody}`);
    } else {
        console.log(`Confirmation email sent to ${data.email}`);
    }
}

/** Send internal notification email to sales team via SendGrid */
async function sendInternalNotification(data: RfqInput, rfqId: string, referenceNumber: string, attachmentKeys: string[]): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping internal notification');
        return;
    }

    const timelineLabels: Record<string, string> = {
        'immediate': 'Immediate',
        'within-3-months': 'Within 3 months',
        'within-6-months': 'Within 6 months',
        '6-plus-months': '6+ months',
        'budgetary-planning': 'Budgetary planning',
    };

    const fundingLabels: Record<string, string> = {
        'funded': 'Funded',
        'budget-under-review': 'Budget under review',
        'grant-pending': 'Grant pending',
        'exploring': 'Exploring',
        'prefer-not-to-say': 'Prefer not to say',
    };

    const shippingSection = data.needsBudgetaryQuote ? `
        <h3 style="margin-top:20px;">Shipping Address (Budgetary Quote)</h3>
        <p>${[data.shippingAddress, data.shippingCity, data.shippingState, data.shippingZipCode, data.shippingCountry]
            .filter(Boolean).map(s => sanitize(s!)).join(', ')}</p>
    ` : '';

    const attachmentSection = attachmentKeys.length > 0 ? `
        <h3 style="margin-top:20px;">Attachments (${attachmentKeys.length})</h3>
        <ul>${attachmentKeys.map(k => `<li>${sanitize(k)}</li>`).join('')}</ul>
    ` : '';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: 'sales@ninescrolls.com' }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls RFQ System' },
            reply_to: { email: data.email, name: data.name },
            subject: `New RFQ: ${referenceNumber} — ${equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory} — ${sanitize(data.institution)}`,
            content: [{
                type: 'text/html',
                value: `
<h2>New RFQ Submission</h2>
<p><strong>Reference:</strong> ${referenceNumber} &nbsp;|&nbsp; <strong>ID:</strong> ${rfqId}</p>

<h3>Contact Information</h3>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 8px;font-weight:600;">Name:</td><td style="padding:4px 8px;">${sanitize(data.name)}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Email:</td><td style="padding:4px 8px;"><a href="mailto:${sanitize(data.email)}">${sanitize(data.email)}</a></td></tr>
  ${data.phone ? `<tr><td style="padding:4px 8px;font-weight:600;">Phone:</td><td style="padding:4px 8px;">${sanitize(data.phone)}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Institution:</td><td style="padding:4px 8px;">${sanitize(data.institution)}</td></tr>
  ${data.department ? `<tr><td style="padding:4px 8px;font-weight:600;">Department:</td><td style="padding:4px 8px;">${sanitize(data.department)}</td></tr>` : ''}
  ${data.role ? `<tr><td style="padding:4px 8px;font-weight:600;">Role:</td><td style="padding:4px 8px;">${sanitize(data.role)}</td></tr>` : ''}
</table>

<h3 style="margin-top:20px;">Equipment & Application</h3>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 8px;font-weight:600;">Category:</td><td style="padding:4px 8px;"><strong>${sanitize(equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory)}</strong></td></tr>
  ${data.specificModel ? `<tr><td style="padding:4px 8px;font-weight:600;">Specific Model:</td><td style="padding:4px 8px;">${sanitize(data.specificModel)}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Quantity:</td><td style="padding:4px 8px;">${data.quantity}</td></tr>
  ${data.budgetRange ? `<tr><td style="padding:4px 8px;font-weight:600;">Budget Range:</td><td style="padding:4px 8px;">${sanitize(data.budgetRange)}</td></tr>` : ''}
  ${data.timeline ? `<tr><td style="padding:4px 8px;font-weight:600;">Timeline:</td><td style="padding:4px 8px;">${timelineLabels[data.timeline] ?? data.timeline}</td></tr>` : ''}
  ${data.fundingStatus ? `<tr><td style="padding:4px 8px;font-weight:600;">Funding Status:</td><td style="padding:4px 8px;">${fundingLabels[data.fundingStatus] ?? data.fundingStatus}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Budgetary Quote:</td><td style="padding:4px 8px;">${data.needsBudgetaryQuote ? 'Yes' : 'No'}</td></tr>
</table>

<h3 style="margin-top:20px;">Application Description</h3>
<p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.applicationDescription)}</p>

${data.keySpecifications ? `<h3 style="margin-top:20px;">Key Specifications</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.keySpecifications)}</p>` : ''}

${data.existingEquipment ? `<h3 style="margin-top:20px;">Existing Equipment</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.existingEquipment)}</p>` : ''}

${data.additionalComments ? `<h3 style="margin-top:20px;">Additional Comments</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.additionalComments)}</p>` : ''}

${shippingSection}
${attachmentSection}

<hr style="margin-top:30px;border:none;border-top:1px solid #e0e0e0;">
<p style="color:#666;font-size:12px;">This is an automated notification from the NineScrolls RFQ system. Reply directly to respond to the customer.</p>
                `.trim(),
            }],
            tracking_settings: {
                click_tracking: { enable: false },
                open_tracking: { enable: false },
            },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`SendGrid internal notification error ${response.status}: ${errBody}`);
    } else {
        console.log(`Internal notification sent to sales@ninescrolls.com for ${referenceNumber}`);
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
        const isPrivateIP = (addr: string): boolean => {
            const parts = addr.split('.').map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) return false;
            const [a, b] = parts;
            return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) || a === 127 ||
                (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
        };
        const cfViewerAddr = event.headers?.['CloudFront-Viewer-Address'] || event.headers?.['cloudfront-viewer-address'];
        const xff = event.headers?.['x-forwarded-for'];
        const ip = (() => {
            if (cfViewerAddr) {
                return cfViewerAddr.split(':').slice(0, -1).join(':') || cfViewerAddr;
            }
            if (xff) {
                const ips = xff.split(',').map((s: string) => s.trim());
                return ips.find((addr: string) => !isPrivateIP(addr)) || ips[0];
            }
            return event.requestContext?.http?.sourceIp || '0.0.0.0';
        })();

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

        // 3. Generate IDs
        const rfqId = generateRfqId();
        const referenceNumber = generateReferenceNumber(rfqId);
        const submittedAt = new Date().toISOString();
        const ipHashed = hashIp(ip);

        // 5. Create RFQ_SUBMISSION entity in DynamoDB — §12.10.4
        //    matchedOrgId + GSI2PK are backfilled below after organization-api upsert.
        const normalizedEmail = data.email.trim().toLowerCase();
        const item: Record<string, unknown> = {
            PK: `RFQ#${rfqId}`,
            SK: 'META',
            GSI1PK: 'RFQ_STATUS#pending',
            GSI1SK: `${submittedAt}#${rfqId}`,
            GSI4PK: `EMAIL#${normalizedEmail}`,
            GSI4SK: `RFQ#${submittedAt}`,
            rfqId,
            referenceNumber,
            status: 'pending',
            submittedAt,
            ipHash: ipHashed,
            visitorId: data.visitorId,
            // All form fields (stored raw; sanitize() is applied inline in email templates)
            name: data.name,
            email: data.email,
            phone: data.phone,
            institution: data.institution,
            department: data.department,
            role: data.role,
            equipmentCategory: data.equipmentCategory,
            specificModel: data.specificModel,
            applicationDescription: data.applicationDescription,
            keySpecifications: data.keySpecifications,
            quantity: data.quantity,
            budgetRange: data.budgetRange,
            timeline: data.timeline,
            fundingStatus: data.fundingStatus,
            referralSource: data.referralSource,
            existingEquipment: data.existingEquipment,
            additionalComments: data.additionalComments,
            // Budgetary quote shipping address
            needsBudgetaryQuote: data.needsBudgetaryQuote || false,
            shippingAddress: data.shippingAddress,
            shippingCity: data.shippingCity,
            shippingState: data.shippingState,
            shippingZipCode: data.shippingZipCode,
            shippingCountry: data.shippingCountry,
            TTL: 0, // No expiry
        };

        // Add article attribution if present and valid
        if (data.referrerSource) {
            item.referrerSource = data.referrerSource;
        }

        // Always populate GSI2SK so a later backfill of GSI2PK indexes correctly
        item.GSI2SK = `RFQ#${submittedAt}`;

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: item,
        }));
        console.log(`RFQ_SUBMISSION created: ${rfqId}`);

        // 6. Upsert customer Organization + backfill matchedOrgId/GSI2PK
        let matchedOrgId: string | null = null;
        try {
            const orgResult = await invokeOrganizationApi({
                action: 'upsertFromSubmission',
                source: 'rfq',
                email: data.email,
                institution: data.institution,
                submittedAt,
                scoreDelta: computeRfqScore({
                    fundingStatus: data.fundingStatus,
                    timeline: data.timeline,
                }),
            });
            matchedOrgId = orgResult.matchedOrgId;
        } catch (err) {
            console.error(JSON.stringify({
                event: 'submit-rfq.org-upsert-failed',
                error: String(err),
                rfqId,
            }));
        }

        if (matchedOrgId) {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
                UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
                ExpressionAttributeValues: {
                    ':id': matchedOrgId,
                    ':gsi2': `ORG#${matchedOrgId}`,
                },
            }));
        }

        // 2C-analytics: VISITOR# identity bridge + retro-resolve fire (non-fatal; upgrade-only).
        if (data.visitorId) {
            try {
                const bridge = await upsertVisitorBridge(
                    toSend(docClient), TABLE_NAME(),
                    {
                        visitorId: data.visitorId, matchedOrgId: matchedOrgId ?? null, email: data.email ?? null,
                        sourceEntityType: 'rfq', sourceEntityId: rfqId, now: submittedAt,
                    },
                );
                if (bridge.created || bridge.orgUpgraded) {
                    await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: data.visitorId });
                }
            } catch (err) {
                console.error(JSON.stringify({
                    event: 'crm.visitor_bridge.write_failed',
                    visitorId: data.visitorId,
                    error: err instanceof Error ? err.message : String(err),
                }));
            }
        }

        // Emit rfq_submitted timeline event to CRM (async fire-and-forget;
        // the helper logs/swallows its own dispatch failures — never blocks the response).
        await emitTimelineEventToCrm(buildRfqEmitArgs(
            {
                rfqId,
                submittedAt,
                email: data.email,
                equipmentCategory: data.equipmentCategory,
                specificModel: data.specificModel,
            },
            matchedOrgId ?? null,
        ));

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

        // 9. Send emails (best-effort, non-blocking)
        await Promise.allSettled([
            sendConfirmationEmail(data, referenceNumber),
            sendInternalNotification(data, rfqId, referenceNumber, attachmentKeys),
        ]).then(results => {
            results.forEach((result, i) => {
                const label = i === 0 ? 'Confirmation email' : 'Internal notification';
                if (result.status === 'rejected') {
                    console.warn(`${label} failed (non-critical):`, result.reason);
                }
            });
        });

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
