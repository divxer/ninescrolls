import type { APIGatewayProxyHandler } from 'aws-lambda';

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

// ─── Admin Auth ─────────────────────────────────────────────────────────────

function verifyAdminToken(token?: string): boolean {
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret) return false;
    return token === secret;
}

// ─── Claude API ─────────────────────────────────────────────────────────────

interface GenerateRequest {
    title: string;
    content: string;
    category: string;
    adminToken: string;
}

interface GenerateResult {
    excerpt: string;
    tags: string[];
}

async function generateWithClaude(title: string, content: string, category: string): Promise<GenerateResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Truncate content to ~2000 words to stay within token limits
    const truncated = content.split(/\s+/).slice(0, 2000).join(' ');

    const prompt = `You are a technical content editor for NineScrolls, a scientific equipment company selling advanced research instruments (electron microscopes, spectrometers, nanofabrication tools).

Given this article, generate metadata:

Title: ${title}
Category: ${category}
Content: ${truncated}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "excerpt": "A concise summary for article cards, max 160 characters",
  "tags": ["lowercase", "relevant", "tags", "3-6 items"]
}

Rules:
- excerpt must be under 160 characters, informative, and engaging
- tags should be 3-6 lowercase keywords relevant to the article content
- tags should include technical terms specific to the topic`;

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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`Failed to parse Claude response: ${text}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
        excerpt: String(parsed.excerpt || '').slice(0, 160),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 6) : [],
    };
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandler = async (event) => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        const body: GenerateRequest = JSON.parse(event.body || '{}');

        // Verify admin token
        if (!verifyAdminToken(body.adminToken)) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }

        if (!body.content?.trim()) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Content is required' }),
            };
        }

        const result = await generateWithClaude(
            body.title || '',
            body.content,
            body.category || '',
        );

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result),
        };
    } catch (err) {
        console.error('Generate article meta error:', err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to generate article metadata' }),
        };
    }
};
