import { useState, useEffect, useRef } from 'react';
import type { ListTendersArgs } from '../../services/tenderAdminService';

interface Props {
    filters: ListTendersArgs;
    onChange: (next: ListTendersArgs) => void;
}

const STATUS_OPTIONS = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'];

export function TenderFilterBar({ filters, onChange }: Props) {
    const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync from props if filters.search changes externally (e.g. URL navigation)
    useEffect(() => {
        setSearchDraft(filters.search ?? '');
    }, [filters.search]);

    function handleSearchChange(value: string) {
        setSearchDraft(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onChange({ ...filters, search: value || undefined });
        }, 300);
    }

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    return (
        <div className="flex flex-wrap gap-2 items-center mb-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
            <input
                type="text"
                value={searchDraft}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search title / agency..."
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <select
                value={(filters.statuses ?? [])[0] ?? ''}
                onChange={(e) => onChange({ ...filters, statuses: e.target.value ? [e.target.value] : undefined })}
                className="px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            >
                <option value="">All active</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
                type="number"
                value={filters.minScore ?? ''}
                onChange={(e) => onChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Min score"
                className="w-28 px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <select
                value={filters.sortBy ?? 'score'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as ListTendersArgs['sortBy'] })}
                className="px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            >
                <option value="score">Sort: Score</option>
                <option value="postedDate">Sort: Posted</option>
                <option value="deadline">Sort: Deadline</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-on-surface-variant">
                <input
                    type="checkbox"
                    checked={!!filters.includeExpired}
                    onChange={(e) => onChange({ ...filters, includeExpired: e.target.checked || undefined })}
                />
                Include expired
            </label>
        </div>
    );
}
