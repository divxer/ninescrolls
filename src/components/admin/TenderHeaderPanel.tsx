import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import { TenderStatusChangeDialog } from './TenderStatusChangeDialog';

const STATUSES = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'] as const;
const NOTE_REQUIRED = new Set(['not_relevant', 'lost']);

interface Props {
    tender: any;
    onUpdated: () => void;
}

export function TenderHeaderPanel({ tender, onUpdated }: Props) {
    const [pending, setPending] = useState<string | null>(null);

    async function applyStatus(toStatus: string, note?: string, assignedTo?: string) {
        try {
            await svc.updateTenderStatus({ tenderId: tender.tenderId, toStatus, note, assignedTo });
            notify.success(`Status → ${toStatus}`);
            onUpdated();
        } catch (err: any) {
            const msg = String(err?.message ?? err);
            if (/Conflict/i.test(msg)) {
                notify.error('Tender modified by another user — refreshing.');
                onUpdated();
            } else {
                notify.error(`Failed: ${msg}`);
            }
        }
    }

    function handleStatusChange(toStatus: string) {
        if (toStatus === tender.status) return;
        if (NOTE_REQUIRED.has(toStatus)) setPending(toStatus);
        else void applyStatus(toStatus);
    }

    const score = tender.overallScore ?? 0;
    const scoreColor = score >= 80 ? 'text-error' : score >= 60 ? 'text-tertiary' : score >= 30 ? 'text-secondary' : 'text-on-surface-variant';

    return (
        <aside className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 lg:sticky lg:top-6 self-start">
            <h2 className="font-headline text-lg font-bold text-on-surface leading-snug">{tender.title}</h2>
            <p className="text-xs text-on-surface-variant mt-1">{tender.agency} {tender.country ? `· ${tender.country}` : ''}</p>
            <div className="mt-4 flex items-baseline gap-2">
                <span className={`text-3xl font-headline font-black ${scoreColor}`}>{score}</span>
                <span className="text-xs text-on-surface-variant">/100</span>
                {tender.isHighPriority && <span className="text-xs">🔥</span>}
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
                Deadline: {tender.deadline ? tender.deadline.slice(0, 10) : 'no deadline'}
            </p>
            <div className="mt-4 space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</label>
                <select
                    value={tender.status ?? 'new'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
                >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="mt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Assigned to</label>
                <input
                    type="text"
                    defaultValue={tender.assignedTo ?? ''}
                    onBlur={(e) => {
                        if (e.target.value !== (tender.assignedTo ?? '')) {
                            void applyStatus(tender.status ?? 'new', undefined, e.target.value || undefined);
                        }
                    }}
                    placeholder="username"
                    className="w-full px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
                />
            </div>
            <div className="mt-4 space-y-2">
                <a href={tender.sourceUrl} target="_blank" rel="noreferrer" className="block px-3 py-1.5 rounded-md text-xs text-center bg-primary text-on-primary hover:bg-primary/90">
                    View on {tender.source}
                </a>
                {tender.status !== 'not_relevant' && (
                    <button onClick={() => setPending('not_relevant')} className="block w-full px-3 py-1.5 rounded-md text-xs text-error border border-error hover:bg-error-container/30">
                        Mark not relevant
                    </button>
                )}
            </div>
            {(tender.naicsCodes?.length || tender.cpvCodes?.length) ? (
                <div className="mt-4 text-xs">
                    {tender.naicsCodes?.length > 0 && <div className="mb-1"><strong>NAICS:</strong> {tender.naicsCodes.join(', ')}</div>}
                    {tender.cpvCodes?.length > 0 && <div><strong>CPV:</strong> {tender.cpvCodes.join(', ')}</div>}
                </div>
            ) : null}
            {pending && (
                <TenderStatusChangeDialog
                    tenderId={tender.tenderId}
                    fromStatus={tender.status ?? 'new'}
                    toStatus={pending}
                    noteRequired
                    onConfirm={async (note) => { await applyStatus(pending, note); setPending(null); }}
                    onCancel={() => setPending(null)}
                />
            )}
        </aside>
    );
}
