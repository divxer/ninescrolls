import { useState, KeyboardEvent, ClipboardEvent } from 'react';

interface Props {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    validate?: (term: string) => boolean;
}

export function TagInput({ value, onChange, placeholder, validate }: Props) {
    const [draft, setDraft] = useState('');

    function commit(raw: string) {
        const term = raw.trim();
        if (!term) return;
        if (validate && !validate(term)) return;
        if (value.includes(term)) return;
        onChange([...value, term]);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            setDraft('');
        } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const next = e.target.value;
        // Auto-commit when user types ', ' (comma + space)
        if (next.endsWith(', ')) {
            commit(next.slice(0, -2));
            setDraft('');
        } else {
            setDraft(next);
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        const text = e.clipboardData.getData('text');
        if (text.includes('\n') || text.includes(', ')) {
            e.preventDefault();
            const parts = text.split(/\n|,\s/).map((p) => p.trim()).filter(Boolean);
            const additions = parts.filter((p) => !value.includes(p) && (!validate || validate(p)));
            onChange([...value, ...additions]);
            setDraft('');
        }
    }

    function remove(idx: number) {
        onChange([...value.slice(0, idx), ...value.slice(idx + 1)]);
    }

    return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-outline-variant bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary">
            {value.map((t, i) => (
                <span key={`${t}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-xs font-medium text-on-secondary-container">
                    {t}
                    <button type="button" onClick={() => remove(i)} className="text-on-secondary-container/70 hover:text-on-secondary-container">×</button>
                </span>
            ))}
            <input
                type="text"
                value={draft}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={value.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
            />
        </div>
    );
}
