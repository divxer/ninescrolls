import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
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
    const { data, errors } = await client().queries.listTenders(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function getTender(tenderId: string) {
    const { data, errors } = await client().queries.getTender({ tenderId } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function listKeywordConfigs(includeInactive = false) {
    const { data, errors } = await client().queries.listTenderKeywordConfigs({ includeInactive } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data ?? [];
}

// AppSync has no native JSON GraphQL type, so `a.json()` and `a.json().array()`
// returns values as JSON-encoded strings on the wire. The Amplify client does
// NOT auto-parse — we must JSON.parse each element ourselves.
function parseJsonField<T>(value: unknown): T | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        try { return JSON.parse(value) as T; } catch { return null; }
    }
    return value as T;
}

export async function listPipelineRuns(limit = 100) {
    const { data, errors } = await client().queries.listPipelineRuns({ limit } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    const raw = (data ?? []) as unknown[];
    return raw
        .map(item => parseJsonField<Record<string, unknown>>(item))
        .filter((row): row is Record<string, unknown> => row != null);
}

export async function getPipelineRun(executionId: string) {
    const { data, errors } = await client().queries.getPipelineRun({ executionId } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return parseJsonField<{ summary: unknown; sources: unknown[] }>(data);
}

export async function updateTenderStatus(args: { tenderId: string; toStatus: string; note?: string; assignedTo?: string }) {
    const { data, errors } = await client().mutations.updateTenderStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function bulkUpdateTenderStatus(args: { tenderIds: string[]; toStatus: string }): Promise<number> {
    const { data, errors } = await client().mutations.bulkUpdateTenderStatus(args as any, AUTH);
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
    const { data, errors } = await client().mutations.upsertTenderKeywordConfig(args as any, AUTH);
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
    // AppSync's AWSJSON scalar (a.json() in schema) expects a JSON-encoded string,
    // not a raw object. Match the orderAdminService.createOrder pattern.
    const payload = {
        ...args,
        configOverride: args.configOverride ? JSON.stringify(args.configOverride) : undefined,
    };
    const { data, errors } = await client().mutations.runPrefilterPreview(payload as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function translateTenderDescription(tenderId: string, force = false): Promise<string> {
    const { data, errors } = await client().mutations.translateTenderDescription({ tenderId, force } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data as string;
}

/**
 * Exports current filter result as a CSV Blob.
 *
 * Phase 2 limitation: server-side pagination is not yet implemented
 * (listTenders always returns nextToken: null). This function therefore
 * fetches a single page with limit=500. When pagination lands in Phase D,
 * this should be updated to loop nextToken with a higher MAX_ROWS cap.
 */
export async function exportTendersAsCsv(filters: ListTendersArgs): Promise<Blob> {
    const MAX_ROWS = 500;
    const page: any = await listTenders({ ...filters, limit: MAX_ROWS });
    const rows = ((page?.items ?? []) as any[]).slice(0, MAX_ROWS);
    const header = ['tenderId', 'source', 'title', 'agency', 'country', 'postedDate', 'deadline', 'overallScore', 'status', 'sourceUrl'];
    const escape = (v: any) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        header.join(','),
        ...rows.map((r) => header.map((h) => escape(r[h])).join(',')),
    ].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
