import { useState, useEffect } from 'react';
import { TagInput } from './TagInput';

export interface ConfigFormState {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
}

interface Props {
    initial: ConfigFormState;
    onChange: (next: ConfigFormState) => void;
    isDirty: boolean;
}

export function KeywordConfigEditor({ initial, onChange, isDirty }: Props) {
    const [state, setState] = useState(initial);

    useEffect(() => { setState(initial); }, [initial]);

    function update<K extends keyof ConfigFormState>(field: K, value: ConfigFormState[K]) {
        const next = { ...state, [field]: value };
        setState(next);
        onChange(next);
    }

    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-headline text-base font-bold text-on-surface">{state.productCategory}</h3>
                <label className="flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={state.isActive}
                        onChange={(e) => update('isActive', e.target.checked)}
                    />
                    isActive
                </label>
            </div>
            {isDirty && <div className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container text-xs rounded">Unsaved changes</div>}

            {(['productSlugs', 'keywords', 'synonyms', 'blacklist', 'naicsCodes', 'cpvCodes'] as const).map((field) => (
                <div key={field}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{field}</label>
                    <TagInput
                        value={state[field] as string[]}
                        onChange={(v) => update(field, v as any)}
                        placeholder={`Add ${field}...`}
                    />
                </div>
            ))}
        </div>
    );
}
