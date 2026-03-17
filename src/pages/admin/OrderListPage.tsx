import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { useOrderStats } from '../../hooks/useOrders';
import { StatsBar } from '../../components/admin/StatsBar';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ORDER_STATUSES, STATUS_LABELS, formatDate, type OrderStatus } from '../../types/admin';

export function OrderListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const { orders, loading, error } = useOrders(statusFilter === 'All' ? undefined : statusFilter);
  const { stats } = useOrderStats();
  const [search, setSearch] = useState('');

  const statsCards = useMemo(() => {
    if (!stats) return [];
    let parsed: unknown = stats.byStatus;
    while (typeof parsed === 'string') parsed = JSON.parse(parsed);
    const byStatus = (parsed || {}) as Record<string, number>;
    return [
      { label: 'Active Orders', value: stats.totalActive },
      { label: 'Quoting', value: byStatus['QUOTING'] || 0, color: '#2563eb' },
      { label: 'In Production', value: byStatus['IN_PRODUCTION'] || 0, color: '#d97706' },
      { label: 'Upcoming Deliveries', value: stats.upcomingDeliveries },
      { label: 'Overdue', value: stats.overdueOrders, color: stats.overdueOrders > 0 ? '#dc2626' : undefined },
    ];
  }, [stats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.institution.toLowerCase().includes(q) ||
      o.quoteNumber?.toLowerCase().includes(q) ||
      o.poNumber?.toLowerCase().includes(q) ||
      o.productModel.toLowerCase().includes(q) ||
      o.productName?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  if (loading) return <div className="admin-loading">Loading orders...</div>;
  if (error) return <div className="admin-error">Error: {error.message}</div>;

  return (
    <div className="admin-insights-list">
      <div className="admin-list-header">
        <h1>Order Tracker ({orders.length})</h1>
        <Link to="/admin/orders/new" className="admin-btn-primary">
          + New Order
        </Link>
      </div>

      {statsCards.length > 0 && <StatsBar stats={statsCards} />}

      <div className="admin-list-filters">
        <input
          type="text"
          placeholder="Search by institution, quote #, PO #, product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="All">All Status</option>
          {ORDER_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s as OrderStatus]}</option>
          ))}
        </select>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Quote # / PO #</th>
            <th>Institution</th>
            <th>Equipment</th>
            <th>Primary Contact</th>
            <th>Est. Delivery</th>
            <th>Days in Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(order => {
            const primaryContact = order.contacts?.find(c => c.isPrimary);
            const isOverdue = order.estimatedDelivery &&
              new Date(order.estimatedDelivery) < new Date() &&
              !['SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED'].includes(order.status);

            return (
              <tr
                key={order.orderId}
                className={
                  order.status === 'INQUIRY' ? 'row-highlight-purple' :
                  order.status === 'DECLINED' ? 'row-muted' :
                  isOverdue ? 'row-highlight-red' : ''
                }
                style={{ cursor: 'pointer' }}
                onClick={() => window.location.href = `/admin/orders/${order.orderId}`}
              >
                <td><StatusBadge status={order.status} /></td>
                <td>
                  {order.quoteNumber && <div>{order.quoteNumber}</div>}
                  {order.poNumber && <div style={{ fontSize: '0.85em', color: '#666' }}>{order.poNumber}</div>}
                  {!order.quoteNumber && !order.poNumber && '-'}
                </td>
                <td>{order.institution}</td>
                <td>
                  <div>{order.productModel}</div>
                  {order.productName && <div style={{ fontSize: '0.85em', color: '#666' }}>{order.productName}</div>}
                </td>
                <td>{primaryContact?.contactName || '-'}</td>
                <td>{formatDate(order.estimatedDelivery)}</td>
                <td>{order.daysSinceLastUpdate}d</td>
                <td>
                  {order.source === 'RFQ_WEBSITE' ? '🌐' : order.source === 'MANUAL' ? '✏️' : '📥'}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="admin-no-results">No orders found.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Mobile Order cards — visible only at ≤480px */}
      <div className="mobile-cards order-cards-mobile">
        {filtered.length === 0 ? (
          <div className="admin-no-results" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No orders found.
          </div>
        ) : (
          filtered.map(order => {
            const primaryContact = order.contacts?.find(c => c.isPrimary);
            const isOverdue = order.estimatedDelivery &&
              new Date(order.estimatedDelivery) < new Date() &&
              !['SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED'].includes(order.status);

            return (
              <div
                key={order.orderId}
                className={`order-card-mobile${
                  order.status === 'INQUIRY' ? ' order-card-inquiry' :
                  order.status === 'DECLINED' ? ' order-card-declined' :
                  isOverdue ? ' order-card-overdue' : ''
                }`}
                onClick={() => window.location.href = `/admin/orders/${order.orderId}`}
              >
                <div className="order-card-header">
                  <span className="order-card-institution">{order.institution}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="order-card-product">
                  {order.productModel}{order.productName ? ` - ${order.productName}` : ''}
                </div>
                <div className="order-card-meta">
                  {order.quoteNumber && <span>Q: {order.quoteNumber}</span>}
                  {order.poNumber && <span>PO: {order.poNumber}</span>}
                  {primaryContact?.contactName && <span>{primaryContact.contactName}</span>}
                </div>
                <div className="order-card-footer">
                  <span>{formatDate(order.estimatedDelivery) || '—'}</span>
                  <span>{order.daysSinceLastUpdate}d in status</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
