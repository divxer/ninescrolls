import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrders, useOrderStats } from '../../hooks/useOrders';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ORDER_STATUSES, STATUS_LABELS, FORWARD_PATH, formatDate, type OrderStatus } from '../../types/admin';

const STATUS_ICONS: Record<string, string> = {
  INQUIRY: 'search',
  QUOTING: 'edit_note',
  QUOTE_SENT: 'send',
  PO_RECEIVED: 'radio_button_checked',
  IN_PRODUCTION: 'factory',
  SHIPPED: 'local_shipping',
  INSTALLED: 'verified',
  CLOSED: 'lock',
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

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

  // Find the stalled order (highest daysSinceLastUpdate, not CLOSED/INSTALLED)
  const stalledOrder = useMemo(() => {
    const active = orders.filter(o =>
      o.status !== 'CLOSED' && o.status !== 'INSTALLED' && o.status !== 'DECLINED' && o.daysSinceLastUpdate > 14,
    );
    return active.sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate)[0] || null;
  }, [orders]);

  // Avg days from PO_RECEIVED to IN_PRODUCTION (transmission velocity)
  const avgVelocity = useMemo(() => {
    const withDates = orders.filter(o => o.poDate && o.productionStartDate);
    if (withDates.length === 0) return null;
    const total = withDates.reduce((sum, o) => {
      const po = new Date(o.poDate!).getTime();
      const prod = new Date(o.productionStartDate!).getTime();
      return sum + Math.max(0, (prod - po) / (1000 * 60 * 60 * 24));
    }, 0);
    return (total / withDates.length).toFixed(1);
  }, [orders]);

  // Stepper statuses: all on forward path (excludes DECLINED)
  const stepperStatuses = FORWARD_PATH;

  // Determine "current" stepper state: the latest status that has orders
  const currentStepIdx = useMemo(() => {
    let latest = -1;
    stepperStatuses.forEach((s, i) => {
      if ((byStatus[s] || 0) > 0) latest = i;
    });
    return latest;
  }, [byStatus, stepperStatuses]);

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
    <div className="space-y-10">
      {/* Page Header & Actions */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-label mb-2">
            <span>Ledger</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-secondary font-bold">Order Tracking</span>
          </nav>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Active Transmissions</h2>
        </div>
        <div className="flex gap-4">
          <button className="px-5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded text-xs font-label uppercase tracking-widest font-bold hover:bg-surface-container-low transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
          <Link
            to="/admin/orders/new"
            className="px-6 py-2.5 bg-primary text-white rounded text-xs font-label uppercase tracking-widest font-bold hover:shadow-lg transition-all flex items-center gap-2 no-underline"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Create Order
          </Link>
        </div>
      </div>

      {/* Global Pipeline Overview (Lifecycle Stepper) */}
      {stats && (
        <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-lg uppercase tracking-wider text-on-primary-fixed-variant">Lifecycle Management</h3>
            <div className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-3 py-1 rounded">
              {orders.length} Active Orders
            </div>
          </div>
          <div className="relative flex justify-between items-start">
            {/* Progress line */}
            <div className="absolute top-4 left-0 w-full h-[1px] bg-outline-variant/20 z-0" />
            {stepperStatuses.map((status, idx) => {
              const count = byStatus[status] || 0;
              const isCompleted = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const isFuture = idx > currentStepIdx;
              return (
                <button
                  key={status}
                  className="relative z-10 flex flex-col items-center group bg-transparent border-none cursor-pointer p-0"
                  onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-3 transition-all ${
                      statusFilter === status
                        ? 'bg-secondary text-white shadow-lg shadow-secondary/20 ring-4 ring-secondary-fixed'
                        : isCompleted
                          ? 'bg-primary text-white'
                          : isCurrent
                            ? 'bg-secondary text-white shadow-lg shadow-secondary/20 ring-4 ring-secondary-fixed'
                            : 'bg-surface-container text-on-surface-variant'
                    } ${isFuture && statusFilter !== status ? 'opacity-40' : ''}`}
                  >
                    {isCompleted && statusFilter !== status ? (
                      <span className="material-symbols-outlined text-sm">check</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">{STATUS_ICONS[status] || 'circle'}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                    isCurrent || statusFilter === status ? 'text-secondary' : isFuture ? 'text-on-surface-variant opacity-40' : 'text-on-surface'
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {count > 0 && (
                    <span className={`text-[9px] mt-1 font-bold ${
                      isCurrent || statusFilter === status ? 'text-secondary' : 'text-on-surface-variant'
                    }`}>
                      {count} order{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Data Table + Summary Panel */}
      <div className="grid grid-cols-12 gap-8">
        {/* Main Data Table */}
        <div className="col-span-12 lg:col-span-9 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_10px_30px_rgba(2,36,72,0.02)]">
          {/* Table header bar */}
          <div className="p-6 flex items-center justify-between bg-surface-container-low/50">
            <div className="flex items-center gap-4">
              <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Global Order Ledger</h4>
              <span className="text-[10px] bg-primary-fixed text-on-primary-fixed-variant px-2 py-0.5 rounded-full font-bold">
                {filtered.length} Total
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg py-1.5 pl-9 pr-4 text-sm w-56 focus:ring-1 focus:ring-secondary/20 placeholder:text-on-surface-variant/50 transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-container-low border-none rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-secondary/20"
              >
                <option value="All">All Status</option>
                {ORDER_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s as OrderStatus]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Order #</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Institution</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Days</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr
                    key={order.orderId}
                    className="hover:bg-primary-fixed transition-colors cursor-pointer group"
                    onClick={() => window.location.href = `/admin/orders/${order.orderId}`}
                  >
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-on-surface">
                        {order.quoteNumber || order.poNumber || order.orderId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">{order.institution}</span>
                        {order.department && (
                          <span className="text-[10px] text-on-surface-variant">{order.department}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-on-surface">{order.productModel}</span>
                      {order.productName && (
                        <div className="text-[10px] text-on-surface-variant mt-0.5">{order.productName}</div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right font-headline font-bold text-xs">
                      {formatCurrency(order.quoteAmount)}
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-xs text-on-surface-variant">{order.daysSinceLastUpdate}d</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                        {order.source === 'RFQ_WEBSITE' ? 'Portal' : order.source === 'MANUAL' ? 'Direct' : order.source || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="p-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
              Showing {filtered.length} of {orders.length} Transmissions
            </span>
            <div className="flex gap-1">
              <div className="w-8 h-8 flex items-center justify-center rounded bg-primary text-white text-xs font-bold">1</div>
            </div>
          </div>
        </div>

        {/* Summary Panel / Stats */}
        <div className="col-span-12 lg:col-span-3 space-y-8">
          {/* Transmission Velocity */}
          <div className="bg-primary-container p-6 rounded-xl text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h5 className="text-[10px] font-label uppercase tracking-[0.3em] opacity-60 mb-2">Transmission Velocity</h5>
              <div className="text-3xl font-headline font-bold tracking-tight">
                {avgVelocity ? `${avgVelocity} Days` : '-'}
              </div>
              <p className="text-[10px] mt-4 opacity-70">
                Average PO to Production handover time.
              </p>
            </div>
            <span
              className="material-symbols-outlined absolute -bottom-4 -right-4 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-700"
              style={{ fontSize: '8rem' }}
            >speed</span>
          </div>

          {/* Status Distribution */}
          <div className="bg-surface-container-low p-6 rounded-xl space-y-6">
            <h5 className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant">Status Distribution</h5>
            <div className="space-y-4">
              {FORWARD_PATH.filter(s => (byStatus[s] || 0) > 0).slice(0, 4).map(status => {
                const count = byStatus[status] || 0;
                const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-tighter mb-1.5">
                      <span>{STATUS_LABELS[status]}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1 bg-outline-variant/20 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stalled Transmission Alert */}
          {stalledOrder && (
            <div className="p-6 border border-outline-variant/20 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded bg-tertiary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-tertiary-fixed-variant">warning</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Stalled Transmission</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Action Required</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Order <strong>{stalledOrder.quoteNumber || stalledOrder.orderId.slice(0, 8)}</strong> ({stalledOrder.institution}) has been in '{STATUS_LABELS[stalledOrder.status as OrderStatus]}' status for {stalledOrder.daysSinceLastUpdate} days.
              </p>
              <Link
                to={`/admin/orders/${stalledOrder.orderId}`}
                className="mt-4 w-full py-2 bg-surface text-[10px] font-bold uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-low transition-colors rounded flex items-center justify-center no-underline text-on-surface"
              >
                Review Transmission
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
