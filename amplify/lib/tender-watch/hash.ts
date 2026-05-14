import crypto from 'node:crypto';

export interface TenderHashInput {
    title: string;
    agency: string;
    deadline?: string | null;
}

export function sourceTenderHash(input: TenderHashInput): string {
    const normalized = [
        input.title.trim().toLowerCase(),
        input.agency.trim().toLowerCase(),
        input.deadline ?? '',
    ].join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
