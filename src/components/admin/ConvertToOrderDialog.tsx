import { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { PRODUCT_MODELS, type RfqSubmission } from '../../types/admin';

// -- Model -> default equipment name mapping --
const MODEL_NAME_DEFAULTS: Record<string, string> = {
  ICP: 'ICP-150 Inductively Coupled Plasma Etcher',
  PECVD: 'PECVD-150 Plasma Enhanced CVD System',
  Sputter: 'Sputter-150-C Magnetron Sputtering System',
  ALD: 'ALD-150 Atomic Layer Deposition System',
  RIE: 'RIE-150 Reactive Ion Etcher',
  IBE: 'IBE-150 Ion Beam Etcher',
  'HDP-CVD': 'HDP-CVD-150 High Density Plasma CVD System',
};

// -- Fuzzy-match free-text to a PRODUCT_MODELS value --
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

// -- Quote JSON sidecar type --
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

// -- Component --
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

  // -- Import from quote JSON --
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
      <p className="text-sm text-on-surface-variant mb-4">
        Creating order from RFQ {rfq.referenceNumber || rfq.rfqId}.
        Contact: {rfq.name} ({rfq.institution})
      </p>

      {/* Import from quote JSON */}
      <div className="flex items-center gap-3 mb-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
        <button
          type="button"
          className="bg-surface-container-low border border-outline-variant/30 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-surface-container transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="material-symbols-outlined text-sm align-middle mr-1">upload</span>
          Import from Quote
        </button>
        {importedFile ? (
          <span className="text-xs font-medium text-green-700">
            <span className="material-symbols-outlined text-sm align-middle mr-0.5">check_circle</span>
            {importedFile}
          </span>
        ) : (
          <span className="text-[10px] text-on-surface-variant">
            Select the .json file generated with your quote PDF
          </span>
        )}
      </div>

      {/* Collapsible RFQ context */}
      {(contextItems.length > 0 || shippingAddress || rfq.applicationDescription) && (
        <div className="mb-5">
          <button
            type="button"
            className="text-xs font-medium text-secondary cursor-pointer flex items-center gap-1"
            onClick={() => setShowContext(!showContext)}
          >
            <span
              className="material-symbols-outlined text-sm transition-transform"
              style={{ transform: showContext ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              chevron_right
            </span>
            RFQ Details
          </button>
          {showContext && (
            <div className="mt-3">
              {contextItems.length > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg mb-3">
                  {contextItems.map((item) => (
                    <div key={item.label}>
                      <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                        {item.label}
                      </span>
                      <span className="text-sm text-on-surface">{String(item.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {shippingAddress && (
                <div className="p-4 bg-surface-container-low rounded-lg mb-3">
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Shipping
                  </span>
                  <span className="text-sm text-on-surface">{shippingAddress}</span>
                </div>
              )}
              {rfq.applicationDescription && (
                <div className="p-4 bg-surface-container-low rounded-lg">
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Application
                  </span>
                  <span className="text-sm text-on-surface line-clamp-3">{rfq.applicationDescription}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Equipment Model <span className="text-error">*</span>
          </label>
          <select
            value={productModel}
            onChange={(e) => {
              setProductModel(e.target.value);
              setImportedFile('');
              setTouched((t) => ({ ...t, productModel: true }));
            }}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          >
            <option value="">Select model...</option>
            {PRODUCT_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {validationErrors.productModel && (
            <span className="text-error text-[10px] mt-1 block">{validationErrors.productModel}</span>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Equipment Name
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={productModel && !MODEL_NAME_DEFAULTS[productModel]
              ? 'Enter equipment name'
              : 'Auto-filled from model selection'}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
          {!importedFile && productModel && MODEL_NAME_DEFAULTS[productModel] && productName === MODEL_NAME_DEFAULTS[productModel] && (
            <span className="text-[10px] text-on-surface-variant mt-1 block">
              Auto-filled from model. You can edit this.
            </span>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Configuration
          </label>
          <textarea
            value={configuration}
            onChange={(e) => setConfiguration(e.target.value)}
            rows={4}
            placeholder={'One item per line, e.g.:\n2x DC 1000W Targets\n1x RF 600W Source\nTMP + Dry Pump'}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Quote Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
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
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 pl-7 pr-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
              />
            </div>
            {validationErrors.quoteAmount && (
              <span className="text-error text-[10px] mt-1 block">{validationErrors.quoteAmount}</span>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Quote Number
            </label>
            <input
              type="text"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="e.g. NS-Q-2026-CSULB-001"
              className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
            />
            <span className="text-[10px] text-on-surface-variant mt-1 block">
              Auto-generated. You can edit this.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Internal Notes <span className="text-[10px] font-normal normal-case tracking-normal text-on-surface-variant">(Optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any internal notes about this order..."
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
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
          disabled={submitting || !!validationErrors.productModel}
        >
          {submitting ? 'Creating Order...' : 'Create Order'}
        </button>
      </div>
    </Modal>
  );
}
