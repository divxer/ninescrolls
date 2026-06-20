import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsCases } from '../../hooks/useLogisticsCases';
import { StageBadge } from './StageBadge';
import { CASE_TYPE_LABELS, type CaseType } from '../../types/logistics';

export function LogisticsPanel({ orderId }: { orderId: string }) {
  const { cases, loading, error } = useLogisticsCases({ relatedOrderId: orderId });

  useEffect(() => {
    // Depend on the message (not the Error instance) so a new instance each render
    // doesn't re-warn on every render.
    if (error) console.warn('LogisticsPanel: failed to load related logistics cases —', error.message);
  }, [error?.message]);

  // Non-blocking: stay invisible while loading, on error, or when the order has no logistics.
  if (loading || error || !cases.length) return null;

  return (
    <section className="rounded-xl border border-outline-variant p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        Related Logistics Cases
      </h2>
      <div className="divide-y divide-outline-variant">
        {cases.map((c) => (
          <div key={c.caseId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <Link to={`/admin/logistics/${c.caseId}`} className="font-semibold text-primary hover:underline">
              {c.caseNumber}
            </Link>
            <span className="text-on-surface-variant">{CASE_TYPE_LABELS[c.caseType as CaseType]}</span>
            <StageBadge stage={c.currentStage} />
            <span className="text-xs text-on-surface-variant">
              {c.customsRequired ? 'Customs required' : 'No customs'}
            </span>
            <span className="ml-auto text-xs text-on-surface-variant">
              {new Date(c.updatedAt).toLocaleDateString('en-US')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
