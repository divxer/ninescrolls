import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder, useOrderLogs } from '../../hooks/useOrders';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { OrderTimeline } from '../../components/admin/OrderTimeline';
import { ContactsPanel } from '../../components/admin/ContactsPanel';
import { DocumentsPanel } from '../../components/admin/DocumentsPanel';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { DeclineDialog } from '../../components/admin/DeclineDialog';
import { formatDate, getNextStatus, STATUS_LABELS } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, loading, error, refresh } = useOrder(orderId);
  const { logs, loading: logsLoading } = useOrderLogs(orderId);
  const [advancing, setAdvancing] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  if (loading) return <div className="admin-loading">Loading order...</div>;
  if (error) return <div className="admin-error">Error: {error.message}</div>;
  if (!order) return <div className="admin-error">Order not found.</div>;

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

  return (
    <div className="admin-detail-page">
      {/* Header */}
      <div className="admin-detail-header">
        <Link to="/admin/orders" className="admin-btn-sm admin-btn-outline">&larr; Back</Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StatusBadge status={order.status} size="lg" />
            <h1 style={{ margin: 0 }}>{order.institution}</h1>
          </div>
          <div style={{ color: '#666', marginTop: '4px' }}>
            {order.productModel}{order.productName ? ` - ${order.productName}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {nextStatus && (
            <button className="admin-btn-primary" onClick={handleAdvanceStatus} disabled={advancing}>
              {advancing ? 'Updating...' : `Advance to ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
          {order.status === 'INQUIRY' && (
            <button className="admin-btn-sm admin-btn-danger" onClick={() => setShowDecline(true)}>
              Decline
            </button>
          )}
        </div>
      </div>

      {/* Source badge */}
      {order.rfqId && (
        <div className="admin-panel" style={{ background: '#f0f9ff' }}>
          From RFQ{' '}
          <Link to={`/admin/rfqs/${order.rfqId}`} className="admin-btn-sm">
            {order.rfqId} - View RFQ
          </Link>
        </div>
      )}

      {/* Info + Timeline */}
      <div className="admin-info-grid">
        <div className="admin-panel">
          <h3>Order Information</h3>
          <dl className="admin-dl">
            <dt>Quote #</dt><dd>{order.quoteNumber || '-'}</dd>
            <dt>PO #</dt><dd>{order.poNumber || '-'}</dd>
            <dt>Product</dt><dd>{order.productModel}{order.productName ? ` (${order.productName})` : ''}</dd>
            <dt>Configuration</dt><dd>{order.configuration || '-'}</dd>
            <dt>Quote Amount</dt><dd>{order.quoteAmount ? `$${order.quoteAmount.toLocaleString()}` : '-'}</dd>
            <dt>Department</dt><dd>{order.department || '-'}</dd>
            <dt>Created</dt><dd>{formatDate(order.createdAt)}</dd>
            <dt>Created By</dt><dd>{order.createdBy}</dd>
          </dl>
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Notes</strong>
              <button
                className="admin-btn-sm admin-btn-outline"
                onClick={() => { setEditingNotes(!editingNotes); setNotes(order.notes || ''); }}
              >
                {editingNotes ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
                <button className="admin-btn-sm" onClick={handleSaveNotes} style={{ marginTop: '4px' }}>
                  Save
                </button>
              </div>
            ) : (
              <p style={{ whiteSpace: 'pre-wrap', color: '#666' }}>{order.notes || 'No notes.'}</p>
            )}
          </div>
        </div>

        <OrderTimeline order={order} />
      </div>

      {/* Contacts */}
      <ContactsPanel
        orderId={order.orderId}
        contacts={order.contacts || []}
        onRefresh={refresh}
      />

      {/* Documents */}
      <DocumentsPanel orderId={order.orderId} currentStatus={order.status} />

      {/* Activity Log */}
      <ActivityLog logs={logs} loading={logsLoading} />

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
