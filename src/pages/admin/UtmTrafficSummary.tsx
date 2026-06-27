import { useMemo, useState } from 'react';
import {
  summarizeUtmTraffic,
  type UtmEvent,
  type UtmFilter,
  type UtmGroupBy,
  type UtmSummaryRow,
} from '../../services/behaviorAnalytics';

type SortCol = 'value' | 'visits' | 'visitors' | 'knownOrganizations';

interface Props {
  events: UtmEvent[];
  groupBy: UtmGroupBy;
  onGroupByChange: (g: UtmGroupBy) => void;
  filter: UtmFilter;
  onFilterChange: (f: UtmFilter) => void;
}

const GROUP_OPTIONS: { key: UtmGroupBy; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'content', label: 'Content' },
];

export function UtmTrafficSummary({ events, groupBy, onGroupByChange, filter, onFilterChange }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'visits', dir: 'desc' });

  const rows = useMemo(() => summarizeUtmTraffic(events, groupBy, filter), [events, groupBy, filter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.value.toLowerCase().includes(q)) : rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.col === 'value') return a.value.localeCompare(b.value) * dir;
      return (a[sort.col] - b[sort.col]) * dir;
    });
  }, [rows, search, sort]);

  const toggleSort = (col: SortCol) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));

  const rowClick = (r: UtmSummaryRow) =>
    onFilterChange({ ...filter, [groupBy]: r.isNotSet ? null : r.value });

  const removeChip = (key: keyof UtmFilter) => {
    const next = { ...filter };
    delete next[key];
    onFilterChange(next);
  };

  const chips = (Object.keys(filter) as (keyof UtmFilter)[]).filter((k) => filter[k] !== undefined);

  const header = (col: SortCol, label: string, align: 'left' | 'right') => (
    <th
      className={`px-3 py-2 text-xs font-bold text-on-surface-variant cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => toggleSort(col)}
    >
      {label}{sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="bg-surface rounded-xl border border-outline-variant p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">sell</span> UTM Traffic Summary
        </h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
            {GROUP_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => onGroupByChange(o.key)}
                className={`px-3 py-1 text-xs font-medium ${groupBy === o.key ? 'bg-primary-fixed text-primary' : 'text-on-surface-variant'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="text-xs px-2 py-1 rounded border border-outline-variant bg-surface-container"
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {chips.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 text-[11px] rounded px-2 py-0.5" style={{ background: '#ede7f6', color: '#5e35b1' }}>
              {k} = {filter[k] === null ? '(not set)' : filter[k]}
              <button onClick={() => removeChip(k)} aria-label={`remove ${k} filter`} className="material-symbols-outlined text-[12px]">close</button>
            </span>
          ))}
          <button onClick={() => onFilterChange({})} className="text-[11px] text-primary underline">Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-6 text-center">暂无 UTM 流量，部署后带 UTM 的新流量才会出现。</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-6 text-center">No matching UTM rows.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              {header('value', GROUP_OPTIONS.find((o) => o.key === groupBy)!.label, 'left')}
              {header('visits', 'Visits', 'right')}
              {header('visitors', 'Visitors', 'right')}
              {header('knownOrganizations', 'Known Orgs', 'right')}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.value}
                onClick={() => rowClick(r)}
                className="border-b border-outline-variant/50 hover:bg-surface-container cursor-pointer"
              >
                <td className={`px-3 py-2 text-sm ${r.isNotSet ? 'text-on-surface-variant italic' : 'text-on-surface font-medium'}`}>{r.value}</td>
                <td className="px-3 py-2 text-sm text-right">{r.visits}</td>
                <td className="px-3 py-2 text-sm text-right">{r.visitors}</td>
                <td className="px-3 py-2 text-sm text-right">{r.knownOrganizations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
