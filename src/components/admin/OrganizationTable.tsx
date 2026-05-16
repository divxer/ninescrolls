import { Link } from 'react-router-dom';

interface Props {
    items: any[];
}

function relativeTime(iso: string | undefined): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

const TYPE_STYLES: Record<string, string> = {
    'university': 'bg-blue-50 text-blue-700 ring-blue-200',
    'research-institute': 'bg-teal-50 text-teal-700 ring-teal-200',
    'company': 'bg-green-50 text-green-700 ring-green-200',
    'government': 'bg-purple-50 text-purple-700 ring-purple-200',
    'other': 'bg-gray-50 text-gray-700 ring-gray-200',
    'unknown': 'bg-stone-50 text-stone-700 ring-stone-200',
};

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
    active: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
    archived: { badge: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-on-surface-variant' },
    blocked: { badge: 'bg-error-container text-on-error-container', dot: 'bg-on-error-container' },
};

function TypeChip({ type }: { type: string }) {
    const style = TYPE_STYLES[type] ?? TYPE_STYLES.unknown;
    return (
        <span className={`inline-flex items-center rounded-full text-[10px] font-bold uppercase tracking-tighter px-2.5 py-1 ring-1 ring-inset ${style}`}>
            {type}
        </span>
    );
}

function OrgStatusChip({ status }: { status: string }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.archived;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter px-3 py-1 ${style.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {status}
        </span>
    );
}

function LeadScoreBar({ score }: { score: number }) {
    const value = Math.max(0, Math.min(100, score));
    let barColor = 'bg-on-surface-variant/40';
    if (value >= 75) barColor = 'bg-green-600';
    else if (value >= 50) barColor = 'bg-secondary';
    else if (value >= 25) barColor = 'bg-amber-500';
    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${value}%` }} />
            </div>
            <span className="font-headline font-semibold text-xs text-on-surface tabular-nums w-7 text-right">{value}</span>
        </div>
    );
}

export function OrganizationTable({ items }: Props) {
    if (!items.length) {
        return (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] p-10 md:p-16 text-center">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-5xl">domain_disabled</span>
                <p className="mt-3 text-sm font-medium text-on-surface-variant">No organizations match these filters.</p>
            </div>
        );
    }
    return (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-outline-variant/5">
                {items.map((org) => (
                    <Link
                        key={org.orgId}
                        to={`/admin/organizations/${org.orgId}`}
                        className="block p-4 hover:bg-primary-fixed/30 transition-colors no-underline"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-headline font-bold text-primary text-sm truncate pr-2">{org.displayName ?? org.orgId}</span>
                            <OrgStatusChip status={org.status} />
                        </div>
                        <div className="text-xs text-on-surface-variant italic mb-2">{org.primaryDomain}</div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <TypeChip type={org.type} />
                            <span className="text-[10px] text-on-surface-variant">{org.country ?? '—'}</span>
                        </div>
                        <LeadScoreBar score={org.leadScore ?? 0} />
                        <div className="flex items-center justify-between mt-2 text-[10px] text-on-surface-variant">
                            <span>{relativeTime(org.lastActivityAt)}</span>
                            <span>{org.ownerSalesRep ?? 'No owner'}</span>
                        </div>
                    </Link>
                ))}
            </div>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-left border-collapse">
                <thead>
                    <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Organization</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Domain</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Country</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Lead score</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Last activity</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Owner</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                    {items.map((org) => (
                        <tr
                            key={org.orgId}
                            className="hover:bg-primary-fixed/30 transition-colors group"
                        >
                            <td className="px-6 py-5">
                                <Link
                                    to={`/admin/organizations/${org.orgId}`}
                                    className="font-headline font-bold text-primary tracking-tight hover:underline"
                                >
                                    {org.displayName ?? org.orgId}
                                </Link>
                            </td>
                            <td className="px-6 py-5 text-on-surface-variant text-sm italic">{org.primaryDomain}</td>
                            <td className="px-6 py-5"><TypeChip type={org.type} /></td>
                            <td className="px-6 py-5 text-sm text-on-surface-variant">{org.country ?? '—'}</td>
                            <td className="px-6 py-5"><LeadScoreBar score={org.leadScore ?? 0} /></td>
                            <td className="px-6 py-5 text-sm text-on-surface-variant">{relativeTime(org.lastActivityAt)}</td>
                            <td className="px-6 py-5"><OrgStatusChip status={org.status} /></td>
                            <td className="px-6 py-5 text-sm text-on-surface">{org.ownerSalesRep ?? <span className="text-on-surface-variant/60 italic">—</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
