import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

export interface PrefilterEvent { newTenderIds: string[]; }
export interface PrefilterCandidate {
    tenderId: string;
    matchedCategories: string[];
    matchedKeywords: string[];
}
export interface PrefilterResult {
    candidates: PrefilterCandidate[];
    candidatesCount: number;  // duplicate of candidates.length so the Step Functions Choice state can read a primitive
}

interface MatchableTender {
    title: string;
    description: string;
    naicsCodes: string[];
    cpvCodes: string[];
}

/** Exported for reuse by Phase 2 admin `runPrefilterPreview` mutation. */
export function matchesAnyConfig(
    t: MatchableTender,
    configs: TenderKeywordConfigItem[],
): { matchedCategories: string[]; matchedKeywords: string[] } {
    const haystack = `${t.title}\n${t.description}`.toLowerCase();
    const matchedCategories: string[] = [];
    const matchedKeywords = new Set<string>();

    for (const c of configs) {
        if (!c.isActive) continue;
        // Blacklist: any blacklist term in haystack -> reject this category
        if (c.blacklist.some((b) => haystack.includes(b.toLowerCase()))) continue;
        // Keyword/synonym match
        const terms = [...c.keywords, ...c.synonyms];
        const hits = terms.filter((term) => haystack.includes(term.toLowerCase()));
        if (hits.length === 0) continue;
        // Optional code whitelist: if both code arrays in the config are non-empty AND the tender
        // has no overlap with either, reject. (Empty config arrays = no code restriction.)
        const hasNaics = c.naicsCodes.length > 0;
        const hasCpv = c.cpvCodes.length > 0;
        if (hasNaics || hasCpv) {
            const naicsHit = t.naicsCodes.some((n) => c.naicsCodes.includes(n));
            const cpvHit = t.cpvCodes.some((c2) => c.cpvCodes.includes(c2));
            if (!naicsHit && !cpvHit) continue;
        }
        matchedCategories.push(c.productCategory);
        hits.forEach((h) => matchedKeywords.add(h));
    }
    return { matchedCategories, matchedKeywords: [...matchedKeywords] };
}

async function loadActiveConfigs(): Promise<TenderKeywordConfigItem[]> {
    const out: TenderKeywordConfigItem[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
        const res = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
            ExclusiveStartKey: cursor,
        }));
        for (const it of (res.Items ?? [])) out.push(it as TenderKeywordConfigItem);
        cursor = res.LastEvaluatedKey;
    } while (cursor);
    return out;
}

interface LoadedTender extends MatchableTender { tenderId: string; }

async function loadTenders(tenderIds: string[]): Promise<LoadedTender[]> {
    if (tenderIds.length === 0) return [];
    const out: LoadedTender[] = [];
    for (let i = 0; i < tenderIds.length; i += 100) {
        const batch = tenderIds.slice(i, i + 100);
        const res = await ddb.send(new BatchGetCommand({
            RequestItems: {
                [TABLE()]: { Keys: batch.map((id) => tenderItemKey(id)) },
            },
        }));
        for (const it of (res.Responses?.[TABLE()] ?? [])) out.push(it as LoadedTender);
    }
    return out;
}

export async function handler(event: PrefilterEvent): Promise<PrefilterResult> {
    if (event.newTenderIds.length === 0) {
        return { candidates: [], candidatesCount: 0 };
    }
    const [configs, tenders] = await Promise.all([
        loadActiveConfigs(),
        loadTenders(event.newTenderIds),
    ]);

    const candidates: PrefilterCandidate[] = [];
    for (const t of tenders) {
        const r = matchesAnyConfig(t, configs);
        if (r.matchedCategories.length > 0) {
            candidates.push({ tenderId: t.tenderId, ...r });
        }
    }

    console.log(JSON.stringify({
        event: 'prefilter.done',
        in: event.newTenderIds.length,
        out: candidates.length,
        configs: configs.length,
    }));
    return { candidates, candidatesCount: candidates.length };
}
