import { useState } from 'react';
import { Modal } from './Modal';
import { PRODUCT_MODELS, type RfqSubmission } from '../../types/admin';

interface ConvertToOrderDialogProps {
  open: boolean;
  onClose: () => void;
  rfq: RfqSubmission;
  onConfirm: (overrides: {
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    notes?: string;
  }) => Promise<void>;
}

export function ConvertToOrderDialog({ open, onClose, rfq, onConfirm }: ConvertToOrderDialogProps) {
  const [productModel, setProductModel] = useState(rfq.specificModel || rfq.equipmentCategory || '');
  const [productName, setProductName] = useState('');
  const [configuration, setConfiguration] = useState(rfq.keySpecifications || '');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        productModel: productModel || undefined,
        productName: productName || undefined,
        configuration: configuration || undefined,
        quoteAmount: quoteAmount ? parseFloat(quoteAmount) : undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Convert RFQ to Order">
      <p style={{ marginBottom: '16px', color: '#666' }}>
        Creating order from RFQ {rfq.referenceNumber || rfq.rfqId}.
        Contact: {rfq.name} ({rfq.institution})
      </p>

      {error && <div className="admin-error">{error}</div>}

      <div className="form-field">
        <label>Equipment Model</label>
        <select value={productModel} onChange={(e) => setProductModel(e.target.value)} className="admin-filter-select" style={{ width: '100%' }}>
          <option value="">Select...</option>
          {PRODUCT_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Equipment Name</label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Auto-filled based on model"
          className="admin-search-input"
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-field">
        <label>Configuration</label>
        <textarea
          value={configuration}
          onChange={(e) => setConfiguration(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
      </div>

      <div className="form-field">
        <label>Quote Amount ($)</label>
        <input
          type="number"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
          placeholder="Optional"
          className="admin-search-input"
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-field">
        <label>Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button className="admin-btn-sm admin-btn-outline" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="admin-btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Converting...' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
