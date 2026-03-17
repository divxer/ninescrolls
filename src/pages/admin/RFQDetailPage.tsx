import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRfq } from '../../hooks/useRfqs';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ConvertToOrderDialog } from '../../components/admin/ConvertToOrderDialog';
import { DeclineDialog } from '../../components/admin/DeclineDialog';
import { formatDateTime } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

export function RFQDetailPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { rfq, loading, error, refresh } = useRfq(rfqId);
  const [showConvert, setShowConvert] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [reverting, setReverting] = useState(false);

  if (loading) return <div className="admin-loading">Loading RFQ...</div>;
  if (error) return <div className="admin-error">Error: {error.message}</div>;
  if (!rfq) return <div className="admin-error">RFQ not found.</div>;

  async function handleConvert(overrides: {
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteNumber?: string;
    notes?: string;
  }) {
    const result = await svc.convertRfqToOrder(rfq!.rfqId, overrides);
    const orderId = (result as any)?.orderId;
    if (orderId) {
      navigate(`/admin/orders/${orderId}`);
    } else {
      refresh();
      setShowConvert(false);
    }
  }

  async function handleDecline(reason: string, note: string) {
    await svc.declineRfq(rfq!.rfqId, reason + (note ? ` - ${note}` : ''));
    refresh();
  }

  async function handleRevert() {
    if (!confirm('Are you sure you want to revert this RFQ back to Pending?')) return;
    setReverting(true);
    try {
      await svc.revertRfqToPending(rfq!.rfqId);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revert');
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="admin-detail-page">
      <div className="admin-detail-header">
        <Link to="/admin/rfqs" className="admin-btn-sm admin-btn-outline">&larr; Back</Link>
        <div className="admin-detail-title">
          <div className="admin-detail-title-row">
            <h1 style={{ margin: 0 }}>{rfq.referenceNumber || rfq.rfqId}</h1>
            <StatusBadge status={rfq.status} size="lg" />
          </div>
          <div style={{ color: '#666', marginTop: '4px' }}>
            Submitted {formatDateTime(rfq.submittedAt)}
          </div>
        </div>
        {rfq.status === 'pending' && (
          <div className="admin-detail-actions">
            <button className="admin-btn-primary" onClick={() => setShowConvert(true)}>
              Convert to Order
            </button>
            <button className="admin-btn-sm admin-btn-danger" onClick={() => setShowDecline(true)}>
              Decline
            </button>
          </div>
        )}
        {rfq.status === 'declined' && (
          <button className="admin-btn-sm admin-btn-outline" onClick={handleRevert} disabled={reverting}>
            {reverting ? 'Reverting...' : 'Revert to Pending'}
          </button>
        )}
      </div>

      {rfq.linkedOrderId && (
        <div className="admin-panel" style={{ background: '#f0fdf4', borderColor: '#16a34a' }}>
          Converted &rarr; Order{' '}
          <Link to={`/admin/orders/${rfq.linkedOrderId}`} className="admin-btn-sm">
            {rfq.linkedOrderId} - View Order
          </Link>
        </div>
      )}

      <div className="admin-info-grid">
        <div className="admin-panel">
          <h3>Contact Information</h3>
          <dl className="admin-dl">
            <dt>Name</dt><dd>{rfq.name || '-'}</dd>
            <dt>Email</dt><dd>{rfq.email || '-'}</dd>
            <dt>Phone</dt><dd>{rfq.phone || '-'}</dd>
            <dt>Institution</dt><dd>{rfq.institution || '-'}</dd>
            <dt>Department</dt><dd>{rfq.department || '-'}</dd>
            <dt>Role</dt><dd>{rfq.role || '-'}</dd>
          </dl>
        </div>

        <div className="admin-panel">
          <h3>Equipment Requirements</h3>
          <dl className="admin-dl">
            <dt>Category</dt><dd>{rfq.equipmentCategory || '-'}</dd>
            <dt>Specific Model</dt><dd>{rfq.specificModel || '-'}</dd>
            <dt>Quantity</dt><dd>{rfq.quantity || '-'}</dd>
          </dl>
          {rfq.applicationDescription && (
            <>
              <h4>Application Description</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{rfq.applicationDescription}</p>
            </>
          )}
          {rfq.keySpecifications && (
            <>
              <h4>Key Specifications</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{rfq.keySpecifications}</p>
            </>
          )}
        </div>
      </div>

      {rfq.needsBudgetaryQuote && (
        <div className="admin-panel" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
          <h3>Budgetary Quote Requested</h3>
          <dl className="admin-dl">
            <dt>Shipping Address</dt>
            <dd>
              {[rfq.shippingAddress, rfq.shippingCity, rfq.shippingState, rfq.shippingZipCode, rfq.shippingCountry]
                .filter(Boolean).join(', ') || '-'}
            </dd>
          </dl>
        </div>
      )}

      <div className="admin-panel">
        <h3>Project Context</h3>
        <dl className="admin-dl" style={{ columns: 2 }}>
          <dt>Budget Range</dt><dd>{rfq.budgetRange || '-'}</dd>
          <dt>Timeline</dt><dd>{rfq.timeline || '-'}</dd>
          <dt>Funding Status</dt><dd>{rfq.fundingStatus || '-'}</dd>
          <dt>Referral Source</dt><dd>{rfq.referralSource || '-'}</dd>
          <dt>Existing Equipment</dt><dd>{rfq.existingEquipment || '-'}</dd>
        </dl>
        {rfq.additionalComments && (
          <>
            <h4>Additional Comments</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{rfq.additionalComments}</p>
          </>
        )}
      </div>

      {showConvert && (
        <ConvertToOrderDialog
          open={showConvert}
          onClose={() => setShowConvert(false)}
          rfq={rfq}
          onConfirm={handleConvert}
        />
      )}

      {showDecline && (
        <DeclineDialog
          open={showDecline}
          onClose={() => setShowDecline(false)}
          onConfirm={handleDecline}
          title="Decline RFQ"
        />
      )}
    </div>
  );
}
