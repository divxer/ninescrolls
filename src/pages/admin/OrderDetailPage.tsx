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

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, loading, error, refresh } = useOrder(orderId);
  const { logs, loading: logsLoading } = useOrderLogs(orderId);
  const [advancing, setAdvancing] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

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

  const nextStatus = getNextStatus(order.status);

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
    await svc.updateOrder(orderId, { notes });
    setEditingNotes(false);
    refresh();
  }

  // Current step index in FORWARD_PATH
  const currentStepIdx = FORWARD_PATH.indexOf(order.status as OrderStatus);

  // Date fields mapped to statuses for showing below active steps
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

  return (
    <div className="space-y-8">
      {/* Breadcrumb + title area */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/admin/orders"
            className="hover:bg-surface-container-low rounded-full p-2 transition-colors inline-flex"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-widest">
          <Link to="/admin/orders" className="hover:text-on-surface transition-colors">Orders</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">{order.quoteNumber || order.orderId.slice(0, 8)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-4xl font-black text-primary tracking-tighter">
              {order.institution}
            </h1>
            <p className="text-on-surface-variant mt-1 font-medium">
              {order.productModel}{order.productName ? ` - ${order.productName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} size="lg" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-4">
          {nextStatus && (
            <button
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary/10 flex items-center gap-2 disabled:opacity-50"
              onClick={handleAdvanceStatus}
              disabled={advancing}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              {advancing ? 'Updating...' : `Advance to ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
          {order.status === 'INQUIRY' && (
            <button
              className="border border-error text-error px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-error-container transition-colors"
              onClick={() => setShowDecline(true)}
            >
              <span className="material-symbols-outlined text-[18px]">block</span>
              Decline
            </button>
          )}
        </div>
      </div>

      {/* Source badge */}
      {order.rfqId && (
        <div className="bg-primary-fixed/30 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[18px]">link</span>
          <span className="text-sm font-medium text-on-surface">From RFQ</span>
          <Link
            to={`/admin/rfqs/${order.rfqId}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {order.rfqId} - View RFQ
          </Link>
        </div>
      )}

      {/* Status stepper section */}
      <div className="bg-surface-container-lowest rounded-xl p-8 shadow-card">
        <div className="flex items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-surface-container-high" />
          {/* Completed portion of the line */}
          {currentStepIdx > 0 && (
            <div
              className="absolute top-4 left-4 h-0.5 bg-secondary"
              style={{ width: `${(currentStepIdx / (FORWARD_PATH.length - 1)) * 100}%` }}
            />
          )}
          {FORWARD_PATH.map((status, idx) => {
            const isCompleted = currentStepIdx >= 0 && idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const dateStr = statusDates[status];
            return (
              <div key={status} className="flex flex-col items-center relative z-10" style={{ flex: idx === 0 || idx === FORWARD_PATH.length - 1 ? '0 0 auto' : '1' }}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-secondary text-white ring-4 ring-secondary/20'
                      : isCompleted
                        ? 'bg-secondary text-white'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-tighter mt-2 text-center max-w-[72px] ${
                  isCurrent ? 'text-secondary' : 'text-on-surface-variant'
                }`}>
                  {STATUS_LABELS[status]}
                </span>
                {(isCurrent || isCompleted) && dateStr && (
                  <span className="text-[9px] text-on-surface-variant mt-0.5">
                    {formatDate(dateStr)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left column */}
        <div className="col-span-7 space-y-8">
          {/* Product Specifications card */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card">
            <div className="p-6 border-b border-outline-variant/10 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
              <h3 className="text-lg font-bold text-primary">Product Specifications</h3>
            </div>
            <div className="p-8 grid grid-cols-2 gap-x-12 gap-y-6">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Quote #</div>
                <div className="text-lg font-headline font-bold text-on-surface">{order.quoteNumber || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">PO #</div>
                <div className="text-lg font-headline font-bold text-on-surface">{order.poNumber || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Product</div>
                <div className="text-lg font-headline font-bold text-on-surface">
                  {order.productModel}{order.productName ? ` (${order.productName})` : ''}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Configuration</div>
                <div className="text-lg font-headline font-bold text-on-surface">{order.configuration || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Quote Amount</div>
                <div className="text-lg font-headline font-bold text-on-surface">
                  {order.quoteAmount ? `$${order.quoteAmount.toLocaleString()}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Department</div>
                <div className="text-lg font-headline font-bold text-on-surface">{order.department || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Created</div>
                <div className="text-lg font-headline font-bold text-on-surface">{formatDate(order.createdAt)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60 mb-1">Created By</div>
                <div className="text-lg font-headline font-bold text-on-surface">{order.createdByEmail || order.createdBy}</div>
              </div>
            </div>
          </div>

          {/* Notes section */}
          <div className="bg-surface-container-low rounded-xl p-8 border-l-4 border-tertiary-fixed-dim">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
                <span className="material-symbols-outlined">event_note</span>
                Notes
              </h3>
              <button
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                onClick={() => { setEditingNotes(!editingNotes); setNotes(order.notes || ''); }}
              >
                {editingNotes ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-container-lowest border-none rounded-lg text-sm p-4 h-24 focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                />
                <button
                  className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  onClick={handleSaveNotes}
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-sm text-on-surface-variant whitespace-pre-wrap">
                  {order.notes || 'No notes.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-5 space-y-8">
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
