import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassifyRequest {
    action?: 'classify' | 'override' | 'undo' | 'get-override' | 'list-overrides';
    orgName: string;
    country?: string;
    city?: string;
    isp?: string;
    force?: boolean;
    // Override-specific fields
    isTargetCustomer?: boolean;
    organizationType?: string;
    reason?: string;
    adminToken?: string;
}

interface ClassifyResult {
    organizationType: 'university' | 'research_institute' | 'enterprise' | 'government' | 'hospital' | 'telecom_isp' | 'unknown';
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    cached: boolean;
    source?: 'ai' | 'manual';
    provider?: 'bedrock' | 'anthropic';
    previousClassification?: PreviousClassification;
}

interface PreviousClassification {
    organizationType: string;
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    source: string;
    classifiedAt?: string;
}

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

// ─── DynamoDB Cache ──────────────────────────────────────────────────────────

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrockClient = new BedrockRuntimeClient({});
const TABLE_NAME = process.env.ORG_CLASSIFICATION_TABLE || '';
const CACHE_TTL_DAYS = 7;

interface CachedItem {
    orgName: string;
    organizationType: string;
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    classifiedAt?: string;
    source?: 'ai' | 'manual';
    provider?: 'bedrock' | 'anthropic';
    previousClassification?: PreviousClassification;
    ttl?: number;
}

async function getCachedItem(orgName: string): Promise<CachedItem | null> {
    if (!TABLE_NAME) return null;
    try {
        const result = await ddbClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { orgName },
        }));
        return (result.Item as CachedItem) || null;
    } catch (err) {
        console.error('DynamoDB cache read error:', err);
        return null;
    }
}

async function getCachedClassification(orgName: string): Promise<ClassifyResult | null> {
    const item = await getCachedItem(orgName);
    if (!item) return null;
    return {
        organizationType: item.organizationType as ClassifyResult['organizationType'],
        isTargetCustomer: item.isTargetCustomer,
        confidence: item.confidence,
        reason: item.reason,
        cached: true,
        source: item.source || 'ai',
        provider: item.provider,
        previousClassification: item.previousClassification,
    };
}

async function cacheClassification(orgName: string, result: ClassifyResult): Promise<void> {
    if (!TABLE_NAME) return;
    try {
        const ttl = Math.floor(Date.now() / 1000) + (CACHE_TTL_DAYS * 86400);
        await ddbClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                orgName,
                organizationType: result.organizationType,
                isTargetCustomer: result.isTargetCustomer,
                confidence: result.confidence,
                reason: result.reason,
                classifiedAt: new Date().toISOString(),
                source: 'ai',
                provider: result.provider,
                ttl,
            },
        }));
    } catch (err) {
        console.error('DynamoDB cache write error:', err);
    }
}

// ─── Manual Override Corrections (for AI few-shot learning) ─────────────────

let manualCorrectionsCache: { orgName: string; organizationType: string; isTargetCustomer: boolean; reason: string }[] | null = null;
let manualCorrectionsCacheTime = 0;
const CORRECTIONS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getManualCorrections(): Promise<typeof manualCorrectionsCache> {
    // Return cached if fresh
    if (manualCorrectionsCache && (Date.now() - manualCorrectionsCacheTime) < CORRECTIONS_CACHE_TTL_MS) {
        return manualCorrectionsCache;
    }

    if (!TABLE_NAME) return [];

    try {
        const result = await ddbClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: '#src = :manual',
            ExpressionAttributeNames: { '#src': 'source' },
            ExpressionAttributeValues: { ':manual': 'manual' },
            Limit: 50, // Scan limit (may return fewer due to filter)
        }));

        manualCorrectionsCache = (result.Items || []).slice(0, 20).map((item: Record<string, unknown>) => ({
            orgName: item.orgName as string,
            organizationType: item.organizationType as string,
            isTargetCustomer: item.isTargetCustomer as boolean,
            reason: item.reason as string,
        }));
        manualCorrectionsCacheTime = Date.now();
        return manualCorrectionsCache;
    } catch (err) {
        console.error('Failed to load manual corrections:', err);
        return manualCorrectionsCache || [];
    }
}

