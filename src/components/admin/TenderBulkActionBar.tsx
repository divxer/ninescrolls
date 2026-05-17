import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

const BULK_TARGETS = ['reviewing', 'pursuing', 'not_relevant'] as const;

interface Props {
    selectedIds: string[];
    onCleared: () => void;
    onUpdated: () => void;
}

export function TenderBulkActionBar({ selectedIds, onCleared, onUpdated }: Props) {
    const [busy, setBusy] = useState(false);
    if (selectedIds.length === 0) return null;

    async function apply(target: string) {
        setBusy(true);
        try {
            const count = await svc.bulkUpdateTenderStatus({ tenderIds: selectedIds, toStatus: target });
            notify.success(`${count}/${selectedIds.length} tenders → ${target}`);
            onUpdated();
            onCleared();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="sticky bottom-3 mx-auto mt-4 max-w-2xl bg-surface-container-high rounded-full px-4 py-2 shadow-lg border border-outline-variant flex items-center gap-3">
            <span className="text-sm font-medium text-on-surface">{selectedIds.length} selected</span>
            <span className="flex-1" />
            {BULK_TARGETS.map((t) => (
                <button
                    key={t}
                    onClick={() => apply(t)}
                    disabled={busy}
                    className="px-3 py-1 text-xs rounded-full bg-primary text-on-primary disabled:opacity-50 hover:bg-primary/90"
                >
                    → {t}
                </button>
            ))}
            <button onClick={onCleared} className="px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface">Clear</button>
        </div>
    );
}
