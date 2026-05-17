import { useState } from 'react';

interface Props {
    tenderId: string;
    fromStatus: string;
    toStatus: string;
    noteRequired: boolean;
    onConfirm: (note: string | undefined) => Promise<void>;
    onCancel: () => void;
}

export function TenderStatusChangeDialog({ tenderId, fromStatus, toStatus, noteRequired, onConfirm, onCancel }: Props) {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const canConfirm = !noteRequired || note.trim().length >= 3;

    async function submit() {
        if (!canConfirm) return;
        setBusy(true);
        try { await onConfirm(note.trim() || undefined); }
        finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-scrim/50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl p-5 max-w-md w-full shadow-xl">
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
                    Change status: {fromStatus} → {toStatus}
                </h3>
                <p className="text-sm text-on-surface-variant mb-3">{tenderId}</p>
                <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-1 block">
                    {noteRequired ? <>Reason <span className="text-error">*</span></> : 'Note (optional)'}
                </label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface text-sm text-on-surface mb-4"
                    placeholder={noteRequired ? 'At least 3 characters required' : 'Anything noteworthy about this change'}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} disabled={busy} className="px-3 py-1.5 text-sm rounded-md border border-outline-variant text-on-surface hover:bg-surface-container-low">Cancel</button>
                    <button onClick={submit} disabled={!canConfirm || busy} className="px-3 py-1.5 text-sm rounded-md bg-primary text-on-primary disabled:opacity-50">Confirm</button>
                </div>
            </div>
        </div>
    );
}
