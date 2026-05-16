import { useOrganizations } from '../../hooks/useOrganizations';
import { OrganizationKpiCards } from '../../components/admin/OrganizationKpiCards';
import { OrganizationFilterBar } from '../../components/admin/OrganizationFilterBar';
import { OrganizationTable } from '../../components/admin/OrganizationTable';

export function OrganizationListPage() {
    const { data, loading, error, filters, setFilters, refresh } = useOrganizations({});

    return (
        <div className="org-list-page">
            <h1>Organizations</h1>
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
            <button onClick={refresh}>Refresh</button>
            {loading && <div>Loading...</div>}
            {error && <div className="error">{error.message}</div>}
            {data && <OrganizationTable items={data.items ?? []} />}
        </div>
    );
}
