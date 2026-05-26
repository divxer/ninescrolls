import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;
const NOTIFICATION_TO = 'info@ninescrolls.com';
const NOTIFICATION_FROM = { email: 'noreply@ninescrolls.com', name: 'NineScrolls' };

export interface NotifyHighPriorityEvent { highPriorityTenderIds: string[]; }
export interface NotifyOutcome {
    status: 'sent' | 'skipped';
    count: number;
}
export type NotifyResult = NotifyOutcome;

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function daysUntil(dateIso: string | null | undefined): string {
    if (!dateIso) return 'no deadline';
    const ms = new Date(dateIso).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    return `${days} day${Math.abs(days) === 1 ? '' : 's'}`;
}

async function sendEmail(subject: string, html: string, apiKey: string): Promise<void> {
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
    if (res.status === 202) return;
    const body = await res.text().catch(() => '');
    console.error(JSON.stringify({ event: 'notify-high-priority.sendgrid.fail', status: res.status, body }));
    throw new Error(`SendGrid returned ${res.status}: ${body}`);
}

export async function handler(event: NotifyHighPriorityEvent): Promise<NotifyOutcome> {
    if (event.highPriorityTenderIds.length === 0) {
        return { status: 'skipped', count: 0 };
    }

    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        throw new Error('SENDGRID_API_KEY is required for notify-high-priority');
    }

    const rows: string[] = [];
    for (const tenderId of event.highPriorityTenderIds) {
        const meta = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderItemKey(tenderId) }));
        const t = meta.Item;
        if (!t) continue;

        const matches = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `TENDER#${tenderId}`, ':sk': 'MATCH#' },
        }));

        const matchesHtml = (matches.Items ?? []).map((m: Record<string, any>) =>
            `<li><strong>${escapeHtml(m.productSlug)}</strong> - ${m.score}/100<br><em>${escapeHtml(m.reasoning ?? '')}</em></li>`
        ).join('');

        rows.push([
            `<section>`,
            `<h2>${escapeHtml(t.title)}</h2>`,
            `<p><strong>Agency:</strong> ${escapeHtml(t.agency)} (${escapeHtml(t.country)})<br>`,
            `<strong>Deadline:</strong> ${t.deadline ?? 'N/A'} (${daysUntil(t.deadline)})<br>`,
            t.estimatedValueUSD ? `<strong>Estimated value:</strong> ~$${(t.estimatedValueUSD as number).toLocaleString('en-US')}<br>` : '',
            `<strong>Score:</strong> ${t.overallScore}/100<br>`,
            `<strong>Source:</strong> <a href="${escapeHtml(t.sourceUrl)}">${escapeHtml(t.sourceUrl)}</a></p>`,
            `<h3>Product matches</h3><ul>${matchesHtml}</ul>`,
            `<h3>Description</h3><p>${escapeHtml(t.description ?? '').replace(/\n/g, '<br>')}</p>`,
            `</section>`,
        ].join('\n'));
    }

    if (rows.length === 0) {
        return { status: 'skipped', count: 0 };
    }

    const subject = `[Tender Watch] ${rows.length} high-priority tender${rows.length === 1 ? '' : 's'}`;
    const html = `<h1>Tender Watch - high priority</h1>\n${rows.join('\n<hr>\n')}`;
    await sendEmail(subject, html, apiKey);
    return { status: 'sent', count: rows.length };
}
