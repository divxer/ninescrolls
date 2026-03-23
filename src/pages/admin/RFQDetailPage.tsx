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

  if (loading) return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading RFQ...</div>;
  if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;
  if (!rfq) return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">RFQ not found.</div>;

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
    <div>
      {/* Back link */}
      <Link to="/admin/rfqs" className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to RFQs
      </Link>

      {/* Page title area */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-3xl font-bold text-primary">RFQ-{rfq.referenceNumber || rfq.rfqId.slice(0, 8)}</h1>
            <StatusBadge status={rfq.status} size="lg" />
          </div>
          <p className="text-sm text-on-surface-variant mt-1">Submitted {formatDateTime(rfq.submittedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {rfq.status === 'pending' && (
            <>
              <button
                className="bg-secondary text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-secondary/20 hover:opacity-90 transition-opacity"
                onClick={() => setShowConvert(true)}
              >
                <span className="material-symbols-outlined text-lg">swap_horiz</span>
                Convert to Order
              </button>
              <button
                className="border border-error text-error px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-error/5 transition-colors"
                onClick={() => setShowDecline(true)}
              >
                <span className="material-symbols-outlined text-lg">close</span>
                Decline
              </button>
            </>
          )}
          {rfq.status === 'declined' && (
            <button
              className="border border-outline-variant text-on-surface px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-surface-container-low transition-colors"
              onClick={handleRevert}
              disabled={reverting}
            >
              <span className="material-symbols-outlined text-lg">undo</span>
              {reverting ? 'Reverting...' : 'Revert to Pending'}
            </button>
          )}
        </div>
      </div>

      {/* Linked Order */}
      {rfq.linkedOrderId && (
        <div className="bg-surface-container-low p-4 rounded-lg mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">link</span>
          <span className="text-sm text-on-surface">Converted to Order</span>
          <Link
            to={`/admin/orders/${rfq.linkedOrderId}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {rfq.linkedOrderId} — View Order
          </Link>
        </div>
      )}

      {/* Contact Information */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-card mb-6">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-lg">person</span>
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Name</p>
            <p className="text-sm font-medium text-on-surface">{rfq.name || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Email</p>
            <p className="text-sm font-medium text-on-surface">{rfq.email || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Phone</p>
            <p className="text-sm font-medium text-on-surface">{rfq.phone || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Institution</p>
            <p className="text-sm font-medium text-on-surface">{rfq.institution || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Department</p>
            <p className="text-sm font-medium text-on-surface">{rfq.department || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Role</p>
            <p className="text-sm font-medium text-on-surface">{rfq.role || '-'}</p>
          </div>
        </div>
      </div>

      {/* Equipment Requirements */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-card mb-6">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
          Equipment Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Category</p>
            <p className="text-sm font-medium text-on-surface">{rfq.equipmentCategory || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Specific Model</p>
            <p className="text-sm font-medium text-on-surface">{rfq.specificModel || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Quantity</p>
            <p className="text-sm font-medium text-on-surface">{rfq.quantity || '-'}</p>
          </div>
        </div>
        {rfq.applicationDescription && (
          <div className="mt-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Application Description</p>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{rfq.applicationDescription}</p>
          </div>
        )}
        {rfq.keySpecifications && (
          <div className="mt-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Key Specifications</p>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{rfq.keySpecifications}</p>
          </div>
        )}
      </div>

      {/* Budgetary Quote */}
      {rfq.needsBudgetaryQuote && (
        <div className="bg-tertiary-fixed/10 border border-tertiary-fixed-dim/30 rounded-xl p-4 md:p-6 shadow-card mb-6">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-lg">request_quote</span>
            Budgetary Quote Requested
          </h3>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Shipping Address</p>
            <p className="text-sm font-medium text-on-surface">
              {[rfq.shippingAddress, rfq.shippingCity, rfq.shippingState, rfq.shippingZipCode, rfq.shippingCountry]
                .filter(Boolean).join(', ') || '-'}
            </p>
          </div>
        </div>
      )}

      {/* Project Context */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-card mb-6">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-lg">info</span>
          Project Context
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Budget Range</p>
            <p className="text-sm font-medium text-on-surface">{rfq.budgetRange || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Timeline</p>
            <p className="text-sm font-medium text-on-surface">{rfq.timeline || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Funding Status</p>
            <p className="text-sm font-medium text-on-surface">{rfq.fundingStatus || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Referral Source</p>
            <p className="text-sm font-medium text-on-surface">{rfq.referralSource || '-'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Existing Equipment</p>
            <p className="text-sm font-medium text-on-surface">{rfq.existingEquipment || '-'}</p>
          </div>
        </div>
        {rfq.additionalComments && (
          <div className="mt-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Additional Comments</p>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{rfq.additionalComments}</p>
          </div>
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
