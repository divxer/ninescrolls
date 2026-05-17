/**
 * Seed fake tenders into the sandbox intelligenceTable for Phase 2 UI testing.
 *
 * Usage:
 *   INTELLIGENCE_TABLE=$(aws dynamodb list-tables --region us-east-2 \
 *     --query 'TableNames[?contains(@,`tenderadmin`) && contains(@,`Intelligence`)] | [0]' \
 *     --output text) \
 *   AWS_REGION=us-east-2 \
 *   npx tsx scripts/seed-test-tenders.ts
 *
 * Creates 5 tenders with varied attributes to exercise the admin UI:
 *   - English / Italian / Chinese languages (translation test)
 *   - Score range 45-92 (KPI + color chip variety)
 *   - Different deadlines (one closing-soon, one expired)
 *   - One with NAICS+CPV, one without
 *   - 1 MATCH row per tender + 1 LOG row per tender
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';

const REGION = process.env.AWS_REGION ?? 'us-east-2';
const TABLE = process.env.INTELLIGENCE_TABLE;
if (!TABLE) {
    throw new Error('INTELLIGENCE_TABLE env var is required.');
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function scoreSortToken(score: number): string {
    const clamped = Math.min(100, Math.max(0, Math.round(score)));
    return String(100 - clamped).padStart(3, '0');
}

function tenderItemKey(tenderId: string) {
    return { PK: `TENDER#${tenderId}`, SK: 'METADATA' };
}
function tenderMatchItemKey(tenderId: string, productSlug: string) {
    return { PK: `TENDER#${tenderId}`, SK: `MATCH#${productSlug}` };
}
function tenderStatusLogItemKey(tenderId: string, isoTimestamp: string, ulidStr: string) {
    return { PK: `TENDER#${tenderId}`, SK: `LOG#${isoTimestamp}#${ulidStr}` };
}
function tenderStatusGsiKey(status: string, overallScore: number, postedDate: string, tenderId: string) {
    return {
        GSI1PK: `TENDER_STATUS#${status}`,
        GSI1SK: `${scoreSortToken(overallScore)}#${postedDate}#${tenderId}`,
    };
}
function tenderHighPriorityGsiKey(postedDate: string, tenderId: string) {
    return { GSI3PK: 'TENDER_HIGH_PRIORITY' as const, GSI3SK: `${postedDate}#${tenderId}` };
}

const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const THREE_DAYS_AGO = new Date(NOW.getTime() - 3 * 86400_000).toISOString().slice(0, 10);
const FIVE_DAYS_FROM_NOW = new Date(NOW.getTime() + 5 * 86400_000).toISOString().slice(0, 10);
const TWO_WEEKS_FROM_NOW = new Date(NOW.getTime() + 14 * 86400_000).toISOString().slice(0, 10);
const ISO_NOW = NOW.toISOString();

interface FakeTender {
    tenderId: string;
    source: 'sam' | 'ted';
    sourceUrl: string;
    title: string;
    agency: string;
    country: string;
    language: string;
    description: string;
    descriptionEn?: string;
    estimatedValueUSD?: number;
    estimatedValueOriginal?: string;
    postedDate: string;
    deadline?: string;
    naicsCodes?: string[];
    cpvCodes?: string[];
    overallScore: number;
    isHighPriority: boolean;
    isExpired: boolean;
    status: string;
    statusNote?: string;
    matches: Array<{ productSlug: string; score: number; reasoning: string; matchedKeywords: string[] }>;
    matchedProductCategories?: string[];
}

const TENDERS: FakeTender[] = [
    {
        tenderId: 'test-sam-001',
        source: 'sam',
        sourceUrl: 'https://sam.gov/opp/test-001',
        title: 'PECVD System Procurement for Stanford Cleanroom',
        agency: 'Stanford University Research Procurement',
        country: 'US',
        language: 'en',
        description: 'Stanford University seeks to procure a plasma-enhanced chemical vapor deposition (PECVD) system for the new nanofabrication facility. The system must support silicon nitride and silicon oxide deposition at temperatures from 200°C to 400°C. Required throughput is at least 5 wafers per hour with uniformity better than ±2% across 200mm wafers.',
        estimatedValueUSD: 850_000,
        estimatedValueOriginal: 'USD 850,000',
        postedDate: TODAY,
        deadline: TWO_WEEKS_FROM_NOW,
        naicsCodes: ['334516'],
        cpvCodes: [],
        overallScore: 92,
        isHighPriority: true,
        isExpired: false,
        status: 'new',
        matches: [
            { productSlug: 'pluto-f', score: 92, reasoning: 'Excellent match — Stanford spec aligns with Pluto-F throughput and uniformity targets.', matchedKeywords: ['PECVD', 'plasma-enhanced chemical vapor deposition'] },
        ],
        matchedProductCategories: ['PECVD'],
    },
    {
        tenderId: 'test-ted-002',
        source: 'ted',
        sourceUrl: 'https://ted.europa.eu/opp/test-002',
        title: 'Fornitura di Reattore di Deposizione ALD per Laboratorio',
        agency: 'Politecnico di Milano',
        country: 'IT',
        language: 'it',
        description: 'Il Politecnico di Milano richiede la fornitura di un reattore di deposizione atomica strato per strato (ALD) per il laboratorio di nanotecnologie. Specifiche minime: deposizione uniforme di Al2O3 e HfO2 su substrati fino a 200mm di diametro, temperatura operativa 100-300°C, controllo precursori a fiala riscaldata.',
        estimatedValueUSD: 420_000,
        estimatedValueOriginal: 'EUR 380,000',
        postedDate: THREE_DAYS_AGO,
        deadline: TWO_WEEKS_FROM_NOW,
        naicsCodes: [],
        cpvCodes: ['38540000', '38500000'],
        overallScore: 78,
        isHighPriority: false,
        isExpired: false,
        status: 'reviewing',
        statusNote: 'Italian-language spec, need translation to confirm fit.',
        matches: [
            { productSlug: 'ald-system', score: 78, reasoning: 'Good match — temperature range and substrate size align with ALD-System.', matchedKeywords: ['ALD', 'atomic layer'] },
        ],
        matchedProductCategories: ['ALD'],
    },
    {
        tenderId: 'test-sam-003',
        source: 'sam',
        sourceUrl: 'https://sam.gov/opp/test-003',
        title: 'Reactive Ion Etcher (RIE-ICP) for MIT Nanofab',
        agency: 'Massachusetts Institute of Technology',
        country: 'US',
        language: 'en',
        description: 'MIT.nano seeks a reactive ion etcher with inductively coupled plasma (ICP) source for silicon and silicon dioxide etching. Required gas compatibility: SF6, CF4, O2, Ar, He. Anisotropic etching capability with aspect ratio up to 15:1.',
        estimatedValueUSD: 620_000,
        estimatedValueOriginal: 'USD 620,000',
        postedDate: THREE_DAYS_AGO,
        deadline: FIVE_DAYS_FROM_NOW, // closing soon!
        naicsCodes: ['334516'],
        cpvCodes: [],
        overallScore: 85,
        isHighPriority: true,
        isExpired: false,
        status: 'pursuing',
        statusNote: 'Proposal in flight; deadline 5 days.',
        matches: [
            { productSlug: 'rie-etcher', score: 85, reasoning: 'Strong fit on gas compatibility + aspect ratio.', matchedKeywords: ['reactive ion etching', 'ICP'] },
        ],
        matchedProductCategories: ['RIE-ICP'],
    },
    {
        tenderId: 'test-sam-004',
        source: 'sam',
        sourceUrl: 'https://sam.gov/opp/test-004',
        title: 'Cleanroom HVAC Maintenance Services',
        agency: 'University of Texas at Austin Facilities',
        country: 'US',
        language: 'en',
        description: 'HVAC maintenance services for cleanroom facility, including filter replacement, particle count monitoring, and quarterly system inspections.',
        estimatedValueUSD: 75_000,
        estimatedValueOriginal: 'USD 75,000',
        postedDate: TODAY,
        deadline: TWO_WEEKS_FROM_NOW,
        naicsCodes: ['238220'],
        cpvCodes: [],
        overallScore: 45,
        isHighPriority: false,
        isExpired: false,
        status: 'new',
        matches: [],
        matchedProductCategories: [],
    },
    {
        tenderId: 'test-ted-005',
        source: 'ted',
        sourceUrl: 'https://ted.europa.eu/opp/test-005',
        title: 'Forschungsausrüstung für Halbleiter-Dünnschichtanalyse',
        agency: 'TU München',
        country: 'DE',
        language: 'de',
        description: 'Die Technische Universität München sucht ein Spektroskopiesystem für die Charakterisierung von Halbleiter-Dünnschichten. Anforderungen: in-situ Ellipsometrie, Photolumineszenzspektroskopie, Probendurchmesser bis 200mm. Lieferung innerhalb von 6 Monaten erforderlich.',
        estimatedValueUSD: 280_000,
        estimatedValueOriginal: 'EUR 250,000',
        postedDate: THREE_DAYS_AGO,
        deadline: TWO_WEEKS_FROM_NOW,
        naicsCodes: [],
        cpvCodes: ['38540000'],
        overallScore: 62,
        isHighPriority: false,
        isExpired: false,
        status: 'new',
        matches: [
            { productSlug: 'ellipsometer-pro', score: 62, reasoning: 'Moderate match on spectroscopy capability; substrate size aligns.', matchedKeywords: ['Ellipsometrie', 'Dünnschicht'] },
        ],
        matchedProductCategories: ['Spectroscopy'],
    },
];

async function seed() {
    const allItems: Record<string, unknown>[] = [];

    for (const t of TENDERS) {
        // 1) METADATA item with all GSI keys
        const metaItem: Record<string, unknown> = {
            ...tenderItemKey(t.tenderId),
            ...tenderStatusGsiKey(t.status, t.overallScore, t.postedDate, t.tenderId),
            entityType: 'TENDER',
            tenderId: t.tenderId,
            source: t.source,
            sourceUrl: t.sourceUrl,
            title: t.title,
            agency: t.agency,
            country: t.country,
            language: t.language,
            description: t.description,
            ...(t.descriptionEn ? { descriptionEn: t.descriptionEn } : {}),
            ...(t.estimatedValueUSD != null ? { estimatedValueUSD: t.estimatedValueUSD } : {}),
            ...(t.estimatedValueOriginal ? { estimatedValueOriginal: t.estimatedValueOriginal } : {}),
            postedDate: t.postedDate,
            ...(t.deadline ? { deadline: t.deadline } : {}),
            naicsCodes: t.naicsCodes ?? [],
            cpvCodes: t.cpvCodes ?? [],
            overallScore: t.overallScore,
            isHighPriority: t.isHighPriority,
            isExpired: t.isExpired,
            status: t.status,
            ...(t.statusNote ? { statusNote: t.statusNote } : {}),
            ...(t.matchedProductCategories ? { matchedProductCategories: t.matchedProductCategories } : {}),
            createdAt: ISO_NOW,
            updatedAt: ISO_NOW,
            lastStatusChangedAt: ISO_NOW,
        };
        // Add GSI3 only for high-priority tenders
        if (t.isHighPriority) {
            Object.assign(metaItem, tenderHighPriorityGsiKey(t.postedDate, t.tenderId));
        }
        allItems.push(metaItem);

        // 2) MATCH rows
        for (const m of t.matches) {
            allItems.push({
                ...tenderMatchItemKey(t.tenderId, m.productSlug),
                entityType: 'TENDER_MATCH',
                tenderId: t.tenderId,
                productSlug: m.productSlug,
                score: m.score,
                reasoning: m.reasoning,
                matchedKeywords: m.matchedKeywords,
                createdAt: ISO_NOW,
            });
        }

        // 3) Initial LOG row (status → its current status, by "seed-script")
        allItems.push({
            ...tenderStatusLogItemKey(t.tenderId, ISO_NOW, ulid()),
            entityType: 'TENDER_STATUS_LOG',
            tenderId: t.tenderId,
            fromStatus: null,
            toStatus: t.status,
            changedBy: 'seed-script',
            changedAt: ISO_NOW,
            note: 'Seeded test tender',
        });
    }

    // BatchWrite in chunks of 25
    for (let i = 0; i < allItems.length; i += 25) {
        const chunk = allItems.slice(i, i + 25);
        await ddb.send(new BatchWriteCommand({
            RequestItems: { [TABLE!]: chunk.map((Item) => ({ PutRequest: { Item } })) },
        }));
        console.log(`  Wrote chunk ${Math.floor(i / 25) + 1} (${chunk.length} items)`);
    }
    console.log(`✓ Seeded ${TENDERS.length} tenders + ${allItems.length - TENDERS.length} child rows (${allItems.length} total)`);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
