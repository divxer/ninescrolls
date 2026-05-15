import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;
const NOTIFICATION_TO = 'info@ninescrolls.com';
const NOTIFICATION_FROM = { email: 'noreply@ninescrolls.com', name: 'NineScrolls' };

export interface NotifyHighPriorityEvent { highPriorityTenderIds: string[]; }
export interface NotifyResult { sent: number; failed: number; }

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function daysUntil(dateIso: string | null | undefined): string {
    if (!dateIso) return 'no deadline';
    const ms = new Date(dateIso).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    return `${days} day${Math.abs(days) === 1 ? '' : 's'}`;
}

async function sendEmail(subject: string, html: string, apiKey: string): Promise<boolean> {
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
    if (res.status === 202) return true;
    const body = await res.text().catch(() => '');
    console.error(JSON.stringify({ event: 'notify-high-priority.sendgrid.fail', status: res.status, body }));
    return false;
}

export async function handler(event: NotifyHighPriorityEvent): Promise<NotifyResult> {
    let sent = 0;
    let failed = 0;
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn(JSON.stringify({ event: 'notify-high-priority.no-api-key' }));
        return { sent: 0, failed: event.highPriorityTenderIds.length };
    }

    for (const tenderId of event.highPriorityTenderIds) {
        try {
            const meta = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderItemKey(tenderId) }));
            const t = meta.Item;
            if (!t) { failed += 1; continue; }

            const matches = await ddb.send(new QueryCommand({
                TableName: TABLE(),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: { ':pk': `TENDER#${tenderId}`, ':sk': 'MATCH#' },
            }));

            const subject = `🔥 [Tender Watch] ${t.country} · ${t.agency} · score ${t.overallScore}`;
            const matchesHtml = (matches.Items ?? []).map((m: Record<string, any>) =>
                `<li><strong>${escapeHtml(m.productSlug)}</strong> — ${m.score}/100<br><em>${escapeHtml(m.reasoning ?? '')}</em></li>`
            ).join('');

            const html = [
                `<h2>${escapeHtml(t.title)}</h2>`,
                `<p><strong>Agency:</strong> ${escapeHtml(t.agency)} (${escapeHtml(t.country)})<br>`,
                `<strong>Deadline:</strong> ${t.deadline ?? 'N/A'} (${daysUntil(t.deadline)})<br>`,
                t.estimatedValueUSD ? `<strong>Estimated value:</strong> ~$${(t.estimatedValueUSD as number).toLocaleString('en-US')}<br>` : '',
                `<strong>Score:</strong> ${t.overallScore}/100<br>`,
                `<strong>Source:</strong> <a href="${escapeHtml(t.sourceUrl)}">${escapeHtml(t.sourceUrl)}</a></p>`,
                `<h3>Product matches</h3><ul>${matchesHtml}</ul>`,
                `<h3>Description</h3><p>${escapeHtml(t.description ?? '').replace(/\n/g, '<br>')}</p>`,
            ].join('\n');

            const ok = await sendEmail(subject, html, apiKey);
            if (ok) sent += 1; else failed += 1;
        } catch (err) {
            console.error(JSON.stringify({ event: 'notify-high-priority.fail', tenderId, error: String(err) }));
            failed += 1;
        }
    }
    return { sent, failed };
}