// Invalidate corrections cache when a new override is written
function invalidateCorrectionsCache(): void {
    manualCorrectionsCache = null;
    manualCorrectionsCacheTime = 0;
}

// ─── AI Classification ───────────────────────────────────────────────────────

const BEDROCK_TIMEOUT_MS = 5000; // 5-second timeout before falling back to Anthropic API

/** Build the classification prompt (shared by Bedrock and Anthropic API). */
async function buildClassificationPrompt(input: ClassifyRequest): Promise<string> {
    const location = [input.city, input.country].filter(Boolean).join(', ');
    // Strip ASN prefix so the model sees the actual org name
    const cleanOrgName = input.orgName.replace(/^AS\d+\s+/i, '').trim() || input.orgName;

    // Load manual corrections for few-shot learning
    const corrections = await getManualCorrections();
    let correctionsBlock = '';
    if (corrections && corrections.length > 0) {
        const lines = corrections.map(c =>
            `- "${c.orgName}" → ${c.organizationType}, ${c.isTargetCustomer ? 'IS' : 'NOT'} target (${c.reason})`
        ).join('\n');
        correctionsBlock = `\n\nAdmin corrections (use these as ground truth for similar organizations):\n${lines}`;
    }

    return `You are classifying organizations that visit NineScrolls, a scientific equipment company selling advanced research instruments (electron microscopes, spectrometers, nanofabrication tools, etc.) to universities, research labs, and R&D departments.

Given this organization info, classify it:

Organization name: ${cleanOrgName}
Location: ${location || 'Unknown'}
ISP/Network: ${input.isp || 'Unknown'}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "organizationType": "university" | "research_institute" | "enterprise" | "government" | "hospital" | "telecom_isp" | "unknown",
  "isTargetCustomer": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation (max 50 words)"
}

Classification rules:
- "university": Educational institutions (universities, colleges, polytechnics)
- "research_institute": National labs, research centers, academies of science
- "enterprise": ONLY companies that do R&D or manufacturing in fields like semiconductor, biotech, materials science, chemistry, pharma, advanced manufacturing, optics, etc.
- "government": Government agencies
- "hospital": Medical centers, hospitals
- "telecom_isp": Telecom operators, mobile carriers, ISPs, broadband providers, CDNs, cloud/hosting providers, VPN services
- "unknown": Unidentifiable organizations or those not fitting above categories

CRITICAL — these are NEVER target customers (isTargetCustomer = false):
- Names that are just geographic descriptions (e.g. "JINHUA, ZHEJIANG Province, P.R.China.") with no identifiable organization — classify as "unknown".
- Telecom/mobile carriers: China Mobile, China Telecom, China Unicom, AT&T, Verizon, Vodafone, T-Mobile, and ALL regional/provincial branches (e.g. "HeiLongJiang Mobile Communication Company", "Guangdong Unicom")
- Any org name containing: Mobile, Telecom, Communication Company, Broadband, 移动, 联通, 电信
- ISPs and hosting: Comcast, Spectrum, Google Fiber, DigitalOcean, AWS, Azure, Cloudflare, Akamai
- Web crawlers/bots: Google, Bing, Ahrefs, SEMrush

isTargetCustomer = true ONLY if the organization would reasonably purchase scientific research equipment (microscopes, spectrometers, nanofab tools, etc.)${correctionsBlock}`;
}

