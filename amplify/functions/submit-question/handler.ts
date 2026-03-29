import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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
const TABLE_NAME = () => process.env.ARTICLE_QUESTION_TABLE!;
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

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------
const questionSchema = z.object({
    articleSlug: z.string().min(1).max(200),
    name: z.string().min(2).max(100),
    email: z.string().email().max(254),
    question: z.string().min(10).max(2000),
    turnstileToken: z.string().min(1),
});

type QuestionInput = z.infer<typeof questionSchema>;

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
// Email notification
// ---------------------------------------------------------------------------
async function sendAdminNotification(data: QuestionInput, questionId: string): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping notification email');
        return;
    }

    const articleTitle = data.articleSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: 'sales@ninescrolls.com' }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls' },
            reply_to: { email: data.email, name: data.name },
            subject: `New Q&A Question: ${articleTitle}`,
            content: [{
                type: 'text/html',
                value: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">

<p style="font-weight:600;font-size:16px;margin-bottom:4px;">New Question on Article</p>
<p style="color:#666;margin-top:0;">Article: <strong>${sanitize(data.articleSlug)}</strong></p>

<table style="border-collapse:collapse;font-size:14px;width:100%;">
<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">From:</td><td style="padding:6px 0;">${sanitize(data.name)} (${sanitize(data.email)})</td></tr>
<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Question:</td><td style="padding:6px 0;">${sanitize(data.question)}</td></tr>
<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">ID:</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${questionId}</td></tr>
</table>

<p style="margin-top:20px;">
<a href="https://ninescrolls.com/admin/questions" style="display:inline-block;background:#1e3a5f;color:white;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;">Review & Answer</a>
</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0 16px;">
<p style="font-size:12px;color:#999;">This is an automated notification from NineScrolls Q&A system.</p>

</div>
                `.trim(),
            }],
        }),
    });

    if (!response.ok) {
        console.warn(`SendGrid notification failed: ${response.status} ${await response.text()}`);
    } else {
        console.log(`Admin notification sent for question ${questionId}`);
    }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('submit-question Lambda invoked');

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

        // 1. Validate Turnstile
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

        // 2. Zod validation
        const parseResult = questionSchema.safeParse(rawBody);
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
        const now = new Date().toISOString();
        const questionId = crypto.randomUUID();

        // 3. Write to DynamoDB (Amplify-managed ArticleQuestion table)
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                id: questionId,
                articleSlug: data.articleSlug,
                name: data.name,
                email: data.email,
                question: data.question,
                status: 'pending',
                submittedAt: now,
                createdAt: now,
                updatedAt: now,
                __typename: 'ArticleQuestion',
            },
        }));

        console.log(`Question ${questionId} saved for article ${data.articleSlug}`);

        // 4. Send admin notification (non-blocking)
        try {
            await sendAdminNotification(data, questionId);
        } catch (err) {
            console.warn('Admin notification failed (non-critical):', err);
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Your question has been submitted. We will review and respond soon.',
            }),
        };

    } catch (err) {
        console.error('Unhandled error:', err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error' }),
        };
    }
};
