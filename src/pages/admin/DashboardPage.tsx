import { useMemo } from 'react';
import { useOrders, useOrderStats } from '../../hooks/useOrders';
import { useRfqs } from '../../hooks/useRfqs';
import { useDashboardAnalytics, computeTrend } from '../../hooks/useDashboardAnalytics';
import { StatusBadge } from '../../components/admin/StatusBadge';
import type { Order } from '../../types/admin';

function TrendBadge({ trend, loading }: { trend: number; loading?: boolean }) {
  if (loading) return null;
  if (trend === 0) {
    return (
      <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">0%</span>
    );
  }
  const positive = trend > 0;
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${positive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
      {positive ? '+' : ''}{trend}%
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

export function DashboardPage() {
  const { orders, loading: ordersLoading } = useOrders();
  const { stats, loading: statsLoading } = useOrderStats();
  const { rfqs, loading: rfqsLoading } = useRfqs();
  const { monthlyVisitors, targetCustomers, visitorTrend, targetTrend, dailyCounts, loading: analyticsLoading } = useDashboardAnalytics();

  const pendingRfqCount = useMemo(
    () => rfqs.filter((r) => r.status === 'pending').length,
    [rfqs],
  );

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [orders],
  );

  const fulfilledPct = useMemo(() => {
    if (!stats?.byStatus) return 0;
    const total = Object.values(stats.byStatus).reduce((s, c) => s + (Number(c) || 0), 0);
    if (!total || total === 0) return 0;
    const fulfilled = (Number(stats.byStatus.INSTALLED) || 0) + (Number(stats.byStatus.CLOSED) || 0) + (Number(stats.byStatus.SHIPPED) || 0);
    return Math.round(fulfilled / total * 100);
  }, [stats]);

  const completedCount = useMemo(() => (stats?.byStatus?.INSTALLED || 0) + (stats?.byStatus?.CLOSED || 0), [stats]);
  const inProgressCount = useMemo(() =>
    (stats?.byStatus?.IN_PRODUCTION || 0) + (stats?.byStatus?.QUOTING || 0) +
    (stats?.byStatus?.QUOTE_SENT || 0) + (stats?.byStatus?.PO_RECEIVED || 0), [stats]);
  const onHoldCount = useMemo(() => stats?.byStatus?.INQUIRY || 0, [stats]);

  const { ordersTrend, rfqsTrend } = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 86_400_000;
    const currentStart = now - thirtyDaysMs;
    const previousStart = now - 2 * thirtyDaysMs;

    const currentOrders = orders.filter(o => new Date(o.createdAt).getTime() >= currentStart).length;
    const previousOrders = orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return t >= previousStart && t < currentStart;
    }).length;

    const currentRfqs = rfqs.filter(r => new Date(r.submittedAt).getTime() >= currentStart).length;
    const previousRfqs = rfqs.filter(r => {
      const t = new Date(r.submittedAt).getTime();
      return t >= previousStart && t < currentStart;
    }).length;

    return {
      ordersTrend: computeTrend(currentOrders, previousOrders),
      rfqsTrend: computeTrend(currentRfqs, previousRfqs),
    };
  }, [orders, rfqs]);

  const maxVisitor = Math.max(...(dailyCounts.length > 0 ? dailyCounts : [1]), 1);

  const isLoading = ordersLoading || statsLoading || rfqsLoading;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <h2 className="font-headline text-3xl font-black tracking-tight text-on-surface">Dashboard Overview</h2>
          <p className="text-on-surface-variant font-medium mt-1">Real-time precision analytics for NineScrolls LLC.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface-container-lowest border border-outline-variant/10 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            Last 30 Days
          </button>
          <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm">
            <span className="material-symbols-outlined text-sm">file_download</span>
            Export Data
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-primary-fixed text-primary rounded-lg">
              <span className="material-symbols-outlined">receipt_long</span>
            </span>
            <TrendBadge trend={ordersTrend} loading={ordersLoading} />
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">New Orders</p>
          <h3 className="font-headline text-4xl font-bold text-on-surface">{isLoading ? '...' : stats?.totalActive ?? 0}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-tertiary-fixed text-tertiary-container rounded-lg">
              <span className="material-symbols-outlined">pending_actions</span>
            </span>
            <TrendBadge trend={rfqsTrend} loading={rfqsLoading} />
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Pending RFQs</p>
          <h3 className="font-headline text-4xl font-bold text-on-surface">{isLoading ? '...' : pendingRfqCount}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-secondary-fixed text-secondary rounded-lg">
              <span className="material-symbols-outlined">group</span>
            </span>
            <TrendBadge trend={visitorTrend} loading={analyticsLoading} />
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Monthly Visitors</p>
          <h3 className="font-headline text-4xl font-bold text-on-surface">{analyticsLoading ? '...' : monthlyVisitors.toLocaleString()}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-primary-fixed text-primary rounded-lg">
              <span className="material-symbols-outlined">target</span>
            </span>
            <TrendBadge trend={targetTrend} loading={analyticsLoading} />
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Target Customers</p>
          <h3 className="font-headline text-4xl font-bold text-on-surface">{analyticsLoading ? '...' : targetCustomers.toLocaleString()}</h3>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Order Status Donut */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-headline text-xl font-bold text-on-surface">Order Status</h4>
            <button className="material-symbols-outlined text-on-surface-variant">more_horiz</button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant">Loading...</div>
          ) : (
            <>
              <div className="relative flex justify-center py-6">
                <div className="w-48 h-48 relative">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="13" fill="none" stroke="#d5e3ff" strokeWidth="4.5" />
                    <circle cx="18" cy="18" r="13" fill="none" stroke="#0058be" strokeWidth="4.5"
                      strokeDasharray={`${fulfilledPct} ${100 - fulfilledPct}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="block text-2xl font-bold text-on-surface">{fulfilledPct}%</span>
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tight">Fulfilled</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-secondary" />
                    <span className="text-sm font-medium text-on-surface">Completed</span>
                  </div>
                  <span className="text-sm font-bold text-on-surface">{completedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-primary-fixed" />
                    <span className="text-sm font-medium text-on-surface">In Progress</span>
                  </div>
                  <span className="text-sm font-bold text-on-surface">{inProgressCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim" />
                    <span className="text-sm font-medium text-on-surface">On Hold</span>
                  </div>
                  <span className="text-sm font-bold text-on-surface">{onHoldCount}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 30-Day Visitor Trend */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-headline text-xl font-bold text-on-surface">30-Day Visitor Trend</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span className="text-xs font-semibold text-on-surface-variant">Unique Visitors</span>
              </div>
              <button className="material-symbols-outlined text-on-surface-variant">more_horiz</button>
            </div>
          </div>
          <div className="h-64 flex items-end gap-[2px] px-2">
            <div className="flex-grow flex items-end gap-[2px] h-full">
              {dailyCounts.length > 0 ? dailyCounts.map((val, i) => (
                <div
                  key={i}
                  className="w-full bg-secondary-fixed/30 hover:bg-secondary rounded-t-sm transition-all"
                  style={{ height: `${(val / maxVisitor) * 100}%`, minHeight: val > 0 ? '2px' : undefined }}
                />
              )) : (
                <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">
                  {analyticsLoading ? 'Loading...' : 'No data'}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-4 px-2">
            <span className="text-[10px] font-bold text-on-surface-variant/50">
              {new Date(Date.now() - 30 * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant/50">
              {new Date(Date.now() - 15 * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant/50">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
          </div>
          <div className="mt-8 p-4 bg-surface-container-low rounded-lg flex items-center gap-4">
            <div className="p-2 bg-secondary/10 text-secondary rounded">
              <span className="material-symbols-outlined text-lg">insights</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">Traffic Insight</p>
              <p className="text-xs text-on-surface-variant">
                Direct traffic increased by <span className="font-bold text-secondary">18%</span> this week due to the new technical whitepaper release.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Operational Logs ── */}
      <div className="mt-10 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
        <div className="flex items-center justify-between mb-8">
          <h4 className="font-headline text-xl font-bold text-on-surface">Recent Operational Logs</h4>
          <a className="text-sm font-bold text-secondary hover:underline cursor-pointer">View All Ledger Entries</a>
        </div>
        {isLoading ? (
          <div className="text-sm text-on-surface-variant">Loading...</div>
        ) : recentOrders.length === 0 ? (
          <div className="text-sm text-on-surface-variant">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-on-surface-variant border-b border-outline-variant/10">
                  <th className="pb-4 font-bold text-[10px] uppercase tracking-widest">Entry ID</th>
                  <th className="pb-4 font-bold text-[10px] uppercase tracking-widest">Client Identity</th>
                  <th className="pb-4 font-bold text-[10px] uppercase tracking-widest">Status</th>
                  <th className="pb-4 font-bold text-[10px] uppercase tracking-widest">Value</th>
                  <th className="pb-4 font-bold text-[10px] uppercase tracking-widest">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {recentOrders.map((order: Order) => (
                  <tr key={order.orderId} className="hover:bg-primary-fixed/30 transition-colors group">
                    <td className="py-4 text-sm font-mono text-on-surface-variant">
                      #NS-{order.orderId.slice(0, 8)}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-[10px] font-bold text-primary">
                          {getInitials(order.institution)}
                        </div>
                        <span className="text-sm font-semibold text-on-surface">{order.institution}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-4 text-sm font-bold text-on-surface">{formatCurrency(order.quoteAmount)}</td>
                    <td className="py-4 text-sm text-on-surface-variant">{timeAgo(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
