import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRfqs } from '../../hooks/useRfqs';
import { StatsBar } from '../../components/admin/StatsBar';
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
    return [
      { label: 'Pending', value: pending, color: '#7c3aed' },
      { label: 'Converted', value: converted, color: '#16a34a' },
      { label: 'Declined', value: declined, color: '#6b7280' },
      { label: 'Conversion Rate', value: `${rate}%` },
    ];
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

  if (loading) return <div className="admin-loading">Loading RFQs...</div>;
  if (error) return <div className="admin-error">Error: {error.message}</div>;

  return (
    <div className="admin-insights-list">
      <div className="admin-list-header">
        <h1>RFQ Management ({rfqs.length})</h1>
      </div>

      <StatsBar stats={stats} />

      <div className="admin-list-filters">
        <input
          type="text"
          placeholder="Search by name, institution, equipment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter-select"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Institution</th>
            <th>Equipment</th>
            <th>Budget</th>
            <th>Timeline</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(rfq => (
            <tr key={rfq.rfqId} className={rfq.status === 'pending' ? 'row-highlight-purple' : rfq.status === 'declined' ? 'row-muted' : ''}>
              <td>{formatDate(rfq.submittedAt)}</td>
              <td>{rfq.name || '-'}</td>
              <td>{rfq.institution || '-'}</td>
              <td>{rfq.equipmentCategory}{rfq.specificModel ? ` / ${rfq.specificModel}` : ''}</td>
              <td>{rfq.budgetRange || '-'}</td>
              <td>{rfq.timeline || '-'}</td>
              <td><StatusBadge status={rfq.status} /></td>
              <td className="admin-actions">
                <Link to={`/admin/rfqs/${rfq.rfqId}`} className="admin-btn-sm">
                  View
                </Link>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="admin-no-results">No RFQs found.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Mobile RFQ cards — visible only at ≤480px */}
      <div className="mobile-cards rfq-cards-mobile">
        {filtered.length === 0 ? (
          <div className="admin-no-results" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No RFQs found.
          </div>
        ) : (
          filtered.map(rfq => (
            <Link
              key={rfq.rfqId}
              to={`/admin/rfqs/${rfq.rfqId}`}
              className={`rfq-card-mobile${rfq.status === 'pending' ? ' rfq-card-pending' : rfq.status === 'converted' ? ' rfq-card-converted' : rfq.status === 'declined' ? ' rfq-card-declined' : ''}`}
            >
              <div className="rfq-card-header">
                <span className="rfq-card-name">{rfq.name || 'Unknown'}</span>
                <StatusBadge status={rfq.status} />
              </div>
              <div className="rfq-card-institution">{rfq.institution || '—'}</div>
              <div className="rfq-card-equipment">
                {rfq.equipmentCategory}{rfq.specificModel ? ` / ${rfq.specificModel}` : ''}
              </div>
              <div className="rfq-card-footer">
                <span>{formatDate(rfq.submittedAt)}</span>
                <span>{rfq.budgetRange || ''}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
