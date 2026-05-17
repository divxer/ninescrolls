import { useState, useEffect } from 'react';
import { useKeywordConfigs } from '../../hooks/useKeywordConfigs';
import { KeywordConfigSidebar } from '../../components/admin/KeywordConfigSidebar';
import { KeywordConfigEditor, type ConfigFormState } from '../../components/admin/KeywordConfigEditor';
import { KeywordConfigTestPanel } from '../../components/admin/KeywordConfigTestPanel';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

function emptyFormState(category: string): ConfigFormState {
    return {
        productCategory: category,
        productSlugs: [],
        keywords: [],
        synonyms: [],
        blacklist: [],
        naicsCodes: [],
        cpvCodes: [],
        isActive: true,
    };
}

export function TenderKeywordConfigPage() {
    const { data: configs, loading, refresh } = useKeywordConfigs(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [formState, setFormState] = useState<ConfigFormState | null>(null);
    const [serverState, setServerState] = useState<ConfigFormState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!selectedCategory && configs.length > 0) {
            setSelectedCategory(configs[0].productCategory);
        }
    }, [configs, selectedCategory]);

    useEffect(() => {
        if (!selectedCategory) return;
        const found = configs.find((c: any) => c.productCategory === selectedCategory);
        if (found) {
            const initial: ConfigFormState = {
                productCategory: found.productCategory,
                productSlugs: found.productSlugs ?? [],
                keywords: found.keywords ?? [],
                synonyms: found.synonyms ?? [],
                blacklist: found.blacklist ?? [],
                naicsCodes: found.naicsCodes ?? [],
                cpvCodes: found.cpvCodes ?? [],
                isActive: found.isActive ?? true,
            };
            setFormState(initial);
            setServerState(initial);
        }
    }, [selectedCategory, configs]);

    const isDirty = !!(formState && serverState && JSON.stringify(formState) !== JSON.stringify(serverState));

    function newCategory() {
        const name = prompt('New category name (immutable; used as PK):');
        if (!name?.trim()) return;
        if (configs.some((c: any) => c.productCategory === name)) {
            notify.error('Category already exists');
            return;
        }
        const fresh = emptyFormState(name.trim());
        setSelectedCategory(name.trim());
        setFormState(fresh);
        setServerState(emptyFormState(name.trim()));  // server doesn't have it yet, so any edit is "dirty"
    }

    async function save() {
        if (!formState) return;
        if (formState.keywords.length === 0 && formState.synonyms.length === 0) {
            notify.error('At least one keyword or synonym is required');
            return;
        }
        if (formState.productSlugs.length === 0) {
            notify.error('At least one linked product slug is required');
            return;
        }
        setBusy(true);
        try {
            await svc.upsertKeywordConfig(formState);
            notify.success('Saved — takes effect on next daily run');
            refresh();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally { setBusy(false); }
    }

    return (
        <div>
            <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Tender Watch</p>
                <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter">Keyword config</h1>
            </div>
            {loading && <div className="text-sm text-on-surface-variant">Loading configs…</div>}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
                    <KeywordConfigSidebar
                        configs={configs}
                        selectedCategory={selectedCategory}
                        onSelect={(cat) => {
                            if (isDirty && !confirm('Discard unsaved changes?')) return;
                            setSelectedCategory(cat);
                        }}
                        onNew={newCategory}
                    />
                    <div>
                        {formState && (
                            <>
                                <KeywordConfigEditor initial={formState} onChange={setFormState} isDirty={isDirty} />
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        onClick={save}
                                        disabled={busy || !isDirty}
                                        className="px-4 py-1.5 text-sm rounded-md bg-primary text-on-primary disabled:opacity-50"
                                    >
                                        {busy ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                                <KeywordConfigTestPanel formState={formState} />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
