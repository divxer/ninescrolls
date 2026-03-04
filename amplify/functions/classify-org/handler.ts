import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassifyRequest {
    orgName: string;
    country?: string;
    city?: string;
    isp?: string;
    force?: boolean;
}

interface ClassifyResult {
    organizationType: 'university' | 'research_institute' | 'enterprise' | 'government' | 'hospital' | 'telecom_isp' | 'unknown';
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    cached: boolean;
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
const TABLE_NAME = process.env.ORG_CLASSIFICATION_TABLE || '';
const CACHE_TTL_DAYS = 30;

async function getCachedClassification(orgName: string): Promise<ClassifyResult | null> {
    if (!TABLE_NAME) return null;
    try {
        const result = await ddbClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { orgName },
        }));
        if (result.Item) {
            return {
                organizationType: result.Item.organizationType,
                isTargetCustomer: result.Item.isTargetCustomer,
                confidence: result.Item.confidence,
                reason: result.Item.reason,
                cached: true,
            };
        }
    } catch (err) {
        console.error('DynamoDB cache read error:', err);
    }
    return null;
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
                ttl,
            },
        }));
    } catch (err) {
        console.error('DynamoDB cache write error:', err);
    }
}

// ─── Claude API ──────────────────────────────────────────────────────────────

async function classifyWithClaude(input: ClassifyRequest): Promise<ClassifyResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const location = [input.city, input.country].filter(Boolean).join(', ');
    // Strip ASN prefix so Claude sees the actual org name
    const cleanOrgName = input.orgName.replace(/^AS\d+\s+/i, '').trim() || input.orgName;
    const prompt = `You are classifying organizations that visit NineScrolls, a scientific equipment company selling advanced research instruments (electron microscopes, spectrometers, nanofabrication tools, etc.) to universities, research labs, and R&D departments.

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

isTargetCustomer = true ONLY if the organization would reasonably purchase scientific research equipment (microscopes, spectrometers, nanofab tools, etc.)`;

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
        throw new Error(`Claude API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`Failed to parse Claude response: ${text}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
        organizationType: parsed.organizationType || 'unknown',
        isTargetCustomer: parsed.isTargetCustomer === true,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason || '').slice(0, 200),
        cached: false,
    };
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

        if (!body.orgName || body.orgName.length < 2) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'orgName is required' }),
            };
        }

        // Check DynamoDB cache first (skip if force=true)
        const cached = body.force ? null : await getCachedClassification(body.orgName);
        if (cached) {
            return {
                statusCode: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(cached),
            };
        }

        // Call Claude API
        const result = await classifyWithClaude(body);

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
