import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsCases, useLogisticsStats } from '../../hooks/useLogisticsCases';
import { StageBadge, CustomsBadge } from '../../components/admin/StageBadge';
import {
  CASE_TYPES, CASE_TYPE_LABELS, LOGISTICS_STAGES, STAGE_LABELS,
  parseStatBucket, type CustomsStatus,
} from '../../types/logistics';

const SEARCH_DEBOUNCE_MS = 300;

function worstLegCustoms(legs?: { customsStatus?: CustomsStatus | null }[] | null): CustomsStatus | null {
  if (!legs?.length) return null;
  const order: CustomsStatus[] = ['HELD', 'EXAM', 'FILED', 'DOCS_READY', 'DUTIES_PAID', 'RELEASED', 'CLEARED', 'NOT_REQUIRED'];
  for (const s of order) if (legs.some((l) => l.customsStatus === s)) return s;
  return null;
}

export function LogisticsCaseListPage() {
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>('All');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [customsFilter, setCustomsFilter] = useState<string>('All'); // All | Customs | None
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { cases, loading, loadingMore, hasMore, error, loadMore } = useLogisticsCases({
    caseType: caseTypeFilter === 'All' ? undefined : caseTypeFilter,
    stage: stageFilter === 'All' ? undefined : stageFilter,
    customsRequired: customsFilter === 'All' ? undefined : customsFilter === 'Customs',
    search: debouncedSearch || undefined,
  });
  const { stats } = useLogisticsStats();

  const byType = useMemo(() => parseStatBucket(stats?.byType), [stats]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Logistics Cases</h1>
        <Link to="/admin/logistics/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          <span className="material-symbols-rounded text-[18px]">add</span> New Case
        </Link>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={stats?.totalActive ?? 0} />
        <StatTile label="In Customs" value={stats?.customsInProgress ?? 0} />
        <StatTile label="Stalled >14d" value={stats?.stalledCases ?? 0} />
        <StatTile label="Total cases" value={Object.values(byType).reduce((a, b) => a + b, 0)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          value={caseTypeFilter} onChange={setCaseTypeFilter}
          options={['All', ...CASE_TYPES]} labelFor={(o) => (o === 'All' ? 'All' : CASE_TYPE_LABELS[o as keyof typeof CASE_TYPE_LABELS])}
        />
        <select aria-label="Filter by stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
          <option value="All">All stages</option>
          {LOGISTICS_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select aria-label="Filter by customs" value={customsFilter} onChange={(e) => setCustomsFilter(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
          <option value="All">All</option><option value="Customs">Customs</option><option value="None">No customs</option>
        </select>
        <input
          aria-label="Search cases"
          value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search case #, customer, contact, order…"
          className="flex-1 min-w-[220px] rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-error">Failed to load: {error.message}</p>}
      {loading ? <p className="text-on-surface-variant">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container text-left text-xs uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Case #</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Customer</th><th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Customs</th><th className="px-4 py-3">Legs</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {cases.map((c) => {
                const customs = worstLegCustoms(c.legs);
                return (
                <tr key={c.caseId} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/admin/logistics/${c.caseId}`} className="text-primary hover:underline">{c.caseNumber}</Link>
                  </td>
                  <td className="px-4 py-3">{CASE_TYPE_LABELS[c.caseType]}</td>
                  <td className="px-4 py-3">
                    <div>{c.customerName}</div>
                    {c.contactName && <div className="text-xs text-on-surface-variant">{c.contactName}</div>}
                  </td>
                  <td className="px-4 py-3"><StageBadge stage={c.currentStage} /></td>
                  <td className="px-4 py-3">
                    {c.customsRequired
                      ? (customs
                          ? <CustomsBadge status={customs} />
                          : <span className="text-xs text-on-surface-variant">required</span>)
                      : <span className="text-xs text-on-surface-variant">—</span>}
                  </td>
                  <td className="px-4 py-3">{c.legs?.length ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(c.updatedAt).toLocaleDateString('en-US')}</td>
                </tr>
                );
              })}
              {!cases.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">No logistics cases.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="mx-auto block rounded-full border border-outline-variant px-4 py-2 text-sm">
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="text-2xl font-bold text-on-surface">{value}</div>
      <div className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</div>
    </div>
  );
}

function FilterChips({ value, onChange, options, labelFor }: {
  value: string; onChange: (v: string) => void; options: string[]; labelFor: (o: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${value === o ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
          {labelFor(o)}
        </button>
      ))}
    </div>
  );
}
