import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
const NEWSLETTER_TABLE = () => process.env.NEWSLETTER_SUBSCRIBERS_TABLE!;
const TURNSTILE_SECRET = () => process.env.TURNSTILE_SECRET_KEY!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;
const HUBSPOT_TOKEN = () => process.env.HUBSPOT_ACCESS_TOKEN;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'http://localhost:5173',
];

const LEAD_TYPES = ['contact', 'download_gate', 'newsletter'] as const;

const INTENTS = [
    'Actively looking to buy',
    'Looking to buy within 1 year',
    'Investigating technologies for my application',
    'Expanding my knowledge',
] as const;

// ---------------------------------------------------------------------------
// Zod Schemas — discriminated union by `type`
// ---------------------------------------------------------------------------
const contactSchema = z.object({
    type: z.literal('contact'),
    name: z.string().min(2).max(100),
    email: z.string().email().max(254),
    phone: z.string().max(30).optional(),
    organization: z.string().max(200).optional(),
    message: z.string().min(1).max(5000),
    productName: z.string().max(200).optional(),
    inquiryType: z.string().max(50).optional(),
    topic: z.string().max(50).optional(),
    turnstileToken: z.string().optional(),
    visitorId: z.string().max(100).optional(),
});

const downloadGateSchema = z.object({
    type: z.literal('download_gate'),
    fullName: z.string().min(1).max(100),
    email: z.string().email().max(254),
    organization: z.string().min(1).max(200),
    researchAreas: z.string().min(1).max(500),
    jobTitle: z.string().max(100).optional(),
    intent: z.enum(INTENTS),
    fileName: z.string().max(500).optional(),
    fileUrl: z.string().max(1000).optional(),
    marketingOptIn: z.boolean().default(false),
    turnstileToken: z.string().optional(),
    visitorId: z.string().max(100).optional(),
});

const newsletterSchema = z.object({
    type: z.literal('newsletter'),
    email: z.string().email().max(254),
    source: z.string().max(50).optional(),
    visitorId: z.string().max(100).optional(),
});

const leadSchema = z.discriminatedUnion('type', [
    contactSchema,
    downloadGateSchema,
    newsletterSchema,
]);

type LeadInput = z.infer<typeof leadSchema>;

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

function generateLeadId(type: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(4).toString('hex');
    return `lead-${type.replace('_', '')}-${date}-${rand}`;
}

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
}

function extractIp(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
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
    if (cfViewerAddr) {
        return cfViewerAddr.split(':').slice(0, -1).join(':') || cfViewerAddr;
    }
    if (xff) {
        const ips = xff.split(',').map((s: string) => s.trim());
        return ips.find((addr: string) => !isPrivateIP(addr)) || ips[0];
    }
    return event.requestContext?.http?.sourceIp || '0.0.0.0';
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
        body: new URLSearchParams({ secret, response: token }),
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    if (!result.success) {
        console.error('Turnstile verification failed:', JSON.stringify(result));
    }
    return result.success;
}

// ---------------------------------------------------------------------------
// HubSpot — create or update contact
// ---------------------------------------------------------------------------
async function pushToHubSpot(data: LeadInput, leadId: string): Promise<void> {
    const token = HUBSPOT_TOKEN();
    if (!token) {
        console.warn('HUBSPOT_ACCESS_TOKEN not configured, skipping HubSpot push');
        return;
    }

    const properties: Record<string, string> = {
        email: data.email,
        lead_source: `website_${data.type}`,
    };

    if (data.type === 'contact') {
        properties.firstname = data.name.split(' ')[0];
        properties.lastname = data.name.split(' ').slice(1).join(' ') || '';
        if (data.phone) properties.phone = data.phone;
        if (data.organization) properties.company = data.organization;
        properties.lead_type = data.inquiryType || 'general';
    } else if (data.type === 'download_gate') {
        properties.firstname = data.fullName.split(' ')[0];
        properties.lastname = data.fullName.split(' ').slice(1).join(' ') || '';
        properties.company = data.organization;
        if (data.jobTitle) properties.jobtitle = data.jobTitle;
        properties.lead_type = 'download_gate';
        properties.lead_intent = data.intent;
    } else if (data.type === 'newsletter') {
        properties.lead_type = 'newsletter';
    }

    // Use HubSpot Contacts API v3 — create or update by email
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
    });

    if (response.status === 409) {
        // Contact exists — update instead
        const conflictBody = await response.json() as { message?: string };
        const existingIdMatch = conflictBody.message?.match(/ID:\s*(\d+)/);
        if (existingIdMatch) {
            const contactId = existingIdMatch[1];
            const updateResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            });
            if (!updateResponse.ok) {
                const errBody = await updateResponse.text();
                console.error(`HubSpot contact update error ${updateResponse.status}: ${errBody}`);
            } else {
                console.log(`HubSpot contact updated: ${contactId} for lead ${leadId}`);
            }
        }
    } else if (!response.ok) {
        const errBody = await response.text();
        console.error(`HubSpot contact create error ${response.status}: ${errBody}`);
    } else {
        const body = await response.json() as { id?: string };
        console.log(`HubSpot contact created: ${body.id} for lead ${leadId}`);
    }
}

