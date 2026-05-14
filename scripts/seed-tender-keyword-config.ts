import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// `intelligenceTable` is created with a CDK-generated physical name. After the
// first deploy, find it via the AWS console (DynamoDB → Tables) or:
//     aws dynamodb list-tables --query 'TableNames[?contains(@, `Intelligence`)]'
// then run:
//     INTELLIGENCE_TABLE=<that-name> npx tsx scripts/seed-tender-keyword-config.ts
const TABLE = process.env.INTELLIGENCE_TABLE;
if (!TABLE) {
    throw new Error('INTELLIGENCE_TABLE env var is required. Find the name with `aws dynamodb list-tables`.');
}

interface SeedConfig {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
}

const SEEDS: SeedConfig[] = [
    {
        productCategory: 'PECVD',
        productSlugs: ['pluto-f', 'pluto-m', 'pluto-t'],
        keywords: ['PECVD', 'plasma-enhanced chemical vapor deposition', 'plasma enhanced CVD'],
        synonyms: ['plasma deposition', 'silicon nitride deposition', 'silicon oxide deposition'],
        blacklist: ['advertisement', 'recruiting'],
        naicsCodes: ['334516', '333242', '541380'],
        cpvCodes: ['38540000', '38500000', '31700000'],
    },
    {
        productCategory: 'ALD',
        productSlugs: ['ald-system'],
        keywords: ['atomic layer deposition', 'ALD'],
        synonyms: ['atomic layer epitaxy', 'thin film deposition'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'RIE-ICP',
        productSlugs: ['rie-etcher', 'icp-etcher', 'compact-rie'],
        keywords: ['reactive ion etching', 'RIE', 'inductively coupled plasma', 'ICP etcher', 'ICP etching'],
        synonyms: ['plasma etcher', 'dry etcher', 'silicon etching'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'E-Beam',
        productSlugs: ['ebeam-evaporator'],
        keywords: ['electron beam evaporator', 'e-beam evaporator', 'electron-beam evaporation'],
        synonyms: ['thin film deposition', 'metal evaporation', 'thermal evaporator'],
        blacklist: ['security camera', 'cosmetic'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'Sputter',
        productSlugs: ['sputter-system'],
        keywords: ['sputter deposition', 'sputtering system', 'magnetron sputter'],
        synonyms: ['PVD', 'physical vapor deposition'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'IBE-RIBE',
        productSlugs: ['ibe-ribe-system'],
        keywords: ['ion beam etching', 'IBE', 'RIBE', 'reactive ion beam etching'],
        synonyms: ['ion milling'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'HDPCVD',
        productSlugs: ['hdpcvd-system'],
        keywords: ['HDPCVD', 'high density plasma CVD', 'high-density plasma chemical vapor deposition'],
        synonyms: [],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'Coater-Developer',
        productSlugs: ['coater-developer'],
        keywords: ['photoresist coater', 'spin coater developer', 'track tool'],
        synonyms: ['lithography track'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'Stripper',
        productSlugs: ['stripper-system'],
        keywords: ['photoresist stripper', 'plasma stripper', 'asher'],
        synonyms: ['photoresist removal'],
        blacklist: ['advertisement', 'paint stripper', 'wire stripper'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'AFM',
        productSlugs: ['hy20l', 'hy20l-rf', 'hy4l'],
        keywords: ['atomic force microscope', 'atomic force microscopy', 'scanning probe microscope'],
        synonyms: ['nano-indenter', 'nanoindenter', 'SPM'],
        blacklist: ['automated facial recognition', 'anti-money laundering'],
        naicsCodes: ['334516', '334519'],
        cpvCodes: ['38540000', '38500000'],
    },
];

const now = new Date().toISOString();

const items = SEEDS.map((s) => ({
    PutRequest: {
        Item: {
            PK: 'TENDER_KEYWORD_CONFIG',
            SK: `CATEGORY#${s.productCategory}`,
            GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
            GSI1SK: `CATEGORY#${s.productCategory}`,
            entityType: 'TENDER_KEYWORD_CONFIG',
            ...s,
            isActive: true,
            updatedBy: 'seed-script',
            updatedAt: now,
        },
    },
}));

async function main() {
    // BatchWrite max 25 per call.
    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        await ddb.send(new BatchWriteCommand({
            RequestItems: { [TABLE!]: batch },
        }));
        console.log(`Wrote batch ${i / 25 + 1} (${batch.length} configs)`);
    }
    console.log(`Done. Seeded ${items.length} TenderKeywordConfig items.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
