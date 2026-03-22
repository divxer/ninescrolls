import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { useOrderStats } from '../../hooks/useOrders';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ORDER_STATUSES, STATUS_LABELS, formatDate, type OrderStatus } from '../../types/admin';

export function OrderListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const { orders, loading, error } = useOrders(statusFilter === 'All' ? undefined : statusFilter);
  const { stats } = useOrderStats();
  const [search, setSearch] = useState('');

  const byStatus = useMemo(() => {
    if (!stats) return {} as Record<string, number>;
    let parsed: unknown = stats.byStatus;
    while (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return (parsed || {}) as Record<string, number>;
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

  // Stepper statuses: all except DECLINED
  const stepperStatuses = ORDER_STATUSES.filter(s => s !== 'DECLINED');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
        <span className="font-medium">Loading orders...</span>
      </div>
    </div>
  );
  if (error) return (
    <div className="bg-error-container text-on-error-container p-4 rounded-lg text-sm">
      Error: {error.message}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">
            Order Tracker
          </h1>
          <p className="text-on-surface-variant font-medium mt-1">
            {orders.length} total orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-surface-container-lowest text-primary font-semibold px-4 py-2 rounded-xl flex items-center gap-2 border border-outline-variant/30 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link
            to="/admin/orders/new"
            className="bg-secondary text-white font-semibold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-secondary/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Order
          </Link>
        </div>
      </div>

      {/* Status stepper bar */}
      {stats && (
        <div className="bg-surface-container-lowest rounded-xl p-8 mb-8 border border-outline-variant/10">
          <div className="flex items-center justify-between relative">
            {/* Progress line behind the steps */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-surface-container-high" />
            {stepperStatuses.map((status, idx) => {
              const count = byStatus[status] || 0;
              const hasOrders = count > 0;
              return (
                <div key={status} className="flex flex-col items-center relative z-10" style={{ flex: idx === 0 || idx === stepperStatuses.length - 1 ? '0 0 auto' : '1' }}>
                  {/* Step circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      hasOrders
                        ? 'bg-secondary text-white'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {count}
                  </div>
                  {/* Step label */}
                  <span className="text-[10px] font-bold uppercase tracking-tighter mt-2 text-on-surface-variant text-center max-w-[72px]">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search by institution, quote #, PO #, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
          />
        </div>
        <div className="col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
          >
            <option value="All">All Status</option>
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s as OrderStatus]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <select
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
            defaultValue=""
          >
            <option value="">All Products</option>
            <option value="ICP">ICP</option>
            <option value="PECVD">PECVD</option>
            <option value="Sputter">Sputter</option>
            <option value="ALD">ALD</option>
            <option value="RIE">RIE</option>
            <option value="IBE">IBE</option>
            <option value="HDP-CVD">HDP-CVD</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/10 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Order #</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Institution</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Product</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Quote Amount</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Status</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Est. Delivery</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Days</th>
              <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-6 py-4 text-left">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filtered.map(order => {
              const primaryContact = order.contacts?.find(c => c.isPrimary);
              void primaryContact; // used in original for display

              return (
                <tr
                  key={order.orderId}
                  className="hover:bg-primary-fixed/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/admin/orders/${order.orderId}`}
                >
                  <td className="px-6 py-5">
                    <span className="font-mono font-semibold text-primary">
                      {order.quoteNumber || order.poNumber || order.orderId.slice(0, 8)}
                    </span>
                    {order.quoteNumber && order.poNumber && (
                      <div className="text-[11px] text-on-surface-variant mt-0.5">PO: {order.poNumber}</div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">apartment</span>
                      </div>
                      <div>
                        <div className="font-bold text-on-surface">{order.institution}</div>
                        {primaryContact?.contactName && (
                          <div className="text-[11px] text-on-surface-variant">{primaryContact.contactName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="bg-surface-container-low px-2 py-1 rounded text-xs font-semibold">
                      {order.productModel}
                    </span>
                    {order.productName && (
                      <div className="text-[11px] text-on-surface-variant mt-1">{order.productName}</div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-headline font-semibold">
                      {order.quoteAmount ? `$${order.quoteAmount.toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">
                    {formatDate(order.estimatedDelivery)}
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">
                    {order.daysSinceLastUpdate}d
                  </td>
                  <td className="px-6 py-5">
                    {order.source === 'RFQ_WEBSITE' ? (
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">language</span>
                    ) : order.source === 'MANUAL' ? (
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">edit</span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">inbox</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-6 py-4 bg-surface-container-low/20 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-xs text-on-surface-variant">
            Showing {filtered.length} orders
          </span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-secondary text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
