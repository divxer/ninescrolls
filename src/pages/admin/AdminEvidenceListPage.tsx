import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllEvidence, deleteEvidence } from '../../services/evidenceAdminService';
import { EVIDENCE_STATUS, EVIDENCE_TYPE_ORDER, evidenceTypeLabel } from '../../config/evidence';

interface Row { id: string; title: string; type: string; status: string; products?: (string | null)[] | null; }

export function AdminEvidenceListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try { setRows((await listAllEvidence()) as Row[]); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (typeFilter === 'all' || r.type === typeFilter) && (statusFilter === 'all' || r.status === statusFilter)),
    [rows, typeFilter, statusFilter]
  );

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this evidence record?')) return;
    await deleteEvidence(id);
    await load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evidence</h1>
        <Link to="/admin/evidence/new" className="rounded bg-sky-600 px-4 py-2 text-white">New evidence</Link>
      </div>
      <div className="mt-4 flex gap-4">
        <label className="flex items-center gap-2"><span>Filter by type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><span>Filter by status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
            <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
            <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
          </select>
        </label>
      </div>
      {loading ? <p className="mt-6">Loading…</p> : (
        <table className="mt-6 w-full text-left">
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td><Link to={`/admin/evidence/${r.id}/edit`}>{r.title}</Link></td>
                <td>{evidenceTypeLabel(r.type)}</td>
                <td>{r.status}</td>
                <td>{(r.products ?? []).filter(Boolean).join(', ')}</td>
                <td><button onClick={() => handleDelete(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
