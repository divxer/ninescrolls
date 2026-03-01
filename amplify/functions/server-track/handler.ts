import type { APIGatewayProxyHandler } from 'aws-lambda';

/**
 * Server-side Segment tracking Lambda.
 *
 * Receives page/track events from the frontend and forwards them to
 * Segment's HTTP Tracking API (server-to-server). This guarantees event
 * delivery even when analytics.js is blocked by ad blockers, browser
 * privacy features, or content-based firewalls.
 *
 * Segment deduplicates events by messageId, so if the client-side SDK
 * also sends the same event, only one will be recorded.
 */

const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
const SEGMENT_API = 'https://api.segment.io/v1';

// ─── CORS ────────────────────────────────────────────────────────────────────

const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
];

const getCorsHeaders = (origin?: string) => {
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
};

// ─── Segment HTTP API ────────────────────────────────────────────────────────

interface SegmentPayload {
    type: 'page' | 'track' | 'identify';
    anonymousId?: string;
    userId?: string;
    // page fields
    name?: string;
    properties?: Record<string, unknown>;
    // track fields
    event?: string;
    // identify fields
    traits?: Record<string, unknown>;
    // common
    messageId?: string;
    timestamp?: string;
    context?: Record<string, unknown>;
}

async function sendToSegment(payload: SegmentPayload): Promise<{ status: number; body: string }> {
    const endpoint = `${SEGMENT_API}/${payload.type}`;

    // Segment HTTP API uses Basic Auth: base64(writeKey:)
    const authHeader = 'Basic ' + Buffer.from(`${SEGMENT_WRITE_KEY}:`).toString('base64');

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const body = await response.text();
    return { status: response.status, body };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandler = async (event) => {
    const requestOrigin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(requestOrigin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    if (!SEGMENT_WRITE_KEY) {
        console.error('SEGMENT_WRITE_KEY not configured');
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Server configuration error' }),
        };
    }

    try {
        // Parse request body
        const bodyStr = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64').toString()
            : event.body || '{}';
        const body = JSON.parse(bodyStr);

        const { type, anonymousId, userId, name, event: trackEvent, properties, traits, messageId } = body;

        if (!type || !['page', 'track', 'identify'].includes(type)) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid type. Must be page, track, or identify.' }),
            };
        }

        if (!anonymousId && !userId) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'anonymousId or userId is required.' }),
            };
        }

        // Extract visitor IP and User-Agent from request headers
        const xForwardedFor = event.headers?.['X-Forwarded-For'] || event.headers?.['x-forwarded-for'];
        const sourceIp = event.requestContext?.identity?.sourceIp;
        const visitorIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : sourceIp;
        const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';

        // Build Segment payload with server-side context
        const payload: SegmentPayload = {
            type,
            anonymousId,
            userId,
            messageId,
            timestamp: new Date().toISOString(),
            context: {
                ip: visitorIp,
                userAgent,
                library: {
                    name: 'ninescrolls-server',
                    version: '1.0.0',
                },
                // Pass original page context
                page: properties ? {
                    path: properties.pathname || properties.path,
                    title: properties.title,
                    url: properties.url,
                    search: properties.search,
                    referrer: properties.referrer,
                } : undefined,
            },
        };

        // Set type-specific fields
        if (type === 'page') {
            payload.name = name;
            payload.properties = properties;
        } else if (type === 'track') {
            payload.event = trackEvent;
            payload.properties = properties;
        } else if (type === 'identify') {
            payload.traits = traits;
        }

        // Send to Segment HTTP Tracking API
        const result = await sendToSegment(payload);

        if (result.status >= 400) {
            console.error(`Segment API error: ${result.status} ${result.body}`);
            return {
                statusCode: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Upstream tracking error' }),
            };
        }

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        console.error('Server track error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal error' }),
        };
    }
};
