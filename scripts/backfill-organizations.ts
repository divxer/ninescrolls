#!/usr/bin/env tsx
/**
 * One-time idempotent backfill: create Organization entities from historical
 * RFQ/Order/Lead data and stamp matchedOrgId + GSI2PK on source items.
 *
 * Usage:
 *   INTELLIGENCE_TABLE=<table-name> ORGANIZATION_API_FUNCTION_NAME=<fn> \
 *     tsx scripts/backfill-organizations.ts [--dry-run] [--classify-only]
 *
 * --dry-run        Print planned writes; do not execute.
 * --classify-only  Skip Org creation; only trigger classifyOrg for existing
 *                  Orgs that have aiClassifiedAt missing.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { classifyEmailDomain } from '../amplify/lib/organization/etld';
import {
    computeRfqScore,
    computeLeadScore,
    computeOrderScore,
} from '../amplify/lib/organization/lead-score';
import { LEAD_SCORE_THRESHOLD } from '../amplify/lib/organization/constants';

const TABLE = process.env.INTELLIGENCE_TABLE!;
const ORG_API_FUNC = process.env.ORGANIZATION_API_FUNCTION_NAME!;
const REGION = process.env.AWS_REGION ?? 'us-east-2';

if (!TABLE) {
    console.error('INTELLIGENCE_TABLE env var required');
    process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const classifyOnly = process.argv.includes('--classify-only');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambda = new LambdaClient({ region: REGION });

function invertedActivityToken(iso: string): string {
    const ms = new Date(iso).getTime();
    return (8_640_000_000_000_000 - ms).toString().padStart(16, '0');
}

function invertedScoreToken(score: number): string {
    const clamped = Math.max(0, Math.min(10_000, score));
    return (10_000 - clamped).toString().padStart(5, '0');
}

interface OrgGroup {
    canonicalDomain: string;
    aliasDomains: Set<string>;
    rfqs: any[];
    orders: any[];
    leads: any[];
    firstSeen: string;
    lastActivity: string;
    leadScore: number;
    primaryContactEmail: string;
    primaryInstitution: string | undefined;
    totalOrderValueUSD: number;
}

async function scanAllSubmissions(): Promise<any[]> {
    // Use PK prefix + SK=META as the canonical identity — historical items
    // (pre-Phase C) don't carry an `entityType` attribute, only follow the
    // single-table PK prefix convention.
    const out: any[] = [];
    let lastKey: any = undefined;
    do {
        const r: any = await ddb.send(new ScanCommand({
            TableName: TABLE,
            FilterExpression:
                '(begins_with(PK, :rfqp) OR begins_with(PK, :orderp) OR begins_with(PK, :leadp)) AND SK = :meta',
            ExpressionAttributeValues: {
                ':rfqp': 'RFQ#',
                ':orderp': 'ORDER#',
                ':leadp': 'LEAD#',
                ':meta': 'META',
            },
            ExclusiveStartKey: lastKey,
        }));
        out.push(...(r.Items ?? []));
        lastKey = r.LastEvaluatedKey;
    } while (lastKey);
    return out;
}

async function fetchOrderPrimaryEmail(orderPk: string): Promise<{ email: string; name?: string } | null> {
    // ORDERs store contacts as separate SK rows (CONTACT#<id>) with
    // `contactEmail` field. Pull the primary one.
    const r: any = await ddb.send(new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'PK = :pk AND begins_with(SK, :ck)',
        ExpressionAttributeValues: { ':pk': orderPk, ':ck': 'CONTACT#' },
    }));
    const contacts = (r.Items ?? []) as any[];
    if (contacts.length === 0) return null;
    const primary = contacts.find((c) => c.isPrimary === true) ?? contacts[0];
    if (!primary?.contactEmail) return null;
    return { email: primary.contactEmail as string, name: primary.contactName as string | undefined };
}

function inferEntityType(pk: string): 'RFQ_SUBMISSION' | 'ORDER' | 'LEAD_SUBMISSION' | null {
    if (pk.startsWith('RFQ#')) return 'RFQ_SUBMISSION';
    if (pk.startsWith('ORDER#')) return 'ORDER';
    if (pk.startsWith('LEAD#')) return 'LEAD_SUBMISSION';
    return null;
}

async function groupByOrg(items: any[]): Promise<Map<string, OrgGroup>> {
    const map = new Map<string, OrgGroup>();
    let freeMailSkipped = 0;
    let noEmailSkipped = 0;

    for (const item of items) {
        const pk = item.PK as string;
        const entityType = item.entityType ?? inferEntityType(pk);
        if (!entityType) continue;

        // Resolve email per entity type:
        // - RFQ/LEAD: `email` on META row
        // - ORDER: fetch primary CONTACT row (`contactEmail`)
        let email: string | undefined = item.email as string | undefined;
        let contactName: string | undefined;
        if (!email && entityType === 'ORDER') {
            const ec = await fetchOrderPrimaryEmail(pk);
            if (ec) {
                email = ec.email;
                contactName = ec.name;
            }
        }
        if (!email) {
            noEmailSkipped++;
            console.log(JSON.stringify({ event: 'backfill.no-email', pk, entityType }));
            continue;
        }

        const { orgId, domain, isFreeMailDomain } = classifyEmailDomain(email);
        if (!orgId) {
            if (isFreeMailDomain) freeMailSkipped++;
            console.log(JSON.stringify({ event: 'backfill.skip', pk, reason: isFreeMailDomain ? 'free-mail' : 'invalid', email }));
            continue;
        }

        const itemDate = (item.submittedAt ?? item.quoteDate ?? item.createdAt ?? '2020-01-01') as string;

        if (!map.has(orgId)) {
            map.set(orgId, {
                canonicalDomain: orgId,
                aliasDomains: new Set([domain]),
                rfqs: [], orders: [], leads: [],
                firstSeen: itemDate,
                lastActivity: itemDate,
                leadScore: 0,
                primaryContactEmail: email,
                // RFQ uses `institution`, LEAD uses `organization`; fall back to contact name for orders
                primaryInstitution: (item.institution ?? item.organization ?? contactName) as string | undefined,
                totalOrderValueUSD: 0,
            });
        }
        const group = map.get(orgId)!;
        group.aliasDomains.add(domain);
        if (itemDate < group.firstSeen) group.firstSeen = itemDate;
        if (itemDate > group.lastActivity) group.lastActivity = itemDate;

        switch (entityType) {
            case 'RFQ_SUBMISSION':
                group.rfqs.push(item);
                group.leadScore += computeRfqScore({
                    fundingStatus: item.fundingStatus,
                    timeline: item.timeline,
                });
                break;
            case 'ORDER':
                group.orders.push(item);
                group.leadScore += computeOrderScore(item.quoteAmount);
                group.totalOrderValueUSD += (item.quoteAmount ?? 0);
                break;
            case 'LEAD_SUBMISSION':
                group.leads.push(item);
                group.leadScore += computeLeadScore({
                    type: item.type,
                    marketingOptIn: item.marketingOptIn,
                });
                break;
        }
    }

    console.log(`Grouped ${items.length} items into ${map.size} Orgs; skipped ${freeMailSkipped} free-mail + ${noEmailSkipped} no-email`);
    return map;
}

async function writeOrgAndAliases(orgId: string, group: OrgGroup): Promise<{ created: boolean }> {
    const nowIso = new Date().toISOString();
    const item = {
        PK: `ORG#${orgId}`,
        SK: 'META',
        entityType: 'ORGANIZATION',
        orgId,
        primaryDomain: orgId,
        aliasDomains: Array.from(group.aliasDomains).filter((d) => d !== orgId),
        displayName: orgId,
        type: 'unknown',
        leadScore: group.leadScore,
        hasActiveInquiry: group.rfqs.length > 0 || group.leads.length > 0,
        rfqCount: group.rfqs.length,
        orderCount: group.orders.length,
        leadCount: group.leads.length,
        totalOrderValueUSD: group.totalOrderValueUSD,
        firstSeenAt: group.firstSeen,
        lastActivityAt: group.lastActivity,
        status: 'active',
        contactCount: group.rfqs.length + group.leads.length,
        primaryContactEmail: group.primaryContactEmail,
        createdAt: nowIso,
        updatedAt: nowIso,
        GSI1PK: 'ORG_TYPE#unknown',
        GSI1SK: `${invertedActivityToken(group.lastActivity)}#${orgId}`,
        GSI2PK: `ORG_DOMAIN#${orgId}`,
        GSI2SK: 'ORG',
        ...(group.leadScore >= LEAD_SCORE_THRESHOLD ? {
            GSI3PK: 'ORG_LEAD_SCORE',
            GSI3SK: `${invertedScoreToken(group.leadScore)}#${orgId}`,
        } : {}),
    };

    if (dryRun) {
        console.log(`DRY-RUN PutItem ORG#${orgId} (leadScore=${group.leadScore})`);
        return { created: true };
    }

    try {
        await ddb.send(new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
        console.log(`Created ORG#${orgId}`);
    } catch (err: any) {
        if (err?.name === 'ConditionalCheckFailedException') {
            console.log(`Skipped ORG#${orgId} (already exists)`);
            return { created: false };
        }
        throw err;
    }

    // Write alias lookups for each domain that differs from canonical
    for (const d of group.aliasDomains) {
        if (d === orgId) continue;
        try {
            await ddb.send(new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${d}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${d}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            }));
        } catch (err: any) {
            if (err?.name !== 'ConditionalCheckFailedException') throw err;
        }
    }

    return { created: true };
}

async function backfillItemMatchedOrg(item: any, orgId: string): Promise<void> {
    const entityType = item.entityType ?? inferEntityType(item.PK as string);
    let pk: string;
    let gsi2sk: string;
    switch (entityType) {
        case 'RFQ_SUBMISSION':
            pk = item.PK as string;
            gsi2sk = `RFQ#${item.submittedAt ?? item.createdAt ?? ''}`;
            break;
        case 'ORDER':
            pk = item.PK as string;
            gsi2sk = `ORDER#${item.quoteDate ?? item.createdAt ?? ''}`;
            break;
        case 'LEAD_SUBMISSION':
            pk = item.PK as string;
            gsi2sk = `LEAD#${item.submittedAt ?? item.createdAt ?? ''}`;
            break;
        default:
            return;
    }
    if (dryRun) {
        console.log(`DRY-RUN UpdateItem ${pk} matchedOrgId=${orgId}`);
        return;
    }
    await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: pk, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2, GSI2SK = :gsi2sk',
        ExpressionAttributeValues: {
            ':id': orgId,
            ':gsi2': `ORG#${orgId}`,
            ':gsi2sk': gsi2sk,
        },
    }));
}

async function repairOrderFromRfq(rfq: any, orgId: string): Promise<boolean> {
    if (!rfq.linkedOrderId) return false;
    if (dryRun) {
        console.log(`DRY-RUN repair ORDER#${rfq.linkedOrderId} matchedOrgId=${orgId}`);
        return true;
    }
    await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ORDER#${rfq.linkedOrderId}`, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': orgId,
            ':gsi2': `ORG#${orgId}`,
        },
    }));
    return true;
}

async function triggerClassify(orgId: string, institution?: string): Promise<void> {
    if (dryRun) {
        console.log(`DRY-RUN classify ${orgId}`);
        return;
    }
    if (!ORG_API_FUNC) {
        console.warn('ORGANIZATION_API_FUNCTION_NAME not set; skipping classify trigger');
        return;
    }
    await lambda.send(new InvokeCommand({
        FunctionName: ORG_API_FUNC,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(JSON.stringify({
            action: 'classifyOrg',
            orgId,
            institution,
        })),
    }));
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log(`Starting backfill against ${TABLE} (dry-run=${dryRun}, classify-only=${classifyOnly})`);

    if (classifyOnly) {
        console.log('classify-only mode: scanning for Orgs missing aiClassifiedAt...');
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE,
            FilterExpression: 'entityType = :et AND attribute_not_exists(aiClassifiedAt)',
            ExpressionAttributeValues: { ':et': 'ORGANIZATION' },
        }));
        let n = 0;
        for (const org of (r.Items ?? [])) {
            await triggerClassify(org.orgId as string, undefined);
            n++;
            if (n % 10 === 0) await sleep(100);
        }
        console.log(`Triggered classify on ${n} orgs`);
        return;
    }

    const items = await scanAllSubmissions();
    console.log(`Scanned ${items.length} RFQ/Order/Lead items`);

    const groups = await groupByOrg(items);

    let orgsCreated = 0, orgsExisting = 0;
    let rfqsBackfilled = 0, ordersBackfilled = 0, leadsBackfilled = 0, ordersRepaired = 0;
    let batchedClassifyCount = 0;

    for (const [orgId, group] of groups) {
        const { created } = await writeOrgAndAliases(orgId, group);
        if (created) orgsCreated++; else orgsExisting++;

        for (const rfq of group.rfqs) {
            await backfillItemMatchedOrg(rfq, orgId);
            rfqsBackfilled++;
            const repaired = await repairOrderFromRfq(rfq, orgId);
            if (repaired) ordersRepaired++;
        }
        for (const order of group.orders) {
            await backfillItemMatchedOrg(order, orgId);
            ordersBackfilled++;
        }
        for (const lead of group.leads) {
            await backfillItemMatchedOrg(lead, orgId);
            leadsBackfilled++;
        }

        if (created) {
            await triggerClassify(orgId, group.primaryInstitution);
            batchedClassifyCount++;
            if (batchedClassifyCount % 10 === 0) await sleep(100);
        }

        await sleep(50);
    }

    console.log('Backfill complete:', JSON.stringify({
        orgsCreated,
        orgsExisting,
        rfqsBackfilled,
        ordersBackfilled,
        ordersRepaired,
        leadsBackfilled,
    }, null, 2));
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
