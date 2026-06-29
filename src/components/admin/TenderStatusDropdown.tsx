import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import { TenderStatusChangeDialog } from './TenderStatusChangeDialog';

const STATUSES = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'] as const;
const NOTE_REQUIRED = new Set(['not_relevant', 'lost']);

// Tender records come from Amplify with no shared domain type; describe just the
// fields this dropdown reads.
interface TenderRecord {
    tenderId: string;
    status?: string | null;
}

interface Props {
    tender: TenderRecord;
    onUpdated: () => void;
}

export function TenderStatusDropdown({ tender, onUpdated }: Props) {
    const [pending, setPending] = useState<string | null>(null);

    async function applyStatus(toStatus: string, note?: string) {
        try {
            await svc.updateTenderStatus({ tenderId: tender.tenderId, toStatus, note });
            notify.success(`Status → ${toStatus}`);
            onUpdated();
        } catch (err) {
            const msg = String((err as { message?: string })?.message ?? err);
            if (/Conflict/i.test(msg)) {
                notify.error('Tender was modified by another user — refreshing.');
                onUpdated();
            } else {
                notify.error(`Failed: ${msg}`);
            }
        }
    }

    function handleChange(toStatus: string) {
        if (toStatus === tender.status) return;
        if (NOTE_REQUIRED.has(toStatus)) {
            setPending(toStatus);
        } else {
            void applyStatus(toStatus);
        }
    }

    return (
        <>
            <select
                value={tender.status ?? 'new'}
                onChange={(e) => handleChange(e.target.value)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant uppercase tracking-wider border border-outline-variant/30"
            >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
        </>
    );
}
