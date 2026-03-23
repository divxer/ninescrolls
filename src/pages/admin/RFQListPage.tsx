import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRfqs } from '../../hooks/useRfqs';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ConvertToOrderDialog } from '../../components/admin/ConvertToOrderDialog';
import { DeclineDialog } from '../../components/admin/DeclineDialog';
import { formatDate, formatDateTime } from '../../types/admin';
import type { RfqSubmission } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

const STATUS_OPTIONS = ['All', 'pending', 'converted', 'declined'];

export function RFQListPage() {
  const { rfqs, loading, error, refresh } = useRfqs();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRfq, setSelectedRfq] = useState<RfqSubmission | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const stats = useMemo(() => {
    const pending = rfqs.filter(r => r.status === 'pending').length;
    const converted = rfqs.filter(r => r.status === 'converted').length;
    const declined = rfqs.filter(r => r.status === 'declined').length;
    const total = converted + declined;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { pending, converted, declined, rate };
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

  function openPanel(rfq: RfqSubmission) {
    setSelectedRfq(rfq);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedRfq(null), 300);
  }

  // Close panel on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) closePanel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen]);

  async function handleConvert(overrides: {
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteNumber?: string;
    notes?: string;
  }) {
    const result = await svc.convertRfqToOrder(selectedRfq!.rfqId, overrides);
    const orderId = (result as any)?.orderId;
    if (orderId) {
      navigate(`/admin/orders/${orderId}`);
    } else {
      refresh();
      closePanel();
      setShowConvert(false);
    }
  }

  async function handleDecline(reason: string, note: string) {
    await svc.declineRfq(selectedRfq!.rfqId, reason + (note ? ` - ${note}` : ''));
    refresh();
    closePanel();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading RFQs...</div>;
  if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;

  return (
    <div>
      {/* Header Stats - Laboratory Ledger Style */}
      <div className="grid grid-cols-12 gap-8 mb-12">
        <div className="col-span-12 md:col-span-8 flex flex-col justify-end">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Request Overview</p>
          <h1 className="font-headline text-5xl font-black text-on-surface tracking-tighter">RFQ Management</h1>
        </div>
        <div className="col-span-6 md:col-span-2">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Pending Count</p>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="font-headline text-4xl font-bold text-primary tracking-tight">{stats.pending}</span>
              <span className="text-xs text-secondary font-medium">{rfqs.length} total</span>
            </div>
          </div>
        </div>
        <div className="col-span-6 md:col-span-2">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Conversion Rate</p>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="font-headline text-4xl font-bold text-primary tracking-tight">{stats.rate}%</span>
              <span className="material-symbols-outlined text-secondary text-lg">trending_up</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              className={`px-4 py-1.5 rounded-full text-xs border-none cursor-pointer transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search by name, institution, equipment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-low pl-10 pr-4 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 w-72"
            />
          </div>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all border-none bg-transparent cursor-pointer">
            <span className="material-symbols-outlined">download</span>
          </button>
        </div>
      </div>

      {/* RFQ Data Table - Precision Aesthetic */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Ref #</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Institution</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Category</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Budget</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filtered.map(rfq => {
              const isActive = selectedRfq?.rfqId === rfq.rfqId && panelOpen;
              return (
                <tr
                  key={rfq.rfqId}
                  className={`hover:bg-primary-fixed/30 transition-colors cursor-pointer group ${
                    isActive ? 'bg-primary-fixed/10 border-l-4 border-l-secondary' : ''
                  }`}
                  onClick={() => openPanel(rfq)}
                >
                  <td className="px-6 py-5">
                    <span className="font-headline font-bold text-primary tracking-tight">{rfq.referenceNumber || rfq.rfqId.slice(0, 8)}</span>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">{formatDate(rfq.submittedAt)}</div>
                  </td>
                  <td className="px-6 py-5 font-medium text-on-surface">{rfq.name || '-'}</td>
                  <td className="px-6 py-5 text-on-surface-variant text-sm italic">{rfq.institution || '-'}</td>
                  <td className="px-6 py-5">
                    <span className="bg-surface-container px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant uppercase">
                      {rfq.equipmentCategory || '-'}{rfq.specificModel ? ` / ${rfq.specificModel}` : ''}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-headline font-semibold text-primary">{rfq.budgetRange || '-'}</td>
                  <td className="px-6 py-5"><StatusBadge status={rfq.status} /></td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      to={`/admin/rfqs/${rfq.rfqId}`}
                      className="text-on-surface-variant hover:text-primary transition-all p-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-on-surface-variant text-sm">No RFQs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel Overlay (Asymmetric Sidebar) */}
      {selectedRfq && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/10 z-40 transition-opacity duration-300 ${
              panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closePanel}
          />

          {/* Sliding Panel */}
          <div
            className={`fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest z-50 shadow-[0px_0px_60px_rgba(2,36,72,0.12)] flex flex-col border-l border-outline-variant/10 transition-transform duration-300 ease-out ${
              panelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Panel Header */}
            <div className="px-10 py-8 border-b border-outline-variant/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-primary-fixed text-primary rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">article</span>
                </span>
                <div>
                  <h2 className="font-headline text-xl font-bold text-on-surface">
                    {selectedRfq.referenceNumber
                      ? (selectedRfq.referenceNumber.startsWith('RFQ-') ? selectedRfq.referenceNumber : `RFQ-${selectedRfq.referenceNumber}`)
                      : selectedRfq.rfqId.slice(0, 8)}
                  </h2>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">Detailed Analysis</p>
                </div>
              </div>
              <button
                className="p-2 hover:bg-surface-container rounded-full transition-colors"
                onClick={closePanel}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10" style={{ scrollbarWidth: 'none' }}>
              {/* Contact Info Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-7">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Requester</p>
                  <p className="font-medium text-on-surface">{selectedRfq.name || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Institution</p>
                  <p className="font-medium text-on-surface">{selectedRfq.institution || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Email</p>
                  <p className="font-medium text-on-surface text-sm">{selectedRfq.email || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Timeline</p>
                  <p className="font-medium text-on-surface">{selectedRfq.timeline || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Status</p>
                  <div className="mt-1"><StatusBadge status={selectedRfq.status} size="md" /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Submitted</p>
                  <p className="font-medium text-on-surface text-sm">{formatDateTime(selectedRfq.submittedAt)}</p>
                </div>
              </div>

              {/* Equipment Requirements */}
              <div className="bg-surface-container-low p-8 rounded-xl border-l-2 border-primary">
                <h3 className="text-xs font-bold text-primary uppercase tracking-[0.1em] mb-5">Equipment Requirements</h3>
                <ul className="space-y-4">
                  {selectedRfq.equipmentCategory && (
                    <li className="flex items-start gap-3 text-sm text-on-surface-variant leading-relaxed">
                      <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span>Category: <strong className="text-on-surface">{selectedRfq.equipmentCategory}</strong>{selectedRfq.specificModel ? ` / ${selectedRfq.specificModel}` : ''}</span>
                    </li>
                  )}
                  {selectedRfq.quantity && (
                    <li className="flex items-start gap-3 text-sm text-on-surface-variant leading-relaxed">
                      <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span>Quantity: <strong className="text-on-surface">{selectedRfq.quantity}</strong></span>
                    </li>
                  )}
                  {selectedRfq.applicationDescription && (
                    <li className="flex items-start gap-3 text-sm text-on-surface-variant leading-relaxed">
                      <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span>{selectedRfq.applicationDescription}</span>
                    </li>
                  )}
                  {selectedRfq.keySpecifications && (
                    <li className="flex items-start gap-3 text-sm text-on-surface-variant leading-relaxed">
                      <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span>{selectedRfq.keySpecifications}</span>
                    </li>
                  )}
                  {!selectedRfq.equipmentCategory && !selectedRfq.applicationDescription && !selectedRfq.keySpecifications && (
                    <li className="text-sm text-on-surface-variant italic">No equipment details provided.</li>
                  )}
                </ul>
              </div>

              {/* Project Context Ledger */}
              <div className="space-y-5">
                {selectedRfq.budgetRange && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Budget Range</span>
                    <span className="font-headline font-semibold text-on-surface">{selectedRfq.budgetRange}</span>
                  </div>
                )}
                {selectedRfq.fundingStatus && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Funding Status</span>
                    <span className="font-headline font-semibold text-on-surface">{selectedRfq.fundingStatus}</span>
                  </div>
                )}
                {selectedRfq.timeline && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Timeline</span>
                    <span className="font-headline font-semibold text-on-surface">{selectedRfq.timeline}</span>
                  </div>
                )}
                {selectedRfq.referralSource && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Referral Source</span>
                    <span className="font-headline font-semibold text-on-surface">{selectedRfq.referralSource}</span>
                  </div>
                )}
                {selectedRfq.needsBudgetaryQuote && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Budgetary Quote</span>
                    <span className="font-headline font-semibold text-secondary">Requested</span>
                  </div>
                )}
              </div>

              {/* Additional Comments */}
              {selectedRfq.additionalComments && (
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">Additional Comments</p>
                  <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">{selectedRfq.additionalComments}</p>
                </div>
              )}

              {/* Linked Order */}
              {selectedRfq.linkedOrderId && (
                <div className="bg-surface-container-low p-4 rounded-lg flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">link</span>
                  <span className="text-sm text-on-surface">Converted to Order</span>
                  <Link
                    to={`/admin/orders/${selectedRfq.linkedOrderId}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    View Order
                  </Link>
                </div>
              )}

              {/* Full Detail Link */}
              <Link
                to={`/admin/rfqs/${selectedRfq.rfqId}`}
                className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors no-underline"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                View Full Details
              </Link>
            </div>

            {/* Footer Actions */}
            {selectedRfq.status === 'pending' && (
              <div className="px-10 py-8 border-t border-outline-variant/10 grid grid-cols-2 gap-4 bg-surface">
                <button
                  className="px-6 py-4 border border-error text-error rounded-xl font-headline font-bold text-sm hover:bg-error-container/20 transition-all flex items-center justify-center gap-2"
                  onClick={() => setShowDecline(true)}
                >
                  <span className="material-symbols-outlined">block</span>
                  Decline
                </button>
                <button
                  className="px-6 py-4 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-sm hover:bg-secondary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/20"
                  onClick={() => setShowConvert(true)}
                >
                  <span className="material-symbols-outlined">check</span>
                  Convert to Order
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showConvert && selectedRfq && (
        <ConvertToOrderDialog
          open={showConvert}
          onClose={() => setShowConvert(false)}
          rfq={selectedRfq}
          onConfirm={handleConvert}
        />
      )}

      {showDecline && selectedRfq && (
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
