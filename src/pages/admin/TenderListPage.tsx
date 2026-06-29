import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenders } from '../../hooks/useTenders';
import { TenderKpiCards } from '../../components/admin/TenderKpiCards';
import { TenderFilterBar } from '../../components/admin/TenderFilterBar';
import { TenderTable, type TenderRow } from '../../components/admin/TenderTable';
import { TenderBulkActionBar } from '../../components/admin/TenderBulkActionBar';
import * as svc from '../../services/tenderAdminService';
import type { ListTendersArgs } from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

export function TenderListPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // URL → filters (initial mount only)
    const initialFilters: ListTendersArgs = useMemo(() => ({
        statuses: searchParams.get('statuses')?.split(',').filter(Boolean) ?? undefined,
        countries: searchParams.get('countries')?.split(',').filter(Boolean) ?? undefined,
        minScore: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined,
        sortBy: (searchParams.get('sortBy') as ListTendersArgs['sortBy']) ?? undefined,
        sortDir: (searchParams.get('sortDir') as ListTendersArgs['sortDir']) ?? undefined,
        search: searchParams.get('search') ?? undefined,
        includeExpired: searchParams.get('includeExpired') === '1' || undefined,
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    const { data, loading, error, filters, setFilters, refresh } = useTenders(initialFilters);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    function toggleSelected(id: string) {
        setSelectedIds((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]);
    }

    async function exportCsv() {
        try {
            const blob = await svc.exportTendersAsCsv(filters);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tenders-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            notify.success('CSV downloaded');
        } catch (err) {
            notify.error(String((err as { message?: string })?.message ?? err));
        }
    }

    function updateFilters(next: ListTendersArgs) {
        setFilters(next);
        // Sync to URL
        const p = new URLSearchParams();
        if (next.statuses?.length) p.set('statuses', next.statuses.join(','));
        if (next.countries?.length) p.set('countries', next.countries.join(','));
        if (typeof next.minScore === 'number') p.set('minScore', String(next.minScore));
        if (next.sortBy) p.set('sortBy', next.sortBy);
        if (next.sortDir) p.set('sortDir', next.sortDir);
        if (next.search) p.set('search', next.search);
        if (next.includeExpired) p.set('includeExpired', '1');
        setSearchParams(p);
    }

    // Connection items are typed nullable by Amplify but are non-null in
    // practice; narrow to the table's row shape for KPI computation + rendering.
    const items = (data?.items ?? []) as TenderRow[];
    const totalActive = data?.totalActiveUnfiltered ?? items.length;

    // Compute KPI values client-side from the loaded page
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayNew = items.filter((i) => i.status === 'new' && (i.postedDate ?? '').slice(0, 10) === todayKey).length;
    const weekNew = items.filter((i) => {
        if (i.status !== 'new' || !i.postedDate) return false;
        return now - new Date(i.postedDate).getTime() <= 7 * 86400_000;
    }).length;
    const highPriority = items.filter((i) => (i.overallScore ?? 0) >= 80).length;
    const closingSoon = items.filter((i) => i.deadline && (new Date(i.deadline).getTime() - now) <= 7 * 86400_000).length;

    return (
        <div>
            <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Tender Watch</p>
                <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter">Tenders</h1>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-on-surface-variant">Showing {items.length} / ~{totalActive} active</span>
                    <Link to="/admin/tenders/keywords" className="text-xs text-primary hover:underline">⚙ Keyword config</Link>
                    <button onClick={refresh} className="text-xs text-primary hover:underline">↻ Refresh</button>
                    <button onClick={exportCsv} className="text-xs text-primary hover:underline">⬇ Export CSV</button>
                </div>
            </div>

            <TenderKpiCards
                todayNew={todayNew}
                weekNew={weekNew}
                highPriority={highPriority}
                closingSoon={closingSoon}
                onClick={(kpi) => {
                    if (kpi === 'todayNew') updateFilters({ ...filters, statuses: ['new'] });
                    else if (kpi === 'weekNew') updateFilters({ ...filters, statuses: ['new'] });
                    else if (kpi === 'highPriority') updateFilters({ ...filters, minScore: 80 });
                    // closingSoon — client-side concept, no server param yet
                }}
            />

            <TenderFilterBar filters={filters} onChange={updateFilters} />

            {loading && <div className="text-center py-8 text-sm text-on-surface-variant">Loading tenders…</div>}
            {error && <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-3 text-sm">{error.message}</div>}
            {data && <TenderTable items={items} selectedIds={selectedIds} onToggleSelected={toggleSelected} onRefresh={refresh} />}
            <TenderBulkActionBar selectedIds={selectedIds} onCleared={() => setSelectedIds([])} onUpdated={refresh} />
        </div>
    );
}
