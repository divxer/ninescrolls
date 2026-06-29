import { useState } from 'react';

// Audit log entries come from Amplify with no shared domain type; describe just
// the fields this component reads.
export interface TenderAuditEntry {
    changedAt?: string | null;
    changedBy?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    note?: string | null;
}

interface Props {
    log: TenderAuditEntry[];
}

export function TenderAuditLog({ log }: Props) {
    const [expanded, setExpanded] = useState(false);
    if (log.length === 0) {
        return <div className="text-xs text-on-surface-variant">No status changes yet.</div>;
    }
    const visible = expanded ? log : log.slice(0, 5);
    return (
        <div>
            <ul className="space-y-1 text-xs text-on-surface-variant">
                {visible.map((l, i) => (
                    <li key={`${l.changedAt}-${i}`}>
                        <span className="text-on-surface-variant">{l.changedAt?.slice(0, 16)?.replace('T', ' ')}</span>
                        {' · '}
                        <span className="font-medium text-on-surface">{l.changedBy}</span>
                        {' · '}
                        status: {l.fromStatus ?? '—'} → <strong className="text-on-surface">{l.toStatus}</strong>
                        {l.note && <> · <em>"{l.note}"</em></>}
                    </li>
                ))}
            </ul>
            {log.length > 5 && (
                <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-primary hover:underline">
                    {expanded ? 'Show fewer' : `Show all (${log.length})`}
                </button>
            )}
        </div>
    );
}
