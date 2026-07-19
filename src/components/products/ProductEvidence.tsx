import { useEffect, useState } from 'react';
import { fetchPublishedEvidence, type PublishedEvidence } from '../../services/evidenceService';
import { journalBadge, productPlatformLabel } from '../../config/evidence';

interface ProductEvidenceProps {
  productSlug: string;
}

const PREVIEW_COUNT = 5;

/**
 * Phase 2 product-page Evidence module. Lists peer-reviewed publications that
 * used the represented platform. Attribution-safe: intro uses represented-
 * platform wording, never the OEM name. Each card shows a science summary line
 * ONLY when the record carries `publicSummary` (data-driven A→B upgrade).
 * Renders nothing when the product has no published publications.
 */
export function ProductEvidence({ productSlug }: ProductEvidenceProps) {
  const [records, setRecords] = useState<PublishedEvidence[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPublishedEvidence(productSlug).then((all) => {
      // `r?.type` is defensive: tolerate a null/malformed array element rather
      // than throwing and blanking the whole page.
      if (active) setRecords(all.filter((r) => r?.type === 'publication'));
    });
    return () => { active = false; };
  }, [productSlug]);

  if (!records || records.length === 0) return null;

  const shown = expanded ? records : records.slice(0, PREVIEW_COUNT);

  return (
    <section data-testid="product-evidence" className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
      <div className="mx-auto max-w-screen-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Research validation</p>
        <h2 className="mt-1 font-headline text-4xl font-semibold tracking-normal text-slate-950">Peer-reviewed research</h2>
        <p className="mt-3 text-lg text-slate-600">
          Published work using {productPlatformLabel(productSlug)} · {records.length} {records.length === 1 ? 'paper' : 'papers'}
        </p>
        <ul className="mt-8 flex flex-col divide-y divide-slate-200">
          {shown.map((rec) => {
            const badge = journalBadge(rec.journal);
            return (
              <li key={rec.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{rec.title}</p>
                  {rec.publicSummary ? (
                    <p className="mt-1 text-sm text-slate-600">{rec.publicSummary}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-500">
                    {badge ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                        {badge}{rec.year ? ` ${rec.year}` : ''}
                      </span>
                    ) : (
                      <>{rec.journal}{rec.journal && rec.year ? ' · ' : ''}{rec.year}</>
                    )}
                  </p>
                </div>
                {rec.sourceUrl ? (
                  <a
                    href={rec.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm font-semibold text-sky-700 hover:underline"
                  >
                    View source ↗
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
        {records.length > PREVIEW_COUNT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-6 text-sm font-semibold text-sky-700 hover:underline"
          >
            {expanded ? 'Show fewer' : `Show all ${records.length} →`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
