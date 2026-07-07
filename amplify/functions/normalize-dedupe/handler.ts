import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { NormalizedTender, FetchOutput, TenderItem } from '../../lib/tender-watch/types';
import { toUsd } from '../../lib/tender-watch/types';
import { sourceTenderHash } from '../../lib/tender-watch/hash';
import {
    tenderItemKey,
    tenderStatusGsiKey,
    tenderHashGsiKey,
} from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

export interface NormalizeDedupeEvent {
    executionId: string;
    fetchOutputs: FetchOutput[];
}

export interface NormalizeDedupePerSource {
    fetched: number;
    normalized: number;
    duplicates: number;
}

export interface NormalizeDedupeResult {
    newTenderIds: string[];
    skipped: number;
    perSource: Record<string, NormalizeDedupePerSource>;
}

async function loadStaged(key: string): Promise<NormalizedTender[]> {
    const res = await s3.send(new GetObjectCommand({ Bucket: STAGING_BUCKET(), Key: key }));
    if (!res.Body) return [];
    const text = await res.Body.transformToString('utf-8');
    return JSON.parse(text) as NormalizedTender[];
}

async function hashExists(hash: string): Promise<boolean> {
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
        ExpressionAttributeValues: { ':pk': `TENDER_HASH#${hash}`, ':sk': 'TENDER' },
        Limit: 1,
    }));
    return (res.Items?.length ?? 0) > 0;
}

function buildItem(t: NormalizedTender, hash: string, now: string): TenderItem {
    const tenderId = `${t.source}-${t.externalId}`;
    const status = 'new' as const;
    const overallScore = 0;
    const isHighPriority = false;
    const isExpired = t.deadline ? t.deadline < now.slice(0, 10) : false;
    const usd = toUsd(t.estimatedValue?.amount, t.estimatedValue?.currency);
    return {
        ...tenderItemKey(tenderId),
        ...tenderStatusGsiKey(status, overallScore, t.postedDate, tenderId),
        ...tenderHashGsiKey(hash),
        tenderId,
        entityType: 'TENDER',
        source: t.source,
        sourceUrl: t.url,
        sourceTenderHash: hash,
        title: t.title,
        agency: t.agency,
        country: t.country,
        language: t.language,
        description: t.description,
        estimatedValueUSD: usd,
        estimatedValueOriginal: t.estimatedValue ? `${t.estimatedValue.currency} ${t.estimatedValue.amount}` : null,
        postedDate: t.postedDate,
        deadline: t.deadline ?? null,
        naicsCodes: t.naicsCodes,
        cpvCodes: t.cpvCodes,
        rawPayload: t.rawPayload,
        overallScore,
        isHighPriority,
        isExpired,
        status,
        statusNote: null,
        assignedTo: null,
        lastStatusChangedAt: null,
        createdAt: now,
        updatedAt: now,
    };
}

export async function handler(event: NormalizeDedupeEvent): Promise<NormalizeDedupeResult> {
    const now = new Date().toISOString();
    const newTenderIds: string[] = [];
    let skipped = 0;
    const perSource: Record<string, NormalizeDedupePerSource> = {};

    for (const fo of event.fetchOutputs) {
        const src = fo.source;
        perSource[src] ??= { fetched: 0, normalized: 0, duplicates: 0 };
        perSource[src].fetched += fo.fetched;
        if (fo.fetched <= 0 || !fo.stagedKey) continue;
        const tenders = await loadStaged(fo.stagedKey);
        for (const t of tenders) {
            const hash = sourceTenderHash({
                title: t.title,
                agency: t.agency,
                deadline: t.deadline,
            });
            if (await hashExists(hash)) {
                skipped += 1;
                perSource[src].duplicates += 1;
                continue;
            }
            const item = buildItem(t, hash, now);
            try {
                await ddb.send(new PutCommand({
                    TableName: TABLE(),
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(PK)',
                }));
                newTenderIds.push(item.tenderId);
                perSource[src].normalized += 1;
            } catch (err) {
                if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
                    skipped += 1;
                    perSource[src].duplicates += 1;
                } else {
                    throw err;
                }
            }
        }
    }

    console.log(JSON.stringify({ event: 'normalize-dedupe.done', newTenderIds: newTenderIds.length, skipped, perSource }));
    return { newTenderIds, skipped, perSource };
}
