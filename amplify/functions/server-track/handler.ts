import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

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
        'Access-Control-Allow-Credentials': 'true',
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

// ─── IP lookup (inlined from /geo Lambda) ───────────────────────────────────
// Server-side IP lookup: calls ipinfo.io + ipapi.co in parallel, merges results.
// This eliminates the frontend→/geo→frontend→/d round-trip.

const IP_LOOKUP_TIMEOUT = 7000;

interface IPLookupResult {
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    org?: string;
    isp?: string;
    companyType?: string;
    latitude?: number;
    longitude?: number;
    orgName?: string;
    organizationType?: string;
}

async function fetchWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('IP lookup timeout')), timeout)
        ),
    ]);
}

async function fetchFromIPInfo(ip: string): Promise<Record<string, unknown> | null> {
    try {
        const response = await fetch(`https://ipinfo.io/${ip}/json`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.ip) return null;
        const loc = data.loc ? data.loc.split(',') : [];
        return {
            ip: data.ip, country: data.country, region: data.region,
            city: data.city, org: data.org, isp: data.isp,
            latitude: loc[0] ? parseFloat(loc[0]) : undefined,
            longitude: loc[1] ? parseFloat(loc[1]) : undefined,
            companyType: data.company?.type,
            companyName: data.company?.name,
        };
    } catch { return null; }
}

async function fetchFromIPAPI(ip: string): Promise<Record<string, unknown> | null> {
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.ip) return null;
        return {
            ip: data.ip, country: data.country_name, region: data.region,
            city: data.city, org: data.org, isp: data.org,
            latitude: data.latitude, longitude: data.longitude,
        };
    } catch { return null; }
}

const EDUCATION_KEYWORDS = /\b(university|universidade|universidad|universit[aàe]t|universit[eé]|college|polytechnic)\b/i;
const GOVERNMENT_KEYWORDS = /\b(government|ministry|department of|national lab)\b/i;

async function lookupIP(ip: string): Promise<IPLookupResult> {
    const responses = await Promise.allSettled([
        fetchWithTimeout(fetchFromIPInfo(ip), IP_LOOKUP_TIMEOUT),
        fetchWithTimeout(fetchFromIPAPI(ip), IP_LOOKUP_TIMEOUT),
    ]);

    // Merge: first non-null value per field wins
    const merged: Record<string, unknown> = {};
    for (const r of responses) {
        if (r.status === 'fulfilled' && r.value) {
            for (const [k, v] of Object.entries(r.value)) {
                if (v !== undefined && v !== null && merged[k] === undefined) merged[k] = v;
            }
        }
    }

    // Org type analysis (same logic as /geo Lambda)
    const orgNameRaw = (merged.org as string) || (merged.isp as string) || 'Unknown';
    const orgName = orgNameRaw.replace(/^AS\d+\s+/i, '').trim() || orgNameRaw;
    const companyType = merged.companyType as string | undefined;

    let organizationType = 'unknown';
    if (companyType === 'education') organizationType = 'education';
    else if (companyType === 'business') organizationType = 'business';
    else if (companyType === 'government') organizationType = 'government';
    else if (companyType === 'isp') organizationType = 'isp';
    else if (companyType === 'hosting') organizationType = 'hosting';
    else if (!companyType) {
        if (EDUCATION_KEYWORDS.test(orgName)) organizationType = 'education';
        else if (GOVERNMENT_KEYWORDS.test(orgName)) organizationType = 'government';
    }

    return {
        ip, country: merged.country as string, region: merged.region as string,
        city: merged.city as string, org: merged.org as string,
        isp: merged.isp as string, companyType: companyType,
        latitude: merged.latitude as number, longitude: merged.longitude as number,
        orgName, organizationType,
    };
}

// ─── Classify-org Lambda invocation ─────────────────────────────────────────
// Invokes classify-org Lambda directly for AI classification (no API Gateway hop).

let lambdaClient: LambdaClient | null = null;
function getLambdaClient() {
    if (!lambdaClient) lambdaClient = new LambdaClient({});
    return lambdaClient;
}

// Org types that need AI classification (skip education, government, hosting — already confident)
const AI_CLASSIFY_ORG_TYPES = new Set(['business', 'isp', 'unknown']);

