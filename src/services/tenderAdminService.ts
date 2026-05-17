import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

export interface ListTendersArgs {
    statuses?: string[];
    includeExpired?: boolean;
    countries?: string[];
    categories?: string[];
    minScore?: number;
    postedDateFrom?: string;
    postedDateTo?: string;
    search?: string;
    sortBy?: 'score' | 'postedDate' | 'deadline';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

export async function listTenders(args: ListTendersArgs) {
    const { data, errors } = await client.queries.listTenders(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function getTender(tenderId: string) {
    const { data, errors } = await client.queries.getTender({ tenderId } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function listKeywordConfigs(includeInactive = false) {
    const { data, errors } = await client.queries.listTenderKeywordConfigs({ includeInactive } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data ?? [];
}

export async function updateTenderStatus(args: { tenderId: string; toStatus: string; note?: string; assignedTo?: string }) {
    const { data, errors } = await client.mutations.updateTenderStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function bulkUpdateTenderStatus(args: { tenderIds: string[]; toStatus: string }): Promise<number> {
    const { data, errors } = await client.mutations.bulkUpdateTenderStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data as number;
}

export async function upsertKeywordConfig(args: {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
}) {
    const { data, errors } = await client.mutations.upsertTenderKeywordConfig(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function runPrefilterPreview(args: {
    title: string;
    description: string;
    naicsCodes?: string[];
    cpvCodes?: string[];
    configOverride?: any;
}) {
    const { data, errors } = await client.mutations.runPrefilterPreview(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function translateTenderDescription(tenderId: string, force = false): Promise<string> {
    const { data, errors } = await client.mutations.translateTenderDescription({ tenderId, force } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data as string;
}

/**
 * Loops nextToken to fetch all tenders matching the filter, caps at 500 rows.
 * Returns a CSV Blob.
 */
export async function exportTendersAsCsv(filters: ListTendersArgs): Promise<Blob> {
    const MAX_ROWS = 500;
    const rows: any[] = [];
    let nextToken: string | undefined = undefined;
    while (rows.length < MAX_ROWS) {
        const page: any = await listTenders({ ...filters, limit: 100, nextToken });
        rows.push(...((page?.items ?? []) as any[]));
        nextToken = page?.nextToken ?? undefined;
        if (!nextToken) break;
    }
    const truncated = rows.slice(0, MAX_ROWS);
    const header = ['tenderId', 'source', 'title', 'agency', 'country', 'postedDate', 'deadline', 'overallScore', 'status', 'sourceUrl'];
    const escape = (v: any) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        header.join(','),
        ...truncated.map((r) => header.map((h) => escape(r[h])).join(',')),
    ].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
