import type { ListOrgFilters } from '../../services/organizationAdminService';

interface Props {
    filters: ListOrgFilters;
    onChange: (next: ListOrgFilters) => void;
}

const TYPE_OPTIONS = ['university', 'research-institute', 'company', 'government', 'other', 'unknown'];

export function OrganizationFilterBar({ filters, onChange }: Props) {
    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] p-3 md:p-4 mb-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                <input
                    type="text"
                    placeholder="Search displayName / domain..."
                    value={filters.search ?? ''}
                    onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
                    className="bg-surface-container-low pl-10 pr-4 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 w-full"
                />
            </div>
            <select
                value={(filters.types ?? [])[0] ?? ''}
                onChange={(e) => onChange({ ...filters, types: e.target.value ? [e.target.value] : undefined })}
                className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
                <option value="">All types</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
                type="number"
                placeholder="Min lead score"
                value={filters.minLeadScore ?? ''}
                onChange={(e) => onChange({ ...filters, minLeadScore: e.target.value ? Number(e.target.value) : undefined })}
                className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-36"
            />
            <select
                value={filters.sortBy ?? 'activity'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
                className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
                <option value="activity">Sort: Recent activity</option>
                <option value="leadScore">Sort: Lead score</option>
                <option value="firstSeen">Sort: First seen</option>
            </select>
        </div>
    );
}
