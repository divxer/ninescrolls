import { useState } from 'react';
import { Modal } from './Modal';
import { PRODUCT_MODELS } from '../../types/admin';

const MODEL_NAME_DEFAULTS: Record<string, string> = {
  ICP: 'ICP-150 Inductively Coupled Plasma Etcher',
  PECVD: 'PECVD-150 Plasma Enhanced CVD System',
  Sputter: 'Sputter-150-C Magnetron Sputtering System',
  ALD: 'ALD-150 Atomic Layer Deposition System',
  RIE: 'RIE-150 Reactive Ion Etcher',
  IBE: 'IBE-150 Ion Beam Etcher',
  'HDP-CVD': 'HDP-CVD-150 High Density Plasma CVD System',
};

function formatCurrency(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
}

interface EditSpecsDialogProps {
  open: boolean;
  onClose: () => void;
  initial: {
    productModel?: string | null;
    productName?: string | null;
    configuration?: string | null;
    quoteAmount?: number | null;
    quoteNumber?: string | null;
    poNumber?: string | null;
    department?: string | null;
  };
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}

export function EditSpecsDialog({ open, onClose, initial, onSave }: EditSpecsDialogProps) {
  const [productModel, setProductModel] = useState(initial.productModel || '');
  const [productName, setProductName] = useState(initial.productName || '');
  const [configuration, setConfiguration] = useState(initial.configuration || '');
  const [quoteAmountRaw, setQuoteAmountRaw] = useState(
    initial.quoteAmount != null ? formatCurrency(String(initial.quoteAmount)) : '',
  );
  const [quoteNumber, setQuoteNumber] = useState(initial.quoteNumber || '');
  const [poNumber, setPoNumber] = useState(initial.poNumber || '');
  const [department, setDepartment] = useState(initial.department || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const quoteAmountNum = parseFloat(quoteAmountRaw.replace(/[^0-9.]/g, ''));
  const amountInvalid = quoteAmountRaw !== '' && (isNaN(quoteAmountNum) || quoteAmountNum < 0);

  async function handleSubmit() {
    if (amountInvalid) return;
    setSubmitting(true);
    setError('');
    try {
      const updates: Record<string, unknown> = {
        productModel: productModel || null,
        productName: productName || null,
        configuration: configuration || null,
        quoteAmount: quoteAmountRaw ? quoteAmountNum : null,
        quoteNumber: quoteNumber || null,
        poNumber: poNumber || null,
        department: department || null,
      };
      await onSave(updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = 'block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1';
  const inputCls = 'w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none';

  return (
    <Modal open={open} onClose={onClose} title="Edit Product Specifications">
      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Equipment Model</label>
          <select
            value={productModel}
            onChange={(e) => {
              setProductModel(e.target.value);
              if (MODEL_NAME_DEFAULTS[e.target.value]) {
                setProductName(MODEL_NAME_DEFAULTS[e.target.value]);
              }
            }}
            className={inputCls}
          >
            <option value="">Select model...</option>
            {PRODUCT_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Equipment Name</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. RIE-150 Reactive Ion Etcher"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Configuration</label>
          <textarea
            value={configuration}
            onChange={(e) => setConfiguration(e.target.value)}
            rows={3}
            placeholder="System configuration details..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Quote Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={quoteAmountRaw}
                onChange={(e) => setQuoteAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                onBlur={() => { if (quoteAmountRaw) setQuoteAmountRaw(formatCurrency(quoteAmountRaw)); }}
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
            {amountInvalid && (
              <span className="text-error text-[10px] mt-1 block">Must be a positive number</span>
            )}
          </div>

          <div>
            <label className={labelCls}>Quote Number</label>
            <input
              type="text"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="e.g. NS-Q-2026-WDC-002"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>PO Number</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Purchase order number"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Material Science Labs"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button
          className="border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low transition-colors"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          className="bg-secondary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || amountInvalid}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}