/** Parse classification JSON from model response text. */
function parseClassificationResponse(text: string, provider: string): ClassifyResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`Failed to parse ${provider} response: ${text.slice(0, 200)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
        organizationType: parsed.organizationType || 'unknown',
        isTargetCustomer: parsed.isTargetCustomer === true,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason || '').slice(0, 200),
        cached: false,
        source: 'ai',
    };
}

/** Classify via AWS Bedrock (same region, lower latency). */
async function classifyWithBedrock(prompt: string): Promise<ClassifyResult> {
    const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

    const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
        })),
    });

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), BEDROCK_TIMEOUT_MS);

    try {
        const response = await bedrockClient.send(command, {
            abortSignal: abortController.signal,
        });
        clearTimeout(timeoutId);

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const text = responseBody.content?.[0]?.text || '';

        return parseClassificationResponse(text, 'Bedrock');
    } finally {
        clearTimeout(timeoutId);
    }
}

/** Classify via Anthropic API (fallback when Bedrock fails). */
async function classifyWithAnthropicAPI(prompt: string): Promise<ClassifyResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return parseClassificationResponse(text, 'Anthropic');
}

/** Orchestrator: try Bedrock first, fall back to Anthropic API. */
async function classifyOrganization(input: ClassifyRequest): Promise<ClassifyResult> {
    const prompt = await buildClassificationPrompt(input);

    // Try Bedrock first (same region, lower latency)
    try {
        const result = await classifyWithBedrock(prompt);
        result.provider = 'bedrock';
        console.log(`Classification via Bedrock: "${input.orgName}" → ${result.organizationType} (${(result.confidence * 100).toFixed(0)}%)`);
        return result;
    } catch (bedrockError) {
        const errMsg = bedrockError instanceof Error ? bedrockError.message : String(bedrockError);
        const isTimeout = errMsg.includes('aborted') || errMsg.includes('AbortError');
        const isAccessDenied = errMsg.includes('AccessDeniedException');
        const isThrottled = errMsg.includes('ThrottlingException');
        const errorType = isTimeout ? 'timeout' : isAccessDenied ? 'access_denied' : isThrottled ? 'throttled' : 'error';
        console.warn(`Bedrock ${errorType} for "${input.orgName}": ${errMsg}. Falling back to Anthropic API.`);
    }

    // Fallback to Anthropic API
    const result = await classifyWithAnthropicAPI(prompt);
    result.provider = 'anthropic';
    console.log(`Classification via Anthropic API (fallback): "${input.orgName}" → ${result.organizationType} (${(result.confidence * 100).toFixed(0)}%)`);
    return result;
}

// ─── Admin Auth ─────────────────────────────────────────────────────────────

function verifyAdminToken(token?: string): boolean {
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret) return false;
    return token === secret;
}

// ─── Override Handlers ──────────────────────────────────────────────────────

async function handleOverride(body: ClassifyRequest, corsHeaders: Record<string, string>) {
    if (!verifyAdminToken(body.adminToken)) {
        return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    if (body.isTargetCustomer === undefined) {
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'isTargetCustomer is required' }),
        };
    }

    // Read current item for previousClassification
    const existing = await getCachedItem(body.orgName);
    const previousClassification: PreviousClassification | undefined = existing ? {
        organizationType: existing.organizationType,
        isTargetCustomer: existing.isTargetCustomer,
        confidence: existing.confidence,
        reason: existing.reason,
        source: existing.source || 'ai',
        classifiedAt: existing.classifiedAt,
    } : undefined;

    const newItem = {
        orgName: body.orgName,
        organizationType: body.organizationType || existing?.organizationType || 'unknown',
        isTargetCustomer: body.isTargetCustomer,
        confidence: 1.0,
        reason: body.reason || `Manually marked as ${body.isTargetCustomer ? 'target' : 'non-target'} by admin`,
        classifiedAt: new Date().toISOString(),
        source: 'manual' as const,
        previousClassification,
        // No TTL — manual entries never expire
    };

    await ddbClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newItem,
    }));

    // Invalidate few-shot corrections cache
    invalidateCorrectionsCache();

    return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...newItem,
            cached: false,
        }),
    };
}

async function handleUndo(body: ClassifyRequest, corsHeaders: Record<string, string>) {
    if (!verifyAdminToken(body.adminToken)) {
        return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    const existing = await getCachedItem(body.orgName);
    if (!existing || existing.source !== 'manual') {
        return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No manual override found' }),
        };
    }

    if (existing.previousClassification) {
        // Restore previous classification with fresh TTL
        const ttl = Math.floor(Date.now() / 1000) + (CACHE_TTL_DAYS * 86400);
        const restored = {
            orgName: body.orgName,
            organizationType: existing.previousClassification.organizationType,
            isTargetCustomer: existing.previousClassification.isTargetCustomer,
            confidence: existing.previousClassification.confidence,
            reason: existing.previousClassification.reason,
            classifiedAt: new Date().toISOString(),
            source: existing.previousClassification.source || 'ai',
            ttl,
        };

        await ddbClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: restored,
        }));

        invalidateCorrectionsCache();

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...restored, cached: false, undone: true }),
        };
    } else {
        // No previous — delete the entry entirely
        await ddbClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { orgName: body.orgName },
        }));

        invalidateCorrectionsCache();

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ undone: true, deleted: true }),
        };
    }
}

async function handleGetOverride(body: ClassifyRequest, corsHeaders: Record<string, string>) {
    if (!verifyAdminToken(body.adminToken)) {
        return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    const item = await getCachedItem(body.orgName);
    if (!item) {
        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ found: false }),
        };
    }

    return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            found: true,
            orgName: item.orgName,
            organizationType: item.organizationType,
            isTargetCustomer: item.isTargetCustomer,
            confidence: item.confidence,
            reason: item.reason,
            source: item.source || 'ai',
            classifiedAt: item.classifiedAt,
            previousClassification: item.previousClassification,
        }),
    };
}

async function handleListOverrides(body: ClassifyRequest, corsHeaders: Record<string, string>) {
    if (!verifyAdminToken(body.adminToken)) {
        return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    if (!TABLE_NAME) {
        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ overrides: [] }),
        };
    }

    try {
        const items: CachedItem[] = [];
        let lastKey: Record<string, unknown> | undefined;

        // Paginated scan for all manual overrides
        do {
            const result = await ddbClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: '#src = :manual',
                ExpressionAttributeNames: { '#src': 'source' },
                ExpressionAttributeValues: { ':manual': 'manual' },
                ExclusiveStartKey: lastKey,
            }));
            if (result.Items) {
                items.push(...(result.Items as CachedItem[]));
            }
            lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
        } while (lastKey);

        const overrides = items.map((item) => ({
            orgName: item.orgName,
            organizationType: item.organizationType,
            isTargetCustomer: item.isTargetCustomer,
            confidence: item.confidence,
            reason: item.reason,
            source: 'manual' as const,
            classifiedAt: item.classifiedAt,
        }));

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ overrides }),
        };
    } catch (err) {
        console.error('Failed to list overrides:', err);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to list overrides' }),
        };
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

    try {
        const body: ClassifyRequest = JSON.parse(event.body || '{}');

        // list-overrides does not require orgName
        if (body.action === 'list-overrides') return handleListOverrides(body, corsHeaders);

        if (!body.orgName || body.orgName.length < 2) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'orgName is required' }),
            };
        }

        // Route by action
        if (body.action === 'override') return handleOverride(body, corsHeaders);
        if (body.action === 'undo') return handleUndo(body, corsHeaders);
        if (body.action === 'get-override') return handleGetOverride(body, corsHeaders);

        // Default: classify flow
        // Check DynamoDB cache first
        const cached = await getCachedClassification(body.orgName);
        if (cached) {
            // Manual entries are ALWAYS returned, even with force=true
            if (cached.source === 'manual') {
                return {
                    statusCode: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(cached),
                };
            }
            // AI cached: return unless force=true
            if (!body.force) {
                return {
                    statusCode: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(cached),
                };
            }
        }

        // Classify: Bedrock first, Anthropic API fallback
        const result = await classifyOrganization(body);

        // Cache result (fire-and-forget)
        cacheClassification(body.orgName, result).catch(console.error);

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        };

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('Classification error:', errMsg, error);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Classification failed', detail: errMsg }),
        };
    }
};
