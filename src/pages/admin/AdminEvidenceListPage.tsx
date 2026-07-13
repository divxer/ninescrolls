import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllEvidence, deleteEvidence, setEvidenceStatus } from '../../services/evidenceAdminService';
import { EVIDENCE_STATUS, EVIDENCE_TYPE_ORDER, evidenceTypeLabel } from '../../config/evidence';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { EvidenceDetailPanel } from '../../components/admin/EvidenceDetailPanel';
import { applyListView, EvidenceRecord, SortDir, SortKey } from './evidenceListModel';

const PAGE_SIZE = 25;

export function AdminEvidenceListPage() {
  const [rows, setRows] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows((await listAllEvidence()) as EvidenceRecord[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evidence.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const view = useMemo(
    () => applyListView(rows, { search, typeFilter, statusFilter, sortKey, sortDir }),
    [rows, search, typeFilter, statusFilter, sortKey, sortDir]
  );
  const page = view.slice(0, PAGE_SIZE);
  const openRecord = rows.find((r) => r.id === openId) ?? null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === page.length ? new Set() : new Set(page.map((r) => r.id))));
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this evidence record?')) return;
    setError(null);
    try { await deleteEvidence(id); setOpenId(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete evidence.'); }
  }
  async function archiveSelected() {
    if (selected.size === 0) return;
    setBusy(true); setError(null);
    try {
      for (const id of selected) await setEvidenceStatus(id, EVIDENCE_STATUS.ARCHIVED);
      setSelected(new Set());
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to archive evidence.'); }
    finally { setBusy(false); }
  }

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="cursor-pointer select-none py-2 text-left font-medium text-on-surface-variant" onClick={() => toggleSort(k)}>
      {label} {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </th>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">Evidence</h1>
          <p className="text-sm text-on-surface-variant">{view.length} records</p>
        </div>
        <Link to="/admin/evidence/new" className="rounded bg-sky-600 px-4 py-2 text-white">New evidence</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles, types, or products..."
          className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm"><span>Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-2">
            <option value="all">All types</option>
            {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-2">
            <option value="all">All status</option>
            <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
            <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
            <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
          </select>
        </label>
        <button
          onClick={archiveSelected}
          disabled={selected.size === 0 || busy}
          className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >Archive selected</button>
      </div>

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}

      {loading ? <p className="mt-6">Loading…</p> : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="w-10 py-2"><input type="checkbox" aria-label="Select all" checked={page.length > 0 && selected.size === page.length} onChange={toggleAll} /></th>
              <SortHead label="Title" k="title" />
              <SortHead label="Type" k="type" />
              <SortHead label="Status" k="status" />
              <SortHead label="Products" k="products" />
              <SortHead label="Last updated" k="updatedAt" />
            </tr>
          </thead>
          <tbody>
            {page.map((r) => (
              <tr key={r.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setOpenId(r.id)}>
                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${r.title}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                </td>
                <td className="py-3 pr-4 font-medium text-on-surface">{r.title}</td>
                <td className="py-3 pr-4"><span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{evidenceTypeLabel(r.type)}</span></td>
                <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                <td className="py-3 pr-4 text-sky-600">{(r.products ?? []).filter(Boolean).join(', ')}</td>
                <td className="py-3 pr-4 text-on-surface-variant">{r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openRecord && (
        <EvidenceDetailPanel record={openRecord} onClose={() => setOpenId(null)} onDelete={handleDelete} />
      )}
    </div>
  );
}
