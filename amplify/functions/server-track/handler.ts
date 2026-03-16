import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

/** Check if an IP is private/reserved (RFC 1918, loopback, link-local, CGNAT). */
function isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;
    const [a, b] = parts;
    return (
        a === 10 ||                          // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) ||          // 192.168.0.0/16
        a === 127 ||                          // 127.0.0.0/8  loopback
        (a === 169 && b === 254) ||          // 169.254.0.0/16 link-local
        (a === 100 && b >= 64 && b <= 127)   // 100.64.0.0/10 CGNAT
    );
}

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
 *
 * ─── page_time_flush contract extension ─────────────────────────────────────
 * When event === 'page_time_flush', this Lambda ALSO writes the flush to
 * DynamoDB as the authoritative store. This is a special-case extension of
 * the Segment proxy, NOT a generic pattern for all track events.
 *
 * The frontend sends page_time_flush via sendBeacon during pagehide, which
 * is reliable during page unload (unlike GraphQL fetch). The Lambda fans out
 * to Segment + DynamoDB in parallel, with DDB as the authoritative path.
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

// ─── DynamoDB: lazy init (only created when page_time_flush arrives) ────────

let docClient: ReturnType<typeof DynamoDBDocumentClient.from> | null = null;
function getDynamoClient() {
    if (!docClient) {
        docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    }
    return docClient;
}

// ─── page_time_flush validation ─────────────────────────────────────────────

const VALID_FLUSH_REASONS = new Set([
    'route_change', 'pagehide', 'hidden', 'heartbeat', 'recovery',
]);
// Note: 'beforeunload' is NOT in this list — frontend normalizes both
// beforeunload and pagehide events to flushReason='pagehide'
// (see SegmentAnalytics.tsx handleUnload).

function validatePageTimeFlush(p: Record<string, unknown>): string | null {
    if (typeof p.pageViewId !== 'string' || !p.pageViewId) return 'missing pageViewId';
    if (typeof p.sessionId !== 'string' || !p.sessionId) return 'missing sessionId';
    if (typeof p.tabId !== 'string' || !p.tabId) return 'missing tabId';
    if (typeof p.path !== 'string') return 'missing path';
    if (p.title != null && typeof p.title !== 'string') return 'invalid title type';
    if (p.visitorId != null && typeof p.visitorId !== 'string') return 'invalid visitorId type';
    if (typeof p.flushSequence !== 'number' || !Number.isInteger(p.flushSequence) || p.flushSequence < 1)
        return 'invalid flushSequence';
    if (typeof p.activeSeconds !== 'number' || p.activeSeconds < 0) return 'invalid activeSeconds';
    if (typeof p.idleSeconds !== 'number' || p.idleSeconds < 0) return 'invalid idleSeconds';
    if (typeof p.hiddenSeconds !== 'number' || p.hiddenSeconds < 0) return 'invalid hiddenSeconds';
    if (typeof p.wallClockSeconds !== 'number' || p.wallClockSeconds < 0) return 'invalid wallClockSeconds';
    if (typeof p.flushReason !== 'string' || !VALID_FLUSH_REASONS.has(p.flushReason)) return 'invalid flushReason';
    if (typeof p.isFinal !== 'boolean') return 'missing isFinal';
    if (typeof p.endedAt !== 'number' || !Number.isFinite(p.endedAt)) return 'invalid endedAt';
    if (typeof p.idleTimeoutMsUsed !== 'number' || p.idleTimeoutMsUsed <= 0) return 'invalid idleTimeoutMsUsed';
    // Invariant: wall clock should cover the sum (1s rounding tolerance)
    const sum = (p.activeSeconds as number) + (p.idleSeconds as number) + (p.hiddenSeconds as number);
    if ((p.wallClockSeconds as number) + 1 < sum) return 'wallClock < sum of parts';
    return null;
}

// ─── DynamoDB authoritative write ───────────────────────────────────────────
// Item shape MUST match storePageTimeFlush() in analyticsStorageService.ts
// (lines 255-281). Both paths produce identical DynamoDB items.