// ---------------------------------------------------------------------------
// DynamoDB — store lead in NineScrollsIntelligence table
// ---------------------------------------------------------------------------
async function storeLead(data: LeadInput, leadId: string, ipHash: string): Promise<void> {
    const submittedAt = new Date().toISOString();

    const normalizedEmail = data.email.trim().toLowerCase();
    const item: Record<string, unknown> = {
        PK: `LEAD#${leadId}`,
        SK: 'META',
        GSI1PK: `LEAD_TYPE#${data.type}`,
        GSI1SK: `${submittedAt}#${leadId}`,
        GSI4PK: `EMAIL#${normalizedEmail}`,
        GSI4SK: `LEAD#${submittedAt}`,
        leadId,
        type: data.type,
        email: data.email,
        submittedAt,
        ipHash,
        visitorId: data.visitorId,
        TTL: 0,
    };

    if (data.type === 'contact') {
        item.name = data.name;
        item.phone = data.phone;
        item.organization = data.organization;
        item.message = data.message;
        item.productName = data.productName;
        item.inquiryType = data.inquiryType;
        item.topic = data.topic;
    } else if (data.type === 'download_gate') {
        item.name = data.fullName;
        item.organization = data.organization;
        item.researchAreas = data.researchAreas;
        item.jobTitle = data.jobTitle;
        item.intent = data.intent;
        item.fileName = data.fileName;
        item.fileUrl = data.fileUrl;
        item.marketingOptIn = data.marketingOptIn;
    } else if (data.type === 'newsletter') {
        item.source = data.source;
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: item,
    }));

    console.log(`Lead stored: ${leadId} (type: ${data.type})`);
}

// ---------------------------------------------------------------------------
// Newsletter — dedup check + store in NewsletterSubscribers table
// ---------------------------------------------------------------------------
async function handleNewsletterDedup(email: string, source: string): Promise<{ alreadySubscribed: boolean }> {
    const tableName = NEWSLETTER_TABLE();
    if (!tableName) {
        console.warn('NEWSLETTER_SUBSCRIBERS_TABLE not configured');
        return { alreadySubscribed: false };
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { email: normalizedEmail },
    }));

    if (existing.Item && existing.Item.status === 'active') {
        return { alreadySubscribed: true };
    }

    const now = new Date().toISOString();
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
            email: normalizedEmail,
            source,
            status: 'active',
            subscribedAt: now,
            updatedAt: now,
        },
    }));

    return { alreadySubscribed: false };
}

// ---------------------------------------------------------------------------
// SendGrid — sync to Marketing Contacts
// ---------------------------------------------------------------------------
async function syncToSendGridContacts(email: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) return;

    const listId = process.env.SENDGRID_NEWSLETTER_LIST_ID;
    const payload: Record<string, unknown> = {
        contacts: [{ email: email.trim().toLowerCase() }],
    };
    if (listId) {
        payload.list_ids = [listId];
    }

    const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`SendGrid Marketing API error ${response.status}: ${errBody}`);
    }

    console.log(`SendGrid Contacts synced: ${email}`);
}

