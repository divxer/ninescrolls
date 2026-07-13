import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { evidenceTypeLabel, EVIDENCE_TYPE } from '../../config/evidence';
import { deriveVerification, parseMeta, EvidenceRecord } from '../../pages/admin/evidenceListModel';

interface EvidenceDetailPanelProps {
  record: EvidenceRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-right text-on-surface">{children}</span>
    </div>
  );
}

export function EvidenceDetailPanel({ record, onClose, onDelete }: EvidenceDetailPanelProps) {
  const meta = parseMeta(record.meta);
  const doi = typeof meta.doi === 'string' ? meta.doi : '';
  const journal = typeof meta.journal === 'string' ? meta.journal : '';
  const year = meta.year != null ? String(meta.year) : '';
  const verifiedAt = typeof meta.verifiedAt === 'string' ? meta.verifiedAt : '';
  const checklist = deriveVerification(record);

  return (
    <aside
      role="complementary"
      aria-label="Evidence detail"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-surface p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-on-surface">{record.title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-on-surface-variant hover:text-on-surface">✕</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{evidenceTypeLabel(record.type)}</span>
        <StatusBadge status={record.status} />
        {(record.products ?? []).filter(Boolean).map((slug) => (
          <Link key={slug} to={`/products/${slug}`} className="text-xs text-sky-600 hover:underline">{slug} ↗</Link>
        ))}
      </div>

      <Link to={`/admin/evidence/${record.id}/edit`} className="mt-4 inline-block rounded bg-sky-600 px-4 py-2 text-sm text-white">Edit evidence</Link>

      {record.summary && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-on-surface">Summary</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{record.summary}</p>
        </section>
      )}

      <section className="mt-6 border-t border-slate-200 pt-2">
        {doi && (
          <MetaRow label="Source DOI">
            <a href={record.sourceUrl ?? `https://doi.org/${doi}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">{doi} ↗</a>
          </MetaRow>
        )}
        {journal && <MetaRow label="Journal">{journal}</MetaRow>}
        {year && <MetaRow label="Year">{year}</MetaRow>}
        {verifiedAt && <MetaRow label="Verified">{verifiedAt}</MetaRow>}
        {record.sourceUrl && (
          <MetaRow label="Source">
            <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">View source ↗</a>
          </MetaRow>
        )}
      </section>

      {record.type === EVIDENCE_TYPE.PUBLICATION && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-on-surface">Publication verification</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={item.ok ? 'text-green-600' : 'text-slate-400'}>{item.ok ? '✓' : '○'}</span>
                  {item.label}
                </span>
                <span className="text-right text-on-surface-variant">{item.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto pt-6">
        <button onClick={() => onDelete(record.id)} className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete evidence</button>
      </div>
    </aside>
  );
}
