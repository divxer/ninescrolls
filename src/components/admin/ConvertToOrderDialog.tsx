import { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { PRODUCT_MODELS, type RfqSubmission } from '../../types/admin';

// ── Model → default equipment name mapping ──────────────────────────────────
const MODEL_NAME_DEFAULTS: Record<string, string> = {
  ICP: 'ICP-150 Inductively Coupled Plasma Etcher',
  PECVD: 'PECVD-150 Plasma Enhanced CVD System',
  Sputter: 'Sputter-150-C Magnetron Sputtering System',
  ALD: 'ALD-150 Atomic Layer Deposition System',
  RIE: 'RIE-150 Reactive Ion Etcher',
  IBE: 'IBE-150 Ion Beam Etcher',
  'HDP-CVD': 'HDP-CVD-150 High Density Plasma CVD System',
};

// ── Fuzzy-match free-text to a PRODUCT_MODELS value ─────────────────────────
function detectModel(text: string): string {
  const lower = text.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/hdp[\s-]?cvd/i, 'HDP-CVD'],
    [/sputter/i, 'Sputter'],
    [/pecvd|plasma.?enhanced.?cvd/i, 'PECVD'],
    [/\bicp\b/i, 'ICP'],
    [/\bald\b/i, 'ALD'],
    [/\brie\b|reactive.?ion/i, 'RIE'],
    [/\bibe\b|ion.?beam/i, 'IBE'],
  ];
  for (const [re, model] of patterns) {
    if (re.test(lower)) return model;
  }
  return '';
}

function resolveInitialModel(rfq: RfqSubmission): string {
  const raw = rfq.specificModel || rfq.equipmentCategory || '';
  if (PRODUCT_MODELS.includes(raw)) return raw;
  const sources = [rfq.specificModel, rfq.additionalComments, rfq.equipmentCategory].filter(Boolean).join(' ');
  return detectModel(sources);
}

// ── Quote JSON sidecar type ─────────────────────────────────────────────────
interface QuoteMetadata {
  quoteNumber?: string;
  productModel?: string;
  productName?: string;
  configuration?: string;
  quoteAmount?: number;
}

function generateQuoteNumber(rfq: RfqSubmission): string {
  const year = new Date().getFullYear();
  const abbr = (rfq.institution || 'UNKNOWN')
    .replace(/^(The|University of|California State University)\s+/i, '')
    .split(/[\s,]+/)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 6);
  return `NS-Q-${year}-${abbr}-001`;
}

function formatCurrency(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
}

// ── Component ───────────────────────────────────────────────────────────────
interface ConvertToOrderDialogProps {
  open: boolean;
  onClose: () => void;
  rfq: RfqSubmission;
  onConfirm: (overrides: {
    productModel?: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteNumber?: string;
    notes?: string;
  }) => Promise<void>;
}

