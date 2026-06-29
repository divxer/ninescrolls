import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import type { ConfigFormState } from './KeywordConfigEditor';

interface Props {
    formState: ConfigFormState;
}

// Shape of the prefilter preview result this panel renders. The service returns
// the AppSync mutation payload, which we narrow to the fields read here.
interface PrefilterPreviewResult {
    passed: boolean;
    matchedKeywords: string[];
}

export function KeywordConfigTestPanel({ formState }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [result, setResult] = useState<PrefilterPreviewResult | null>(null);
    const [busy, setBusy] = useState(false);

    async function run() {
        setBusy(true);
        try {
            const r = await svc.runPrefilterPreview({
                title,
                description,
                configOverride: formState,
            });
            setResult(r as PrefilterPreviewResult | null);
        } catch (err) {
            notify.error(String((err as { message?: string })?.message ?? err));
        } finally { setBusy(false); }
    }

    return (
        <div className="mt-4 bg-tertiary-container/30 rounded-xl border-2 border-dashed border-tertiary p-4">
            <h4 className="text-sm font-bold text-on-surface mb-2">⚡ Test match against this (unsaved) config</h4>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tender title…"
                className="w-full mb-2 px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tender description…"
                rows={3}
                className="w-full mb-2 px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <button onClick={run} disabled={busy || !title} className="px-3 py-1 text-xs rounded-md bg-primary text-on-primary disabled:opacity-50">
                {busy ? 'Testing…' : 'Run test'}
            </button>
            {result && (
                <div className={`mt-2 p-2 rounded text-xs ${result.passed ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                    {result.passed
                        ? <>✓ PASS · Matched: {result.matchedKeywords.join(', ')}</>
                        : <>✗ FAIL · No keyword matched</>}
                </div>
            )}
        </div>
    );
}
