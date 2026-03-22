import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRfqs } from '../../hooks/useRfqs';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { formatDate } from '../../types/admin';

const STATUS_OPTIONS = ['All', 'pending', 'converted', 'declined'];

export function RFQListPage() {
  const { rfqs, loading, error } = useRfqs();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const stats = useMemo(() => {
    const pending = rfqs.filter(r => r.status === 'pending').length;
    const converted = rfqs.filter(r => r.status === 'converted').length;
    const declined = rfqs.filter(r => r.status === 'declined').length;
    const total = converted + declined;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { pending, converted, declined, rate };
  }, [rfqs]);

  const filtered = useMemo(() => {
    let result = [...rfqs].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
    if (statusFilter !== 'All') {
      result = result.filter(r => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.institution?.toLowerCase().includes(q) ||
        r.equipmentCategory?.toLowerCase().includes(q) ||
        r.referenceNumber?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [rfqs, search, statusFilter]);

  if (loading) return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading RFQs...</div>;
  if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;

  return (
    <div>
      {/* Header area */}
      <div className="grid grid-cols-12 gap-8 mb-12">
        <div className="col-span-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Request Overview</p>
          <h1 className="font-headline text-5xl font-black text-on-surface tracking-tighter">RFQ Management</h1>
        </div>
        <div className="col-span-2">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Pending</p>
            <p className="font-headline text-4xl font-bold text-primary">{stats.pending}</p>
            <p className="text-xs text-secondary mt-1">{rfqs.length} total</p>
          </div>
        </div>
        <div className="col-span-2">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Conversion Rate</p>
            <p className="font-headline text-4xl font-bold text-primary">{stats.rate}%</p>
            <p className="text-xs text-secondary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              {stats.converted} converted
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                statusFilter === s
                  ? 'bg-surface-container text-on-surface'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search by name, institution, equipment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-low pl-10 pr-4 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 w-72"
            />
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Ref #</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Name</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Institution</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Category</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Budget</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Status</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(rfq => (
              <tr key={rfq.rfqId} className="border-t border-outline-variant/10 hover:bg-primary-fixed/30 transition-colors cursor-pointer group">
                <td className="px-4 py-3">
                  <span className="font-headline font-bold text-primary text-sm">{rfq.referenceNumber || rfq.rfqId.slice(0, 8)}</span>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">{formatDate(rfq.submittedAt)}</div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-on-surface">{rfq.name || '-'}</td>
                <td className="px-4 py-3 text-sm italic text-on-surface-variant">{rfq.institution || '-'}</td>
                <td className="px-4 py-3">
                  <span className="bg-surface-container px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant">
                    {rfq.equipmentCategory}{rfq.specificModel ? ` / ${rfq.specificModel}` : ''}
                  </span>
                </td>
                <td className="px-4 py-3 font-headline font-semibold text-sm text-on-surface">{rfq.budgetRange || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={rfq.status} /></td>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/rfqs/${rfq.rfqId}`}
                    className="text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-on-surface-variant text-sm">No RFQs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
