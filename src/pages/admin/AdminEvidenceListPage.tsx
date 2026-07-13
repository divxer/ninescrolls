import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [pageNum, setPageNum] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Make the background content inert while the modal panel is open, so Tab /
  // AT / mouse cannot reach it — the keyboard side is also trapped in the panel.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (openId) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [openId]);

  async function load() {
    setLoading(true); setError(null);
    try { setRows((await listAllEvidence()) as EvidenceRecord[]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load evidence.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const view = useMemo(
    () => applyListView(rows, { search, typeFilter, statusFilter, sortKey, sortDir }),
    [rows, search, typeFilter, statusFilter, sortKey, sortDir]
  );
  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = view.slice(start, start + PAGE_SIZE);
  const openRecord = rows.find((r) => r.id === openId) ?? null;

  // Changing the view resets pagination and clears selection so a bulk action
  // can never hit a now-hidden record.
  function resetView() { setPageNum(1); setSelected(new Set()); }
  function changeSearch(v: string) { setSearch(v); resetView(); }
  function changeType(v: string) { setTypeFilter(v); resetView(); }
  function changeStatus(v: string) { setStatusFilter(v); resetView(); }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    resetView();
  }

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) pageRows.forEach((r) => n.delete(r.id));
      else pageRows.forEach((r) => n.add(r.id));
      return n;
    });
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this evidence record?')) return;
    setError(null);
    try {
      await deleteEvidence(id);
      setOpenId(null);
      await load();
      // The deleted row's trigger button is gone; put focus somewhere stable
      // instead of letting it fall to document.body.
      searchRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete evidence.');
    }
  }
  async function archiveSelected() {
    if (selected.size === 0) return;
    setBusy(true); setError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => setEvidenceStatus(id, EVIDENCE_STATUS.ARCHIVED)));
    const failed = ids.filter((_, i) => results[i].status === 'rejected');
    setSelected(new Set(failed));
    // load() clears error at its start, so refresh first and only then
    // surface the archive failure — otherwise load() wipes the message.
    await load();
    if (failed.length) setError(`Failed to archive ${failed.length} of ${ids.length} record(s). Retry the remaining selection.`);
    setBusy(false);
  }

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      scope="col"
      aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="py-2 text-left font-medium text-on-surface-variant"
    >
      <button type="button" onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-on-surface">
        {label} <span aria-hidden>{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  const rangeStart = view.length === 0 ? 0 : start + 1;
  const rangeEnd = start + pageRows.length;

  return (
    <div className="p-6">
      <div ref={contentRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">Evidence</h1>
          <p className="text-sm text-on-surface-variant">{view.length} records</p>
        </div>
        <Link to="/admin/evidence/new" className="rounded bg-sky-600 px-4 py-2 text-white">New evidence</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={searchRef} value={search} onChange={(e) => changeSearch(e.target.value)} aria-label="Search evidence" placeholder="Search titles, types, or products..." className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2" />
        <label className="flex items-center gap-2 text-sm"><span>Type</span>
          <select value={typeFilter} onChange={(e) => changeType(e.target.value)} className="rounded border border-slate-300 px-2 py-2">
            <option value="all">All types</option>
            {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><span>Status</span>
          <select value={statusFilter} onChange={(e) => changeStatus(e.target.value)} className="rounded border border-slate-300 px-2 py-2">
            <option value="all">All status</option>
            <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
            <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
            <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
          </select>
        </label>
        <button onClick={archiveSelected} disabled={selected.size === 0 || busy} className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Archive selected</button>
      </div>

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}

      {loading ? <p className="mt-6">Loading…</p> : (
        <>
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="w-10 py-2"><input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={toggleAll} /></th>
                <SortHead label="Title" k="title" />
                <SortHead label="Type" k="type" />
                <SortHead label="Status" k="status" />
                <SortHead label="Products" k="products" />
                <SortHead label="Last updated" k="updatedAt" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3"><input type="checkbox" aria-label={`Select ${r.title}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                  <td className="py-3 pr-4">
                    <button type="button" onClick={() => setOpenId(r.id)} className="text-left font-medium text-on-surface hover:text-sky-700">{r.title}</button>
                  </td>
                  <td className="py-3 pr-4"><span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{evidenceTypeLabel(r.type)}</span></td>
                  <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                  <td className="py-3 pr-4 text-sky-600">{(r.products ?? []).filter(Boolean).join(', ')}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm text-on-surface-variant">
            <span>{rangeStart}–{rangeEnd} of {view.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">Previous</button>
              <span>Page {safePage} of {totalPages}</span>
              <button type="button" onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
      </div>

      {openRecord && <EvidenceDetailPanel record={openRecord} onClose={() => setOpenId(null)} onDelete={handleDelete} />}
    </div>
  );
}