export function ConvertToOrderDialog({ open, onClose, rfq, onConfirm }: ConvertToOrderDialogProps) {
  const [productModel, setProductModel] = useState(() => resolveInitialModel(rfq));
  const [productName, setProductName] = useState('');
  const [configuration, setConfiguration] = useState(rfq.keySpecifications || '');
  const [quoteAmountRaw, setQuoteAmountRaw] = useState('');
  const [quoteNumber, setQuoteNumber] = useState(() => generateQuoteNumber(rfq));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [importedFile, setImportedFile] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill equipment name when model changes (skip if imported)
  useEffect(() => {
    if (!importedFile && productModel && MODEL_NAME_DEFAULTS[productModel]) {
      setProductName(MODEL_NAME_DEFAULTS[productModel]);
    } else if (productModel === 'Other') {
      setProductName('');
    }
  }, [productModel, importedFile]);

  // ── Import from quote JSON ──────────────────────────────────────────────
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as QuoteMetadata;
        if (!data.quoteNumber && !data.quoteAmount && !data.productModel) {
          setError('Invalid file: missing quoteNumber, quoteAmount, or productModel.');
          return;
        }

        if (data.productModel && PRODUCT_MODELS.includes(data.productModel)) {
          setProductModel(data.productModel);
        } else if (data.productModel) {
          const matched = detectModel(data.productModel);
          if (matched) setProductModel(matched);
        }
        if (data.productName) setProductName(data.productName);
        if (data.configuration) setConfiguration(data.configuration);
        if (data.quoteAmount != null) setQuoteAmountRaw(formatCurrency(String(data.quoteAmount)));
        if (data.quoteNumber) setQuoteNumber(data.quoteNumber);

        setImportedFile(file.name);
        setError('');
      } catch {
        setError('Failed to parse JSON. Please select a valid quote metadata file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const quoteAmountNum = parseFloat(quoteAmountRaw.replace(/[^0-9.]/g, ''));
  const validationErrors: Record<string, string> = {};
  if (touched.productModel && !productModel) {
    validationErrors.productModel = 'Equipment model is required';
  }
  if (touched.quoteAmount && quoteAmountRaw && (isNaN(quoteAmountNum) || quoteAmountNum < 0)) {
    validationErrors.quoteAmount = 'Must be a positive number';
  }

  async function handleSubmit() {
    setTouched({ productModel: true, quoteAmount: true });
    if (!productModel) return;
    if (quoteAmountRaw && (isNaN(quoteAmountNum) || quoteAmountNum < 0)) return;

    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        productModel: productModel || undefined,
        productName: productName || undefined,
        configuration: configuration || undefined,
        quoteAmount: quoteAmountRaw ? quoteAmountNum : undefined,
        quoteNumber: quoteNumber || undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert');
    } finally {
      setSubmitting(false);
    }
  }

  const contextItems = [
    { label: 'Budget Range', value: rfq.budgetRange },
    { label: 'Timeline', value: rfq.timeline },
    { label: 'Quantity', value: rfq.quantity },
    { label: 'Funding', value: rfq.fundingStatus },
  ].filter((item) => item.value);

  const shippingAddress = [rfq.shippingAddress, rfq.shippingCity, rfq.shippingState, rfq.shippingZipCode]
    .filter(Boolean)
    .join(', ');

  return (
    <Modal open={open} onClose={onClose} title="Convert RFQ to Order">
      <p className="convert-dialog-subtitle">
        Creating order from RFQ {rfq.referenceNumber || rfq.rfqId}.
        Contact: {rfq.name} ({rfq.institution})
      </p>

      {/* Import from quote JSON */}
      <div className="convert-dialog-import">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="admin-btn-sm admin-btn-outline convert-dialog-import-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          &#8593; Import from Quote
        </button>
        {importedFile ? (
          <span className="convert-dialog-import-success">&#10003; {importedFile}</span>
        ) : (
          <span className="form-hint" style={{ marginTop: 0 }}>
            Select the .json file generated with your quote PDF
          </span>
        )}
      </div>

      {/* Collapsible RFQ context */}
      {(contextItems.length > 0 || shippingAddress || rfq.applicationDescription) && (
        <div className="convert-dialog-context">
          <button
            type="button"
            className="convert-dialog-context-toggle"
            onClick={() => setShowContext(!showContext)}
          >
            <span className="convert-dialog-context-arrow" data-open={showContext}>&#9654;</span>
            RFQ Details
          </button>
          {showContext && (
            <div className="convert-dialog-context-body">
              {contextItems.length > 0 && (
                <div className="convert-dialog-context-grid">
                  {contextItems.map((item) => (
                    <div key={item.label}>
                      <span className="convert-dialog-context-label">{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {shippingAddress && (
                <div className="convert-dialog-context-row">
                  <span className="convert-dialog-context-label">Shipping</span>
                  <span>{shippingAddress}</span>
                </div>
              )}
              {rfq.applicationDescription && (
                <div className="convert-dialog-context-row">
                  <span className="convert-dialog-context-label">Application</span>
                  <span className="convert-dialog-context-truncate">{rfq.applicationDescription}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div className="admin-error">{error}</div>}

      <div className="form-field">
        <label>Equipment Model <span className="form-required">*</span></label>
        <select
          value={productModel}
          onChange={(e) => {
            setProductModel(e.target.value);
            setImportedFile('');
            setTouched((t) => ({ ...t, productModel: true }));
          }}
        >
          <option value="">Select model...</option>
          {PRODUCT_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {validationErrors.productModel && (
          <span className="form-error-inline">{validationErrors.productModel}</span>
        )}
      </div>

      <div className="form-field">
        <label>Equipment Name</label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder={productModel && !MODEL_NAME_DEFAULTS[productModel]
            ? 'Enter equipment name'
            : 'Auto-filled from model selection'}
        />
        {!importedFile && productModel && MODEL_NAME_DEFAULTS[productModel] && productName === MODEL_NAME_DEFAULTS[productModel] && (
          <span className="form-hint">Auto-filled from model. You can edit this.</span>
        )}
      </div>

      <div className="form-field">
        <label>Configuration</label>
        <textarea
          value={configuration}
          onChange={(e) => setConfiguration(e.target.value)}
          rows={4}
          placeholder={'One item per line, e.g.:\n2x DC 1000W Targets\n1x RF 600W Source\nTMP + Dry Pump'}
        />
      </div>

      <div className="admin-form-row">
        <div className="form-field">
          <label>Quote Amount</label>
          <div className="form-input-prefix">
            <span className="form-input-prefix-label">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={quoteAmountRaw}
              onChange={(e) => {
                setQuoteAmountRaw(e.target.value.replace(/[^0-9.]/g, ''));
                setTouched((t) => ({ ...t, quoteAmount: true }));
              }}
              onBlur={() => {
                if (quoteAmountRaw) setQuoteAmountRaw(formatCurrency(quoteAmountRaw));
              }}
              placeholder="0.00"
            />
          </div>
          {validationErrors.quoteAmount && (
            <span className="form-error-inline">{validationErrors.quoteAmount}</span>
          )}
        </div>

        <div className="form-field">
          <label>Quote Number</label>
          <input
            type="text"
            value={quoteNumber}
            onChange={(e) => setQuoteNumber(e.target.value)}
            placeholder="e.g. NS-Q-2026-CSULB-001"
          />
          <span className="form-hint">Auto-generated. You can edit this.</span>
        </div>
      </div>

      <div className="form-field">
        <label>Internal Notes <span className="form-optional">(Optional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any internal notes about this order..."
        />
      </div>

      <div className="convert-dialog-actions">
        <button className="admin-btn-sm admin-btn-outline" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="admin-btn-primary" onClick={handleSubmit} disabled={submitting || !!validationErrors.productModel}>
          {submitting ? 'Creating Order...' : 'Create Order'}
        </button>
      </div>
    </Modal>
  );
}
