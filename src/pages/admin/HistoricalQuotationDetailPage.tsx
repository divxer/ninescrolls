import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getHistoricalQuotation,
  rmbFen,
  usd,
  type HistoricalQuotationDetail,
} from '../../services/priceAdminService';

const date = (value: string | null | undefined) => value ? value.slice(0, 10) : '—';
const provenanceLabel = { CONFIRMED: 'Confirmed', INFERRED: 'Inferred', UNKNOWN: 'Unknown' } as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div>
    <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-on-surface break-words">{children}</dd>
  </div>;
}

function Card({ title, label, children }: { title: string; label?: string; children: ReactNode }) {
  return <section aria-label={label} className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-card md:p-6">
    <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-on-surface-variant">{title}</h2>
    {children}
  </section>;
}

export function HistoricalQuotationDetailPage() {
  const { historicalId } = useParams<{ historicalId: string }>();
  const [record, setRecord] = useState<HistoricalQuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    if (!historicalId) {
      setLoading(false);
      return () => { current = false; };
    }
    void (async () => {
      try {
        const result = await getHistoricalQuotation(historicalId);
        if (current) setRecord(result ?? null);
      } catch (reason: unknown) {
        if (current) setError(reason instanceof Error ? reason.message : 'Failed to load historical quotation.');
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [historicalId]);

  if (loading) return <div className="flex items-center justify-center py-20 font-body text-on-surface-variant">Loading historical quotation…</div>;
  if (error) return <div role="alert" className="rounded-lg bg-error-container p-4 font-body text-on-error-container">Error: {error}</div>;
  if (!record) return <div className="rounded-lg bg-error-container p-4 font-body text-on-error-container">Historical quotation not found.</div>;

  return <div className="space-y-6">
    <Link to="/admin/quotations" className="flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface">
      <span className="material-symbols-outlined text-lg">arrow_back</span>
      Back to quotations
    </Link>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-3xl font-bold text-primary">{record.sourceQuotationNumber || `Historical #${record.sourceRow}`}</h1>
          <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Historical</span>
        </div>
        <p className="mt-1 text-on-surface-variant">{record.customerName}</p>
      </div>
      <p className="rounded-lg border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface-variant">Read-only imported record</p>
    </header>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Quotation overview">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Product">{record.productName}</Field>
          <Field label="Configuration">{record.configuration}</Field>
          <Field label="Legacy status">{record.legacyStatus}</Field>
          <Field label="Customer quoted at">{date(record.quotedAt)}</Field>
          <Field label="Supplier">{record.supplierId}</Field>
          <Field label="Supplier quoted at">{date(record.supplierQuotedAt)}</Field>
        </dl>
      </Card>

      <Card title="Quote evidence">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Supplier quote basis">{record.supplierQuoteBasis}</Field>
          <Field label="Supplier evidence type">{record.supplierEvidenceType}</Field>
          {record.supplierAmountFen != null && <Field label="Supplier amount">{rmbFen(record.supplierAmountFen)}</Field>}
          {record.customerAmountUsdCents != null && <Field label="Customer amount">{usd(record.customerAmountUsdCents)}</Field>}
        </dl>
      </Card>

      <Card title="Raw supplier quote">
        <p className="whitespace-pre-wrap break-words text-sm text-on-surface">{record.supplierQuoteText}</p>
      </Card>
      <Card title="Raw customer quote">
        <p className="whitespace-pre-wrap break-words text-sm text-on-surface">{record.customerQuoteText}</p>
      </Card>

      <Card title="Historical FX" label="Historical FX">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Provenance">{provenanceLabel[record.historicalFxProvenance]}</Field>
          {record.historicalFxRate && <Field label="Rate">{record.historicalFxRate}</Field>}
          {record.historicalFxSource && <Field label="Source">{record.historicalFxSource}</Field>}
          {record.historicalFxNote && <Field label="Note">{record.historicalFxNote}</Field>}
        </dl>
      </Card>

      <Card title="Data quality" label="Data quality">
        <div className="flex flex-wrap gap-2">
          {record.dataQualityFlags.length ? record.dataQualityFlags.map((flag) =>
            <span key={flag} className="rounded-full bg-tertiary-fixed/30 px-3 py-1 text-xs font-bold text-on-tertiary-fixed-variant">{flag}</span>,
          ) : <span className="text-sm text-on-surface-variant">No quality flags</span>}
        </div>
        {record.dataQualityNotes.length > 0 && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-on-surface">
          {record.dataQualityNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}
        </ul>}
      </Card>
    </div>

    <Card title="Source lineage" label="Source lineage">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Source document">{record.sourceDocument}</Field>
        <Field label="Source row">{record.sourceRow}</Field>
        <Field label="Source document hash">{record.sourceDocumentHash}</Field>
        <Field label="Content hash">{record.contentHash}</Field>
        <Field label="Import batch">{record.importBatchId}</Field>
        <Field label="Imported by">{record.importedBy}</Field>
        <Field label="Imported at">{date(record.importedAt)}</Field>
        <Field label="Historical ID">{record.historicalId}</Field>
      </dl>
    </Card>
  </div>;
}
