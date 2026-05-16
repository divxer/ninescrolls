import { useOrganizations } from '../../hooks/useOrganizations';
import { OrganizationKpiCards } from '../../components/admin/OrganizationKpiCards';
import { OrganizationFilterBar } from '../../components/admin/OrganizationFilterBar';
import { OrganizationTable } from '../../components/admin/OrganizationTable';

export function OrganizationListPage() {
    const { data, loading, error, filters, setFilters, refresh } = useOrganizations({});

    return (
        <div>
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 md:gap-8 mb-6 md:mb-10">
                <div className="col-span-12 md:col-span-8 flex flex-col justify-end">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Customer Intelligence</p>
                    <h1 className="font-headline text-3xl md:text-5xl font-black text-on-surface tracking-tighter">Organizations</h1>
                </div>
                <div className="col-span-12 md:col-span-4 flex md:justify-end items-end">
                    <button
                        onClick={refresh}
                        className="px-4 py-2 bg-surface-container-low text-on-surface-variant hover:bg-surface-container rounded-lg font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {data && (
                <OrganizationKpiCards
                    total={data.totalActiveCount ?? data.items.length}
                    highLeadScore={(data.items ?? []).filter((o: any) => (o.leadScore ?? 0) >= 50).length}
                    newThisWeek={(data.items ?? []).filter((o: any) => {
                        const seen = new Date(o.firstSeenAt ?? 0).getTime();
                        return seen >= Date.now() - 7 * 24 * 60 * 60 * 1000;
                    }).length}
                    withoutOwner={(data.items ?? []).filter((o: any) => !o.ownerSalesRep).length}
                    onClickKpi={(kpi) => {
                        if (kpi === 'highLeadScore') setFilters({ ...filters, minLeadScore: 50 });
                        else if (kpi === 'withoutOwner') setFilters({ ...filters, ownerSalesRep: undefined });
                        else if (kpi === 'all') setFilters({});
                    }}
                />
            )}

            <OrganizationFilterBar filters={filters} onChange={setFilters} />

            {loading && (
                <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading organizations...</div>
            )}
            {error && (
                <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body mb-6">Error: {error.message}</div>
            )}
            {data && <OrganizationTable items={data.items ?? []} />}
        </div>
    );
}
