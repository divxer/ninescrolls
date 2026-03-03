import type { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassifyRequest {
    orgName: string;
    country?: string;
    city?: string;
    isp?: string;
}

interface ClassifyResult {
    organizationType: 'university' | 'research_institute' | 'enterprise' | 'government' | 'hospital' | 'unknown';
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
    const prompt = `You are classifying organizations that visit NineScrolls, a scientific equipment company selling advanced research instruments (electron microscopes, spectrometers, nanofabrication tools, etc.) to universities, research labs, and R&D departments.

Given this organization info, classify it:

Organization name: ${input.orgName}
Location: ${location || 'Unknown'}
ISP/Network: ${input.isp || 'Unknown'}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "organizationType": "university" | "research_institute" | "enterprise" | "government" | "hospital" | "unknown",
  "isTargetCustomer": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation (max 50 words)"
}

Rules:
- "university": Educational institutions (universities, colleges, polytechnics)
- "research_institute": National labs, research centers, academies of science
- "enterprise": Companies with R&D/manufacturing that may use scientific equipment
- "government": Government agencies
- "hospital": Medical centers, hospitals
- "unknown": ISPs, telecom, cloud providers, unidentifiable orgs
- isTargetCustomer = true if they might reasonably purchase scientific research equipment
- ISPs, cloud providers, CDNs, and consumer telecom are NOT target customers
- Tech companies ARE potential targets if they do R&D (semiconductor, biotech, materials, etc.)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-20250414',
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

        // Check DynamoDB cache first
        const cached = await getCachedClassification(body.orgName);
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
        console.error('Classification error:', error);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Classification failed' }),
        };
    }
};
