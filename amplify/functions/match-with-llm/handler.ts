import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import type { TenderKeywordConfigItem, TenderMatchItem } from '../../lib/tender-watch/types';
import { tenderItemKey, tenderMatchItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const BEDROCK_MODEL_ID = () => process.env.BEDROCK_MODEL_ID!;
const CLAUDE_MODEL = () => process.env.CLAUDE_MODEL!;
const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY!;

const BEDROCK_TIMEOUT_MS = 8000;
const ANTHROPIC_TIMEOUT_MS = 20000;
const MIN_SCORE = 30;
const DESCRIPTION_MAX_CHARS = 4000;

export interface MatchEvent { tenderId: string; }
export interface MatchResult {
    tenderId: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
    error?: string;
}

interface LlmMatch {
    category: string;
    score: number;
    reasoning: string;
    matchedKeywords: string[];
}

function buildPrompt(
    tender: { title: string; description: string },
    configs: TenderKeywordConfigItem[],
): string {
    const desc = tender.description.length > DESCRIPTION_MAX_CHARS
        ? tender.description.slice(0, DESCRIPTION_MAX_CHARS) + '…'
        : tender.description;
    const catalog = configs.filter((c) => c.isActive).map((c) => ({
        category: c.productCategory,
        productSlugs: c.productSlugs,
    }));
    return [
        'You are scoring how relevant a public procurement tender is to NineScrolls\' product catalog.',
        'NineScrolls sells semiconductor and MEMS fabrication equipment (PECVD, ALD, RIE/ICP etchers, e-beam evaporator, sputter systems, atomic-force microscopes).',
        'Score on a 0–100 scale where 0 means clearly unrelated and 100 means the tender is unambiguously asking for one of these products.',
        '',
        'Output JSON only — an array of objects, one per product category from the catalog. Schema:',
        '[{ "category": string, "score": number 0-100, "reasoning": string, "matchedKeywords": string[] }]',
        '',
        'Reasoning must be in English. Do not include explanations outside the JSON.',
        '',
        'Tender:',
        `  Title: ${tender.title}`,
        `  Description: ${desc}`,
        '',
        'Catalog:',
        JSON.stringify(catalog),
    ].join('\n');
}

/**
 * Parse JSON that may be wrapped in markdown code fences. Claude occasionally
 * outputs `` ```json\n[...]\n``` `` despite the prompt asking for JSON only.
 */
function parseLlmJson(text: string): unknown {
    const trimmed = text.trim();
    // Strip surrounding code fence if present.
    const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
    const payload = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(payload);
}

async function callBedrock(prompt: string): Promise<LlmMatch[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: BEDROCK_MODEL_ID(),
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            }),
        }), { abortSignal: ctrl.signal });
        const text = await (res.body as any).transformToString('utf-8');
        const wrap = JSON.parse(text);
        const inner: string = wrap.content?.[0]?.text ?? '[]';
        return parseLlmJson(inner) as LlmMatch[];
    } finally { clearTimeout(t); }
}

async function callAnthropic(prompt: string): Promise<LlmMatch[]> {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY(), timeout: ANTHROPIC_TIMEOUT_MS });
    const res = await client.messages.create({
        model: CLAUDE_MODEL(),
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = (res.content[0] as any);
    const text: string = block?.text ?? '[]';
    return parseLlmJson(text) as LlmMatch[];
}

export async function handler(event: MatchEvent): Promise<MatchResult> {
    let tender: any;
    let configs: TenderKeywordConfigItem[] = [];

    try {
        const t = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderItemKey(event.tenderId) }));
        tender = t.Item;
        if (!tender) throw new Error(`tender ${event.tenderId} not found`);

        const c = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
        }));
        configs = (c.Items ?? []) as TenderKeywordConfigItem[];
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { tenderId: event.tenderId, matches: [], error: message };
    }

    const prompt = buildPrompt(tender, configs);
    let llmOut: LlmMatch[];
    try {
        llmOut = await callBedrock(prompt);
    } catch (bedrockErr) {
        console.warn(JSON.stringify({ event: 'match.bedrock.fail', tenderId: event.tenderId, error: String(bedrockErr) }));
        try {
            llmOut = await callAnthropic(prompt);
        } catch (anthropicErr) {
            const message = String(anthropicErr);
            console.error(JSON.stringify({ event: 'match.anthropic.fail', tenderId: event.tenderId, error: message }));
            return { tenderId: event.tenderId, matches: [], error: message };
        }
    }

    const matches: MatchResult['matches'] = [];
    const now = new Date().toISOString();
    for (const m of llmOut) {
        if (!m || typeof m.score !== 'number' || m.score < MIN_SCORE) continue;
        const config = configs.find((c) => c.productCategory === m.category);
        if (!config) continue;
        for (const productSlug of config.productSlugs) {
            const item: TenderMatchItem = {
                ...tenderMatchItemKey(event.tenderId, productSlug),
                tenderId: event.tenderId,
                productSlug,
                entityType: 'TENDER_MATCH',
                score: Math.round(m.score),
                reasoning: m.reasoning ?? '',
                matchedKeywords: Array.isArray(m.matchedKeywords) ? m.matchedKeywords : [],
                createdAt: now,
            };
            await ddb.send(new PutCommand({ TableName: TABLE(), Item: item }));
            matches.push({ productSlug, productCategory: m.category, score: item.score });
        }
    }

    console.log(JSON.stringify({ event: 'match.done', tenderId: event.tenderId, matchCount: matches.length }));
    return { tenderId: event.tenderId, matches };
}