// ---------------------------------------------------------------------------
// SendGrid — email notifications
// ---------------------------------------------------------------------------
async function sendContactEmails(data: Extract<LeadInput, { type: 'contact' }>, leadId: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping emails');
        return;
    }

    const safeName = sanitize(data.name);
    const safeEmail = sanitize(data.email);
    const safeProduct = sanitize(data.productName || 'General Inquiry');
    const safeMessage = sanitize(data.message).replace(/\n/g, '<br>');
    const safePhone = data.phone ? sanitize(data.phone) : 'Not provided';
    const safeOrg = data.organization ? sanitize(data.organization) : 'Not provided';

    const internalEmail = {
        personalizations: [{ to: [{ email: 'info@ninescrolls.com' }] }],
        from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Contact System' },
        reply_to: { email: data.email, name: data.name },
        subject: `New Contact: ${safeProduct} — ${safeName}`,
        content: [{
            type: 'text/html',
            value: `
<h2>New Contact Form Submission</h2>
<p><strong>Lead ID:</strong> ${leadId}</p>
<table style="border-collapse:collapse;font-size:14px;">
  <tr><td style="padding:4px 8px;font-weight:600;">Name:</td><td style="padding:4px 8px;">${safeName}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Email:</td><td style="padding:4px 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Phone:</td><td style="padding:4px 8px;">${safePhone}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Organization:</td><td style="padding:4px 8px;">${safeOrg}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Product:</td><td style="padding:4px 8px;">${safeProduct}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Inquiry Type:</td><td style="padding:4px 8px;">${sanitize(data.inquiryType || 'general')}</td></tr>
</table>
<h3>Message</h3>
<p style="background:#f8f9fa;padding:12px;border-radius:4px;">${safeMessage}</p>
<hr style="margin-top:30px;border:none;border-top:1px solid #e0e0e0;">
<p style="color:#666;font-size:12px;">Reply directly to respond to the customer.</p>
            `.trim(),
        }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
    };

    const confirmEmail = {
        personalizations: [{ to: [{ email: data.email }] }],
        from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls LLC' },
        reply_to: { email: 'info@ninescrolls.com', name: 'NineScrolls LLC' },
        subject: `Thank you for your interest in ${safeProduct}`,
        content: [{
            type: 'text/html',
            value: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
<p>Dear ${safeName},</p>
<p>We have received your inquiry about ${safeProduct}. Our team will review your request and get back to you within 1–2 business days.</p>
<p>Here's a summary of your inquiry:</p>
<ul><li><strong>Subject:</strong> ${safeProduct}</li><li><strong>Your Message:</strong> ${safeMessage}</li></ul>
<p>If you have any immediate questions, please don't hesitate to call us at +1 (858) 879-8898.</p>
<br>
<p>Best regards,</p>
<p>The NineScrolls LLC Team</p>
</div>
            `.trim(),
        }],
    };

    await Promise.allSettled([
        sendViaSendGrid(apiKey, internalEmail),
        sendViaSendGrid(apiKey, confirmEmail),
    ]).then(logEmailResults);
}

async function sendDownloadGateEmails(data: Extract<LeadInput, { type: 'download_gate' }>, leadId: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) return;

    const safeName = sanitize(data.fullName);
    const safeEmail = sanitize(data.email);
    const safeOrg = sanitize(data.organization);
    const safeAreas = sanitize(data.researchAreas);
    const safeIntent = sanitize(data.intent);

    const internalEmail = {
        personalizations: [{ to: [{ email: 'info@ninescrolls.com' }] }],
        from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Lead System' },
        reply_to: { email: data.email, name: data.fullName },
        subject: `New Download Lead: ${safeName} — ${safeOrg}`,
        content: [{
            type: 'text/html',
            value: `
<h2>New Download Gate Lead</h2>
<p><strong>Lead ID:</strong> ${leadId}</p>
<table style="border-collapse:collapse;font-size:14px;">
  <tr><td style="padding:4px 8px;font-weight:600;">Name:</td><td style="padding:4px 8px;">${safeName}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Email:</td><td style="padding:4px 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Organization:</td><td style="padding:4px 8px;">${safeOrg}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Research Areas:</td><td style="padding:4px 8px;">${safeAreas}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Job Title:</td><td style="padding:4px 8px;">${data.jobTitle ? sanitize(data.jobTitle) : 'Not provided'}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Intent:</td><td style="padding:4px 8px;"><strong>${safeIntent}</strong></td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Marketing Opt-in:</td><td style="padding:4px 8px;">${data.marketingOptIn ? 'Yes' : 'No'}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Document:</td><td style="padding:4px 8px;">${data.fileName ? sanitize(data.fileName) : 'N/A'}</td></tr>
</table>
<hr style="margin-top:30px;border:none;border-top:1px solid #e0e0e0;">
<p style="color:#666;font-size:12px;">Reply directly to follow up with this lead.</p>
            `.trim(),
        }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
    };

    await sendViaSendGrid(apiKey, internalEmail);
}

async function sendNewsletterEmails(email: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) return;

    const safeEmail = sanitize(email);

    const welcomeEmail = {
        personalizations: [{ to: [{ email }] }],
        from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls LLC' },
        subject: 'Welcome to the NineScrolls Newsletter',
        content: [{
            type: 'text/html',
            value: `
<h2>Welcome to the NineScrolls Newsletter!</h2>
<p>Thank you for subscribing. You'll receive our latest insights on plasma etching, thin-film deposition, and semiconductor research equipment.</p>
<p><strong>What to expect:</strong></p>
<ul>
  <li>Technical guides and application notes</li>
  <li>Product updates and new releases</li>
  <li>Industry trends and research highlights</li>
</ul>
<p>We send 1-2 emails per month and respect your inbox.</p>
<br>
<p>Best regards,</p>
<p>The NineScrolls Team</p>
<hr>
<p style="font-size:12px;color:#999;">If you didn't subscribe, please ignore this email or contact us at info@ninescrolls.com.</p>
            `.trim(),
        }],
    };

    const notifEmail = {
        personalizations: [{ to: [{ email: 'info@ninescrolls.com' }] }],
        from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Lead System' },
        subject: `New Newsletter Subscriber: ${safeEmail}`,
        content: [{
            type: 'text/html',
            value: `
<h2>New Newsletter Subscription</h2>
<p><strong>Email:</strong> ${safeEmail}</p>
<p><strong>Subscribed at:</strong> ${new Date().toISOString()}</p>
            `.trim(),
        }],
    };

    await Promise.allSettled([
        sendViaSendGrid(apiKey, welcomeEmail),
        sendViaSendGrid(apiKey, notifEmail),
    ]).then(logEmailResults);
}

async function sendViaSendGrid(apiKey: string, payload: Record<string, unknown>): Promise<void> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`SendGrid error ${response.status}: ${errBody}`);
    }
}

function logEmailResults(results: PromiseSettledResult<void>[]): void {
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.warn(`Email ${i} failed (non-critical):`, result.reason);
        }
    });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('submit-lead Lambda invoked');

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

        // 1. Schema validation
        const parseResult = leadSchema.safeParse(rawBody);
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

        // 2. Turnstile CAPTCHA (optional per type)
        if ('turnstileToken' in data && data.turnstileToken) {
            const valid = await verifyTurnstile(data.turnstileToken);
            if (!valid) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'CAPTCHA verification failed' }),
                };
            }
        }

        // 3. Generate IDs + extract IP
        const ip = extractIp(event);
        const ipHash = hashIp(ip);
        const leadId = generateLeadId(data.type);

        // 4. Type-specific handling
        let responsePayload: Record<string, unknown> = { success: true, leadId };

        if (data.type === 'newsletter') {
            const { alreadySubscribed } = await handleNewsletterDedup(data.email, data.source || 'website');
            if (alreadySubscribed) {
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        message: 'You are already subscribed to our newsletter.',
                        alreadySubscribed: true,
                    }),
                };
            }
            responsePayload.alreadySubscribed = false;
            responsePayload.message = 'Successfully subscribed to the newsletter!';
        } else if (data.type === 'contact') {
            responsePayload.message = "Thank you. We'll respond within 1-2 business days.";
        } else if (data.type === 'download_gate') {
            responsePayload.message = 'Thank you for your interest.';
        }

        // 5. Store lead in DynamoDB (all types)
        await storeLead(data, leadId, ipHash);

        // 6. Non-blocking side effects: emails, HubSpot, SendGrid contacts
        const sideEffects: Promise<void>[] = [
            pushToHubSpot(data, leadId).catch(err => console.warn('HubSpot push failed (non-critical):', err)),
        ];

        if (data.type === 'contact') {
            sideEffects.push(sendContactEmails(data, leadId));
        } else if (data.type === 'download_gate') {
            sideEffects.push(sendDownloadGateEmails(data, leadId));
            if (data.marketingOptIn) {
                sideEffects.push(
                    syncToSendGridContacts(data.email).catch(err => console.warn('SendGrid sync failed:', err)),
                );
            }
        } else if (data.type === 'newsletter') {
            sideEffects.push(sendNewsletterEmails(data.email));
            sideEffects.push(
                syncToSendGridContacts(data.email).catch(err => console.warn('SendGrid sync failed:', err)),
            );
        }

        await Promise.allSettled(sideEffects);

        // 7. Return success
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        console.error('Error in submit-lead Lambda:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error. Please try again later.' }),
        };
    }
};
