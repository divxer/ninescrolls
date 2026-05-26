import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';
import { matchesAnyConfig, type MatchableTender } from '../../lib/tender-watch/prefilter';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

export interface PrefilterEvent { newTenderIds: string[]; }
export interface PrefilterCandidate {
    tenderId: string;
    matchedCategories: string[];
    matchedKeywords: string[];
}
export interface PrefilterPerSource {
    candidates: number;
}
export interface PrefilterResult {
    candidates: PrefilterCandidate[];
    candidatesCount: number;  // duplicate of candidates.length so the Step Functions Choice state can read a primitive
    perSource: Record<string, PrefilterPerSource>;
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

interface LoadedTender extends MatchableTender { tenderId: string; source?: string; }

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
    const perSource: Record<string, PrefilterPerSource> = {};
    if (event.newTenderIds.length === 0) {
        return { candidates: [], candidatesCount: 0, perSource };
    }
    const [configs, tenders] = await Promise.all([
        loadActiveConfigs(),
        loadTenders(event.newTenderIds),
    ]);

    const candidates: PrefilterCandidate[] = [];
    for (const t of tenders) {
        const src = t.source ?? 'unknown';
        perSource[src] ??= { candidates: 0 };
        const r = matchesAnyConfig(t, configs);
        if (r.matchedCategories.length > 0) {
            candidates.push({ tenderId: t.tenderId, ...r });
            perSource[src].candidates += 1;
        }
    }

    console.log(JSON.stringify({
        event: 'prefilter.done',
        in: event.newTenderIds.length,
        out: candidates.length,
        configs: configs.length,
        perSource,
    }));
    return { candidates, candidatesCount: candidates.length, perSource };
}
