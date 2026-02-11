import * as sgMail from '@sendgrid/mail';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

type SubscribeRequest = {
    email: string;
    source?: string;
    timestamp?: string;
};

type LegacyHttpEvent = { httpMethod?: string };

const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://ninescrolls.com',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '300',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sync subscriber to SendGrid Marketing Contacts.
 * This is a non-blocking best-effort operation — failures are logged but
 * do not prevent the subscription from succeeding.
 */
async function syncToSendGridContacts(email: string, apiKey: string, source: string): Promise<void> {
    const listId = process.env.SENDGRID_NEWSLETTER_LIST_ID;

    const payload: Record<string, unknown> = {
        contacts: [{ email }],
    };

    // If a specific list ID is configured, add the contact to that list
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
        const errorBody = await response.text();
        throw new Error(`SendGrid Marketing API error ${response.status}: ${errorBody}`);
    }

    console.log(`SendGrid Contacts synced: ${email} (source: ${source})`);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('Subscribe newsletter Lambda invoked');

    const legacyEvent = event as LegacyHttpEvent;
    const method = event.requestContext?.http?.method || legacyEvent.httpMethod;

    // Handle preflight requests (OPTIONS)
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight successful' }),
        };
    }

    try {
        // Parse request body
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Request body is required' }),
            };
        }

        let requestData: Partial<SubscribeRequest>;
        try {
            requestData = JSON.parse(event.body) as Partial<SubscribeRequest>;
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid JSON in request body' }),
            };
        }

        const { email, source = 'unknown', timestamp } = requestData;

        // Validate email
        if (!email || !EMAIL_REGEX.test(email)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'A valid email address is required' }),
            };
        }

        const normalizedEmail = email.trim().toLowerCase();
        const tableName = process.env.NEWSLETTER_SUBSCRIBERS_TABLE;

        if (!tableName) {
            console.error('NEWSLETTER_SUBSCRIBERS_TABLE not configured');
            throw new Error('NEWSLETTER_SUBSCRIBERS_TABLE is not configured');
        }

        // Check if already subscribed
        const existingRecord = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: { email: normalizedEmail },
        }));

        if (existingRecord.Item && existingRecord.Item.status === 'active') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: 'You are already subscribed to our newsletter.',
                    alreadySubscribed: true,
                }),
            };
        }

        // Store subscriber in DynamoDB
        const now = new Date().toISOString();
        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: {
                email: normalizedEmail,
                source,
                status: 'active',
                subscribedAt: timestamp || now,
                updatedAt: now,
            },
        }));

        console.log(`Subscriber stored: ${normalizedEmail}`);

        // Send emails via SendGrid
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            console.error('SendGrid API key is not configured');
            throw new Error('SENDGRID_API_KEY is not configured');
        }
        sgMail.setApiKey(apiKey);

        const safeEmail = escapeHtml(normalizedEmail);

        // Welcome email to subscriber
        const welcomeEmail = {
            to: normalizedEmail,
            from: 'noreply@ninescrolls.com',
            subject: 'Welcome to the NineScrolls Newsletter',
            html: `
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
            `,
        };

        // Notification to company
        const notificationEmail = {
            to: 'info@ninescrolls.com',
            from: 'noreply@ninescrolls.com',
            subject: `New Newsletter Subscriber: ${safeEmail}`,
            html: `
                <h2>New Newsletter Subscription</h2>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Source:</strong> ${escapeHtml(source)}</p>
                <p><strong>Subscribed at:</strong> ${escapeHtml(timestamp || now)}</p>
            `,
        };

        await Promise.all([
            sgMail.send(welcomeEmail).then(() => console.log('Welcome email sent')),
            sgMail.send(notificationEmail).then(() => console.log('Notification email sent')),
        ]);

        // Sync to SendGrid Marketing Contacts (best-effort, non-blocking)
        try {
            await syncToSendGridContacts(normalizedEmail, apiKey, source);
        } catch (syncError) {
            // Log but don't fail — DynamoDB is the source of truth
            console.warn('SendGrid Contacts sync failed (non-critical):', syncError);
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Successfully subscribed to the newsletter!',
                alreadySubscribed: false,
            }),
        };

    } catch (error) {
        console.error('Error in subscribe-newsletter Lambda:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to subscribe. Please try again later.' }),
        };
    }
};