async function writePageTimeFlush(
    props: Record<string, unknown>,
    userAgent: string,
    visitorIp?: string,
): Promise<void> {
    const tableName = process.env.ANALYTICS_EVENT_TABLE;
    if (!tableName) {
        console.error('[PTF] ANALYTICS_EVENT_TABLE not set');
        return;
    }
    if (process.env.ENABLE_PTF_DDB_WRITE !== 'true') {
        console.info('[PTF] DDB write disabled by feature flag');
        return;
    }

    const now = new Date().toISOString();

    await getDynamoClient().send(new PutCommand({
        TableName: tableName,
        Item: {
            id: `ptf-${props.pageViewId}-${props.flushSequence}`,
            __typename: 'AnalyticsEvent',
            eventName: 'Page Time Flush',
            eventType: 'page_time_flush',
            timestamp: new Date(props.endedAt as number).toISOString(),

            visitorId: props.visitorId || undefined,   // from frontend getVisitorId()
            pageViewId: props.pageViewId,
            sessionId: props.sessionId,
            tabId: props.tabId,

            pathname: props.path,                      // matches GraphQL field name
            pageTitle: props.title || undefined,        // matches GraphQL field name

            activeSeconds: props.activeSeconds,
            idleSeconds: props.idleSeconds,
            hiddenSeconds: props.hiddenSeconds,
            wallClockSeconds: props.wallClockSeconds,
            flushReason: props.flushReason,
            isFinal: props.isFinal,
            flushSequence: props.flushSequence,
            idleTimeoutMsUsed: props.idleTimeoutMsUsed,
            maxScrollDepth: typeof props.maxScrollDepth === 'number' && props.maxScrollDepth > 0 ? props.maxScrollDepth : undefined,

            userAgent,
            isBot: props.isBot === true,               // frontend passes isbot() result

            // IP/org/geo enrichment — carried from cached page_view analysis
            ip: (props.ip as string) || visitorIp || undefined,
            country: props.country || undefined,
            region: props.region || undefined,
            city: props.city || undefined,
            org: props.org || undefined,
            isp: props.isp || undefined,
            companyType: typeof props.companyType === 'string' && props.companyType ? props.companyType : undefined,
            latitude: props.latitude || undefined,
            longitude: props.longitude || undefined,
            orgName: props.orgName || undefined,
            organizationType: props.organizationType || undefined,
            isTargetCustomer: props.isTargetCustomer === true || undefined,
            confidence: props.confidence || undefined,

            createdAt: now,
            updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(id)',
    }));
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

        const {
            type, anonymousId, userId, name,
            event: trackEvent, properties, traits, messageId,
            context: clientContext,
        } = body;

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
        // Priority: CloudFront-Viewer-Address > X-Forwarded-For > sourceIp
        const cfViewerAddr = event.headers?.['CloudFront-Viewer-Address'] || event.headers?.['cloudfront-viewer-address'];
        const xForwardedFor = event.headers?.['X-Forwarded-For'] || event.headers?.['x-forwarded-for'];
        const sourceIp = event.requestContext?.identity?.sourceIp;
        const visitorIp = cfViewerAddr
            ? (cfViewerAddr.split(':').slice(0, -1).join(':') || cfViewerAddr)
            : xForwardedFor
                ? (() => { const ips = xForwardedFor.split(',').map((s: string) => s.trim()); return ips.find((ip: string) => !isPrivateIP(ip)) || ips[0]; })()
                : sourceIp;
        const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';

        // Merge frontend browser context with server-side data (IP, userAgent).
        // The frontend collects the same fields analytics.js auto-populates:
        // locale, page, screen, timezone, campaign (UTM params).
        // The server adds: ip and userAgent (only available server-side).
        const context: Record<string, unknown> = {
            ...(clientContext || {}),
            ip: visitorIp,
            userAgent,
            library: {
                name: 'analytics.js',
                version: '5.2.0',
            },
        };

        // Build Segment payload — structure matches analytics.js format
        const payload: SegmentPayload = {
            type,
            anonymousId,
            userId,
            messageId,
            timestamp: new Date().toISOString(),
            context,
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

        // ─── page_time_flush: contract extension of /d Segment proxy ────────
        // Special-case: also writes to DynamoDB as authoritative store.
        // NOT a generic pattern for all track events — only page_time_flush.
        if (type === 'track' && trackEvent === 'page_time_flush' && properties) {
            const validationError = validatePageTimeFlush(properties);
            if (validationError) {
                console.error(`[PTF] Validation failed: ${validationError}`);
                // Still forward to Segment even if DDB validation fails
                const result = await sendToSegment(payload);
                return {
                    statusCode: result.status < 400 ? 200 : 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: result.status < 400, validationError }),
                };
            }

            // Remap Segment event name for backward compatibility with existing reports.
            // DDB stores 'page_time_flush' as eventType; Segment gets 'Time on Page'
            // (matches the event name from sendTimeBeacon in segmentAnalytics.ts).
            const segmentPayload: SegmentPayload = { ...payload, event: 'Time on Page' };

            const [segResult, dbResult] = await Promise.allSettled([
                sendToSegment(segmentPayload),
                writePageTimeFlush(properties, userAgent, visitorIp),
            ]);

            const segOk = segResult.status === 'fulfilled' && segResult.value.status < 400;
            const dbOk = dbResult.status === 'fulfilled';
            const dbDuplicate = dbResult.status === 'rejected' &&
                (dbResult.reason as { name?: string })?.name === 'ConditionalCheckFailedException';

            // Observability logging
            if (!segOk) console.error('[PTF] Segment forwarding failed:', segResult);
            if (!dbOk && !dbDuplicate) console.error('[PTF] DDB write failed:', dbResult);
            if (dbDuplicate) console.info('[PTF] DDB idempotent duplicate ignored');
            if (dbOk) console.info(`[PTF] OK pvid=${properties.pageViewId} seq=${properties.flushSequence} seg=${segOk}`);

            // DDB is authoritative; Segment is supplementary
            const authoritativePersisted = dbOk || dbDuplicate;
            if (!authoritativePersisted && !segOk) {
                return {
                    statusCode: 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Both Segment and DynamoDB failed' }),
                };
            }
            return {
                statusCode: authoritativePersisted ? 200 : 202,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: authoritativePersisted,
                    authoritativePersisted,
                    segmentForwarded: segOk,
                }),
            };
        }

        // ─── All other events: existing Segment-only path ──────────────────
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
