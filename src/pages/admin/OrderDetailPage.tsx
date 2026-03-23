import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder, useOrderLogs } from '../../hooks/useOrders';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ContactsPanel } from '../../components/admin/ContactsPanel';
import { DocumentsPanel } from '../../components/admin/DocumentsPanel';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { DeclineDialog } from '../../components/admin/DeclineDialog';
import { formatDate, getNextStatus, STATUS_LABELS, FORWARD_PATH, type OrderStatus } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

const STEP_ICONS: Record<string, string> = {
  INQUIRY: 'search',
  QUOTING: 'request_quote',
  QUOTE_SENT: 'send',
  PO_RECEIVED: 'inventory',
  IN_PRODUCTION: 'precision_manufacturing',
  SHIPPED: 'local_shipping',
  INSTALLED: 'home_repair_service',
  CLOSED: 'task_alt',
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, loading, error, refresh } = useOrder(orderId);
  const { logs, loading: logsLoading } = useOrderLogs(orderId);
  const [advancing, setAdvancing] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
        <span className="font-medium">Loading order...</span>
      </div>
    </div>
  );
  if (error) return (
    <div className="bg-error-container text-on-error-container p-4 rounded-lg text-sm">
      Error: {error.message}
    </div>
  );
  if (!order) return (
    <div className="bg-error-container text-on-error-container p-4 rounded-lg text-sm">
      Order not found.
    </div>
  );

  // Initialize notes from order on first render
  if (!notesInitialized && order) {
    setNotes(order.notes || '');
    setNotesInitialized(true);
  }

  const nextStatus = getNextStatus(order.status);
  const currentStepIdx = FORWARD_PATH.indexOf(order.status as OrderStatus);

  const statusDates: Partial<Record<OrderStatus, string | null | undefined>> = {
    INQUIRY: order.createdAt,
    QUOTING: order.quoteDate,
    QUOTE_SENT: order.quoteDate,
    PO_RECEIVED: order.poDate,
    IN_PRODUCTION: order.productionStartDate,
    SHIPPED: order.shipDate,
    INSTALLED: order.installDate,
    CLOSED: order.closeDate,
  };

  async function handleAdvanceStatus() {
    if (!nextStatus || !orderId) return;
    setAdvancing(true);
    try {
      await svc.updateOrderStatus(orderId, nextStatus);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to advance status');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleDecline(reason: string, note: string) {
    if (!orderId) return;
    await svc.declineInquiry(orderId, reason, note || undefined);
    refresh();
  }

  async function handleSaveNotes() {
    if (!orderId) return;
    setSavingNotes(true);
    try {
      await svc.updateOrder(orderId, { notes });
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  const orderRef = order.quoteNumber || order.poNumber || order.orderId.slice(0, 12);

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header Section */}
      <section className="flex flex-wrap justify-between items-start gap-4 md:gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-headline font-bold text-primary tracking-tighter">{orderRef}</span>
            <StatusBadge status={order.status} size="lg" />
          </div>
          <p className="text-lg text-on-surface-variant font-medium">{order.institution}</p>
        </div>
        <div className="flex items-center gap-3">
          {nextStatus && (
            <button
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              onClick={handleAdvanceStatus}
              disabled={advancing}
            >
              <span>{advancing ? 'Updating...' : `Advance to ${STATUS_LABELS[nextStatus]}`}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
          {order.status === 'INQUIRY' && (
            <button
              className="px-5 py-2.5 border border-error text-error font-bold rounded-lg flex items-center gap-2 hover:bg-error-container/20 transition-colors"
              onClick={() => setShowDecline(true)}
            >
              <span className="material-symbols-outlined text-sm">block</span>
              Decline
            </button>
          )}
          <div className="relative">
            <button
              className="p-2.5 border border-outline-variant/30 text-primary rounded-lg hover:bg-surface-container-low transition-colors"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-[0px_10px_30px_rgba(2,36,72,0.12)] py-1.5 z-50 min-w-[160px]">
                  <Link
                    to="/admin/orders"
                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors no-underline"
                    onClick={() => setShowMoreMenu(false)}
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Back to Orders
                  </Link>
                  {order.rfqId && (
                    <Link
                      to={`/admin/rfqs/${order.rfqId}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors no-underline"
                      onClick={() => setShowMoreMenu(false)}
                    >
                      <span className="material-symbols-outlined text-sm">link</span>
                      View Source RFQ
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Source badge */}
      {order.rfqId && (
        <div className="bg-primary-fixed/30 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[18px]">link</span>
          <span className="text-sm font-medium text-on-surface">From RFQ</span>
          <Link
            to={`/admin/rfqs/${order.rfqId}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View RFQ
          </Link>
        </div>
      )}

      {/* Lifecycle Stepper */}
      <section className="bg-surface-container-low rounded-xl p-4 md:p-8 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <div className="flex justify-between items-start min-w-[800px]">
          {FORWARD_PATH.map((status, idx) => {
            const isCompleted = currentStepIdx >= 0 && idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const isFuture = idx > currentStepIdx;
            const dateStr = statusDates[status];

            return (
              <div key={status} className={`flex flex-col items-center gap-3 flex-1 ${isFuture ? 'opacity-50' : ''}`}>
                <div className="relative flex items-center justify-center w-full">
                  {/* Connecting line left */}
                  {idx > 0 && (
                    <div className={`absolute right-1/2 w-full h-[2px] ${
                      isCompleted || isCurrent ? 'bg-primary' : 'bg-outline-variant/30'
                    }`} />
                  )}
                  {/* Connecting line right */}
                  {idx < FORWARD_PATH.length - 1 && (
                    <div className={`absolute left-1/2 w-full h-[2px] ${
                      isCompleted ? 'bg-primary' : 'bg-outline-variant/30'
                    }`} />
                  )}
                  {/* Step circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${
                      isCompleted
                        ? 'bg-primary text-white'
                        : isCurrent
                          ? 'bg-primary-container border-4 border-white text-primary-fixed animate-pulse'
                          : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    ) : (
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isCurrent ? "'FILL' 1" : "'FILL' 0" }}>
                        {STEP_ICONS[status] || 'circle'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <span className={`text-[10px] font-bold tracking-widest uppercase ${
                    isCurrent ? 'text-primary' : isCompleted ? 'text-primary' : 'text-on-surface-variant'
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {isCompleted && dateStr && (
                    <p className="text-[10px] text-on-surface-variant mt-1">{formatDate(dateStr).toUpperCase()}</p>
                  )}
                  {isCurrent && (
                    <p className="text-[10px] text-primary font-medium mt-1">CURRENT STAGE</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Content Grid: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Product Specifications Card */}
          <div className="bg-surface-container-lowest rounded-xl p-4 md:p-8 border border-outline-variant/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-headline font-bold text-primary">Product Specifications</h2>
              <span className="material-symbols-outlined text-outline-variant cursor-pointer hover:text-primary transition-colors">edit</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Quote #</label>
                <p className="text-sm font-semibold">{order.quoteNumber || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">PO #</label>
                <p className={`text-sm ${order.poNumber ? 'font-semibold' : 'text-outline italic'}`}>
                  {order.poNumber || 'Pending Reception'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Product</label>
                <p className="text-sm font-semibold">
                  {order.productModel}{order.productName ? ` (${order.productName})` : ''}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Amount</label>
                <p className="text-sm font-headline font-bold text-primary">{formatCurrency(order.quoteAmount)}</p>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Configuration</label>
                <p className="text-sm leading-relaxed text-on-surface-variant">{order.configuration || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Department</label>
                <p className="text-sm font-semibold">{order.department || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.6875rem] uppercase tracking-widest font-bold text-on-surface-variant/70">Created By</label>
                <p className="text-sm font-semibold">{order.createdByEmail || order.createdBy}</p>
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-surface-container-lowest rounded-xl p-4 md:p-8 border border-outline-variant/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">description</span>
              <h2 className="text-xl font-headline font-bold text-primary">Internal Notes</h2>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-32 p-4 bg-surface-container-low border-none rounded-lg text-sm focus:ring-2 focus:ring-secondary/20 placeholder:text-outline resize-vertical"
              placeholder="Enter order-specific notes, delivery requirements, or technical constraints..."
            />
            <div className="mt-4 flex justify-end">
              {notes !== (order.notes || '') ? (
                <button
                  className="text-xs uppercase font-bold tracking-widest text-secondary hover:underline disabled:opacity-50"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/50">
                  {order.notes ? 'Saved' : 'No notes yet'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <ContactsPanel
            orderId={order.orderId}
            contacts={order.contacts || []}
            onRefresh={refresh}
          />

          <DocumentsPanel orderId={order.orderId} currentStatus={order.status} />

          <ActivityLog logs={logs} loading={logsLoading} />
        </div>
      </div>

      {/* Decline Dialog */}
      {showDecline && (
        <DeclineDialog
          open={showDecline}
          onClose={() => setShowDecline(false)}
          onConfirm={handleDecline}
        />
      )}
    </div>
  );
}
