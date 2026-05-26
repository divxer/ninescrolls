import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;
const NOTIFICATION_TO = 'info@ninescrolls.com';
const NOTIFICATION_FROM = { email: 'noreply@ninescrolls.com', name: 'NineScrolls' };

export interface DigestEvent { digestTenderIds: string[]; }
export interface DigestOutcome {
    status: 'sent' | 'skipped';
    count: number;
}
export type DigestResult = DigestOutcome;

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadTenders(ids: string[]): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const res = await ddb.send(new BatchGetCommand({
            RequestItems: { [TABLE()]: { Keys: batch.map((id) => tenderItemKey(id)) } },
        }));
        for (const it of (res.Responses?.[TABLE()] ?? [])) out.push(it);
    }
    return out;
}

export async function handler(event: DigestEvent): Promise<DigestOutcome> {
    if (event.digestTenderIds.length === 0) return { status: 'skipped', count: 0 };
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        throw new Error('SENDGRID_API_KEY is required for notify-daily-digest');
    }
    const tenders = await loadTenders(event.digestTenderIds);
    if (tenders.length === 0) return { status: 'skipped', count: 0 };

    const byCountry = new Map<string, any[]>();
    for (const t of tenders) {
        const c = t.country ?? 'XX';
        if (!byCountry.has(c)) byCountry.set(c, []);
        byCountry.get(c)!.push(t);
    }
    for (const arr of byCountry.values()) arr.sort((a, b) => b.overallScore - a.overallScore);

    const sections = [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, items]) => {
        const rows = items.map((t) =>
            `<tr><td>${t.overallScore}</td><td><a href="${escapeHtml(t.sourceUrl)}">${escapeHtml(t.title)}</a></td><td>${escapeHtml(t.agency)}</td><td>${t.deadline ?? 'N/A'}</td></tr>`
        ).join('');
        return `<h3>${escapeHtml(c)} (${items.length})</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Score</th><th>Title</th><th>Agency</th><th>Deadline</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('\n');

    const html = `<h2>Tender Watch — daily digest</h2><p>${tenders.length} new tenders today.</p>\n${sections}`;
    const subject = `[Tender Watch] Daily digest — ${tenders.length} new tenders (${[...byCountry.keys()].sort().join(', ')})`;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: NOTIFICATION_TO }] }],
            from: NOTIFICATION_FROM,
            subject,
            content: [{ type: 'text/html', value: html }],
        }),
    });
    if (res.status !== 202) {
        const body = await res.text().catch(() => '');
        console.error(JSON.stringify({ event: 'notify-daily-digest.sendgrid.fail', status: res.status, body }));
        throw new Error(`SendGrid returned ${res.status}: ${body}`);
    }

    return { status: 'sent', count: tenders.length };
}