interface AIClassifyResult {
    organizationType: string;
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    provider?: string;
}

async function classifyOrgViaLambda(
    orgName: string, city?: string, country?: string, isp?: string,
): Promise<AIClassifyResult | null> {
    const functionName = process.env.CLASSIFY_ORG_FUNCTION_NAME;
    if (!functionName) {
        console.warn('[PVS] CLASSIFY_ORG_FUNCTION_NAME not set, skipping AI classification');
        return null;
    }

    try {
        // Simulate an API Gateway event for classify-org Lambda
        const event = {
            httpMethod: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgName, city, country, isp }),
            requestContext: { identity: {} },
        };

        const response = await getLambdaClient().send(new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(event),
        }));

        if (response.Payload) {
            const result = JSON.parse(Buffer.from(response.Payload).toString());
            if (result.statusCode === 200) {
                const body = JSON.parse(result.body);
                return {
                    organizationType: body.organizationType,
                    isTargetCustomer: body.isTargetCustomer,
                    confidence: body.confidence,
                    reason: body.reason,
                    provider: body.provider,
                };
            }
        }
        return null;
    } catch (err) {
        console.error('[PVS] classify-org Lambda invocation failed:', err);
        return null;
    }
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
    if (process.env.ENABLE_DDB_WRITE !== 'true') {
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

// ─── page_view_store validation ──────────────────────────────────────────────

function validatePageViewStore(p: Record<string, unknown>): string | null {
    if (typeof p.pageViewId !== 'string' || !p.pageViewId) return 'missing pageViewId';
    if (typeof p.eventName !== 'string' || !p.eventName) return 'missing eventName';
    if (typeof p.eventType !== 'string' || !p.eventType) return 'missing eventType';
    return null;
}

// ─── DynamoDB page_view write ───────────────────────────────────────────────
// Single server-side pipeline: IP lookup → DDB write → AI classification → DDB update.
// Frontend only sends context (pathname, visitorId, behaviorScore).
// IP is extracted from request headers, geo/org data resolved server-side.

interface WritePageViewResult {
    ipData: IPLookupResult | null;
    aiResult: AIClassifyResult | null;
    isTargetCustomer: boolean;
    leadTier?: string;
}

async function writePageView(
    props: Record<string, unknown>,
    userAgent: string,
    visitorIp?: string,
): Promise<WritePageViewResult> {
    const noResult: WritePageViewResult = { ipData: null, aiResult: null, isTargetCustomer: false };
    const tableName = process.env.ANALYTICS_EVENT_TABLE;
    if (!tableName) {
        console.error('[PVS] ANALYTICS_EVENT_TABLE not set');
        return noResult;
    }
    if (process.env.ENABLE_DDB_WRITE !== 'true') {
        console.info('[PVS] DDB write disabled by feature flag');
        return noResult;
    }

    const now = new Date().toISOString();
    const pageViewId = props.pageViewId as string;

    // ── Phase 1: Server-side IP lookup ──────────────────────────────────
    // Use IP from frontend if provided (backward compat), otherwise resolve
    let ipData: IPLookupResult | null = null;
    const ip = (props.ip as string) || visitorIp;
    if (ip && !isPrivateIP(ip)) {
        try {
            ipData = await lookupIP(ip);
            console.info(`[PVS] IP lookup: ${ip} → org="${ipData.orgName}" type=${ipData.organizationType}`);
        } catch (err) {
            console.error('[PVS] IP lookup failed:', err);
        }
    }

    // Merge: server-side IP data takes priority, frontend data as fallback
    const mergedIp = ipData?.ip || ip;
    const mergedCountry = ipData?.country || props.country;
    const mergedRegion = ipData?.region || props.region;
    const mergedCity = ipData?.city || props.city;
    const mergedOrg = ipData?.org || props.org;
    const mergedIsp = ipData?.isp || props.isp;
    const mergedCompanyType = ipData?.companyType || props.companyType;
    const mergedLat = ipData?.latitude || props.latitude;
    const mergedLon = ipData?.longitude || props.longitude;
    const mergedOrgName = ipData?.orgName || props.orgName;
    const mergedOrgType = ipData?.organizationType || props.organizationType;

    // ── Phase 2: Immediate DDB write (with IP data, no AI yet) ──────────
    await getDynamoClient().send(new PutCommand({
        TableName: tableName,
        Item: {
            id: `pv-${pageViewId}`,
            __typename: 'AnalyticsEvent',
            eventName: props.eventName,
            eventType: props.eventType,
            timestamp: (props.timestamp as string) || now,

            visitorId: props.visitorId || undefined,
            pageViewId,

            pathname: props.pathname || undefined,
            pageTitle: props.pageTitle || undefined,
            productId: props.productId || undefined,
            productName: props.productName || undefined,
            referrer: props.referrer || undefined,
            utmTerm: props.utmTerm || undefined,
            searchQuery: props.searchQuery || undefined,

            ip: mergedIp || undefined,
            country: mergedCountry || undefined,
            region: mergedRegion || undefined,
            city: mergedCity || undefined,
            org: mergedOrg || undefined,
            isp: mergedIsp || undefined,
            companyType: typeof mergedCompanyType === 'string' && mergedCompanyType ? mergedCompanyType : undefined,
            latitude: mergedLat || undefined,
            longitude: mergedLon || undefined,

            organizationType: mergedOrgType || undefined,
            orgName: mergedOrgName || undefined,

            behaviorScore: props.behaviorScore || undefined,
            productPagesViewed: props.productPagesViewed || undefined,
            timeOnSite: props.timeOnSite || undefined,
            pdfDownloads: props.pdfDownloads || undefined,
            returnVisits: props.returnVisits || undefined,
            isPaidTraffic: props.isPaidTraffic === true || undefined,
            trafficChannel: props.trafficChannel || undefined,
            formInteractions: props.formInteractions || undefined,
            maxScrollDepth: props.maxScrollDepth || undefined,

            userAgent,
            isBot: props.isBot === true,

            createdAt: now,
            updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(id)',
    }));

    // ── Phase 3: AI classification (if org type warrants it) ────────────
    // Runs after DDB write — even if AI fails, the record already exists.
    let finalAiResult: AIClassifyResult | null = null;
    let finalIsTargetCustomer = false;
    let finalLeadTier: string | undefined;

    // For education/government, target customer is determined by org type alone (no AI needed)
    const CATEGORICAL_TARGET_TYPES = ['education', 'government'];
    if (ipData && CATEGORICAL_TARGET_TYPES.includes(ipData.organizationType ?? '')) {
        finalIsTargetCustomer = true;
        finalLeadTier = 'B';
    }

    if (ipData && ipData.organizationType && AI_CLASSIFY_ORG_TYPES.has(ipData.organizationType) && !props.isBot) {
        try {
            const aiResult = await classifyOrgViaLambda(
                ipData.orgName ?? '', ipData.city, ipData.country, ipData.isp,
            );
            if (aiResult) {
                finalAiResult = aiResult;
                const TARGET_ORG_TYPES = ['education', 'university', 'research_institute', 'government'];
                const NEVER_TARGET_TYPES = ['telecom_isp'];
                const isTargetOrgType = TARGET_ORG_TYPES.includes(aiResult.organizationType);
                const isAITarget = aiResult.isTargetCustomer === true;
                const isNeverTarget = NEVER_TARGET_TYPES.includes(aiResult.organizationType);
                finalIsTargetCustomer = !isNeverTarget && (isTargetOrgType || isAITarget);
                if (finalIsTargetCustomer) {
                    finalLeadTier = (isTargetOrgType || (isAITarget && aiResult.confidence >= 0.5)) ? 'B' : 'C';
                }

                await getDynamoClient().send(new UpdateCommand({
                    TableName: tableName,
                    Key: { id: `pv-${pageViewId}` },
                    UpdateExpression: 'SET #aiOrgType = :aiOrgType, #aiConf = :aiConf, #aiReason = :aiReason, #provider = :provider, #isTgt = :isTgt, #conf = :conf, #orgType = :orgType, #leadTier = :leadTier, #updatedAt = :updatedAt',
                    ExpressionAttributeNames: {
                        '#aiOrgType': 'aiOrganizationType',
                        '#aiConf': 'aiConfidence',
                        '#aiReason': 'aiReason',
                        '#provider': 'provider',
                        '#isTgt': 'isTargetCustomer',
                        '#conf': 'confidence',
                        '#orgType': 'organizationType',
                        '#leadTier': 'leadTier',
                        '#updatedAt': 'updatedAt',
                    },
                    ExpressionAttributeValues: {
                        ':aiOrgType': aiResult.organizationType,
                        ':aiConf': aiResult.confidence,
                        ':aiReason': aiResult.reason,
                        ':provider': aiResult.provider ?? null,
                        ':isTgt': finalIsTargetCustomer,
                        ':conf': aiResult.confidence,
                        ':orgType': aiResult.organizationType,
                        ':leadTier': finalLeadTier ?? null,
                        ':updatedAt': new Date().toISOString(),
                    },
                    ConditionExpression: 'attribute_exists(id)',
                }));
                console.info(`[PVS] AI enrichment complete: pvid=${pageViewId} type=${aiResult.organizationType} target=${finalIsTargetCustomer} provider=${aiResult.provider}`);
            }
        } catch (err) {
            console.error('[PVS] AI classification/enrichment failed (DDB record intact):', err);
        }
    }

    return { ipData, aiResult: finalAiResult, isTargetCustomer: finalIsTargetCustomer, leadTier: finalLeadTier };
}

// ─── ai_enrichment validation ───────────────────────────────────────────────

function validateAIEnrichment(p: Record<string, unknown>): string | null {
    if (typeof p.pageViewId !== 'string' || !p.pageViewId) return 'missing pageViewId';
    // At least one AI field must be present
    if (!p.aiOrganizationType && p.aiConfidence == null) return 'no AI data provided';
    return null;
}

// ─── DynamoDB AI enrichment update ──────────────────────────────────────────
// Updates an existing page_view record with AI classification data.
// Uses ConditionExpression to ensure the record exists; retries once if not.

async function writeAIEnrichment(
    props: Record<string, unknown>,
): Promise<{ updated: boolean; retried?: boolean }> {
    const tableName = process.env.ANALYTICS_EVENT_TABLE;
    if (!tableName) {
        console.error('[AIE] ANALYTICS_EVENT_TABLE not set');
        return { updated: false };
    }
    if (process.env.ENABLE_DDB_WRITE !== 'true') {
        console.info('[AIE] DDB write disabled by feature flag');
        return { updated: false };
    }

    const now = new Date().toISOString();
    const id = `pv-${props.pageViewId}`;

    const doUpdate = () => getDynamoClient().send(new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET #aiOrgType = :aiOrgType, #aiConf = :aiConf, #aiReason = :aiReason, #isTgt = :isTgt, #conf = :conf, #orgType = :orgType, #leadTier = :leadTier, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#aiOrgType': 'aiOrganizationType',
            '#aiConf': 'aiConfidence',
            '#aiReason': 'aiReason',
            '#isTgt': 'isTargetCustomer',
            '#conf': 'confidence',
            '#orgType': 'organizationType',
            '#leadTier': 'leadTier',
            '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
            ':aiOrgType': props.aiOrganizationType ?? null,
            ':aiConf': props.aiConfidence ?? null,
            ':aiReason': props.aiReason ?? null,
            ':isTgt': props.isTargetCustomer === true,
            ':conf': props.confidence ?? null,
            ':orgType': props.organizationType ?? null,
            ':leadTier': props.leadTier ?? null,
            ':updatedAt': now,
        },
        ConditionExpression: 'attribute_exists(id)',
    }));

    try {
        await doUpdate();
        return { updated: true };
    } catch (err) {
        if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
            // Record may not exist yet (initial write in-flight). Retry once after 500ms.
            console.info('[AIE] Record not found, retrying in 500ms:', id);
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
                await doUpdate();
                return { updated: true, retried: true };
            } catch (retryErr) {
                if ((retryErr as { name?: string })?.name === 'ConditionalCheckFailedException') {
                    console.warn('[AIE] Record still not found after retry:', id);
                    return { updated: false, retried: true };
                }
                throw retryErr;
            }
        }
        throw err;
    }
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

        // ─── page_view_store: full server-side pipeline ──────────────────
        // DDB write + IP lookup + AI classification + enriched Segment event.
        // Frontend only sends minimal context; all heavy lifting happens here.
        if (type === 'track' && trackEvent === 'page_view_store' && properties) {
            const validationError = validatePageViewStore(properties);
            if (validationError) {
                console.error(`[PVS] Validation failed: ${validationError}`);
                return {
                    statusCode: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: validationError }),
                };
            }

            try {
                const result = await writePageView(properties, userAgent, visitorIp);
                console.info(`[PVS] OK pvid=${properties.pageViewId} event=${properties.eventName}`);

                // Send enriched Segment page event (replaces frontend sendServerSideEvent + enriched analytics.page)
                const segmentProperties: Record<string, unknown> = {
                    pathname: properties.pathname,
                    pageTitle: properties.pageTitle,
                    referrer: properties.referrer,
                    ...(result.ipData && {
                        ipInfo: {
                            ip: result.ipData.ip, country: result.ipData.country,
                            region: result.ipData.region, city: result.ipData.city,
                            org: result.ipData.org, isp: result.ipData.isp,
                        },
                        organizationType: result.ipData.organizationType,
                        orgName: result.ipData.orgName,
                    }),
                    ...(result.aiResult && {
                        aiOrganizationType: result.aiResult.organizationType,
                        aiConfidence: result.aiResult.confidence,
                        isTargetCustomer: result.isTargetCustomer,
                        leadTier: result.leadTier,
                    }),
                    behaviorScore: properties.behaviorScore,
                };
                const segmentPromises: Promise<{ status: number; body: string }>[] = [
                    sendToSegment({
                        type: 'page',
                        anonymousId: anonymousId || undefined,
                        name: (properties.pathname as string) || '/',
                        properties: segmentProperties,
                        timestamp: new Date().toISOString(),
                        context: { ip: visitorIp, userAgent, library: { name: 'analytics.js', version: '5.2.0' } },
                    }),
                ];

                // Send Target Customer Detected event to Segment (if applicable)
                if (result.isTargetCustomer) {
                    segmentPromises.push(sendToSegment({
                        type: 'track',
                        anonymousId: anonymousId || undefined,
                        event: 'Target Customer Detected',
                        properties: {
                            originalEvent: properties.eventName,
                            organizationType: result.aiResult?.organizationType || result.ipData?.organizationType || 'unknown',
                            orgName: result.ipData?.orgName || 'Unknown',
                            confidence: result.aiResult?.confidence || 0,
                            leadTier: result.leadTier || 'C',
                            behaviorScore: properties.behaviorScore,
                        },
                        timestamp: new Date().toISOString(),
                        context: { ip: visitorIp, userAgent, library: { name: 'analytics.js', version: '5.2.0' } },
                    }));
                }

                const segResults = await Promise.allSettled(segmentPromises);
                const segOk = segResults.every(r => r.status === 'fulfilled' && r.value.status < 400);
                if (!segOk) console.error('[PVS] Segment forwarding failed:', segResults);

                return {
                    statusCode: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: true, segmentForwarded: segOk }),
                };
            } catch (err) {
                const isDuplicate = (err as { name?: string })?.name === 'ConditionalCheckFailedException';
                if (isDuplicate) {
                    console.info('[PVS] Idempotent duplicate ignored:', properties.pageViewId);
                    return {
                        statusCode: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ success: true, duplicate: true }),
                    };
                }
                console.error('[PVS] DDB write failed:', err);
                return {
                    statusCode: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'DDB write failed' }),
                };
            }
        }

        // ─── ai_enrichment: DDB-only update (no Segment forwarding) ─────────
        if (type === 'track' && trackEvent === 'ai_enrichment' && properties) {
            const validationError = validateAIEnrichment(properties);
            if (validationError) {
                console.error(`[AIE] Validation failed: ${validationError}`);
                return {
                    statusCode: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: validationError }),
                };
            }

            try {
                const result = await writeAIEnrichment(properties);
                if (result.updated) {
                    console.info(`[AIE] OK pvid=${properties.pageViewId} retried=${result.retried || false}`);
                } else {
                    console.warn(`[AIE] Not updated pvid=${properties.pageViewId}`);
                }
                return {
                    statusCode: result.updated ? 200 : 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: result.updated, retried: result.retried }),
                };
            } catch (err) {
                console.error('[AIE] DDB update failed:', err);
                return {
                    statusCode: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'DDB update failed' }),
                };
            }
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
