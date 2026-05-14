import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
    tenderItemKey,
    scoreSortToken,
    tenderHighPriorityGsiKey,
} from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const HIGH_PRIORITY_THRESHOLD = 80;

export interface MatchResultInput {
    tenderId: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
}

export interface ClassifyEvent { matchResults: MatchResultInput[]; }
export interface ClassifyResult {
    tendersUpdated: number;
    highPriorityTenderIds: string[];
    digestTenderIds: string[];
}

export async function handler(event: ClassifyEvent): Promise<ClassifyResult> {
    const highPriority: string[] = [];
    const digest: string[] = [];
    let updated = 0;
    const now = new Date().toISOString();

    for (const r of event.matchResults) {
        if (r.matches.length === 0) continue;

        const overallScore = Math.max(...r.matches.map((m) => m.score));
        const isHighPriority = overallScore >= HIGH_PRIORITY_THRESHOLD;

        const t = await ddb.send(new GetCommand({
            TableName: TABLE(),
            Key: tenderItemKey(r.tenderId),
            ProjectionExpression: 'tenderId, #st, postedDate',
            ExpressionAttributeNames: { '#st': 'status' },
        }));
        const tender = t.Item;
        if (!tender) {
            console.warn(JSON.stringify({ event: 'classify.missing', tenderId: r.tenderId }));
            continue;
        }

        const gsi1Sk = `${scoreSortToken(overallScore)}#${tender.postedDate}#${r.tenderId}`;

        const expressionValues: Record<string, unknown> = {
            ':overallScore': overallScore,
            ':isHighPriority': isHighPriority,
            ':updatedAt': now,
            ':gsi1sk': gsi1Sk,
        };
        let setExpr = 'SET overallScore = :overallScore, isHighPriority = :isHighPriority, updatedAt = :updatedAt, GSI1SK = :gsi1sk';
        let removeExpr = '';

        if (isHighPriority) {
            const k = tenderHighPriorityGsiKey(tender.postedDate, r.tenderId);
            expressionValues[':gsi3pk'] = k.GSI3PK;
            expressionValues[':gsi3sk'] = k.GSI3SK;
            setExpr += ', GSI3PK = :gsi3pk, GSI3SK = :gsi3sk';
            highPriority.push(r.tenderId);
        } else {
            removeExpr = ' REMOVE GSI3PK, GSI3SK';
        }

        await ddb.send(new UpdateCommand({
            TableName: TABLE(),
            Key: tenderItemKey(r.tenderId),
            UpdateExpression: setExpr + removeExpr,
            ExpressionAttributeValues: expressionValues,
        }));

        digest.push(r.tenderId);
        updated += 1;
    }

    console.log(JSON.stringify({ event: 'classify.done', updated, highPriority: highPriority.length }));
    return { tendersUpdated: updated, highPriorityTenderIds: highPriority, digestTenderIds: digest };
}
