import type { ListOrgFilters } from '../../services/organizationAdminService';

interface Props {
    filters: ListOrgFilters;
    onChange: (next: ListOrgFilters) => void;
}

const TYPE_OPTIONS = ['university', 'research-institute', 'company', 'government', 'other', 'unknown'];

export function OrganizationFilterBar({ filters, onChange }: Props) {
    return (
        <div className="filter-bar">
            <input
                type="text"
                placeholder="Search displayName / domain..."
                value={filters.search ?? ''}
                onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            />
            <select
                value={(filters.types ?? [])[0] ?? ''}
                onChange={(e) => onChange({ ...filters, types: e.target.value ? [e.target.value] : undefined })}
            >
                <option value="">All types</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
                type="number"
                placeholder="Min lead score"
                value={filters.minLeadScore ?? ''}
                onChange={(e) => onChange({ ...filters, minLeadScore: e.target.value ? Number(e.target.value) : undefined })}
            />
            <select
                value={filters.sortBy ?? 'activity'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
            >
                <option value="activity">Sort: Recent activity</option>
                <option value="leadScore">Sort: Lead score</option>
                <option value="firstSeen">Sort: First seen</option>
            </select>
        </div>
    );
}
