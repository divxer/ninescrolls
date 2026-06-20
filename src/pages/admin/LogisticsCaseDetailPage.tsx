import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLogisticsCase } from '../../hooks/useLogisticsCases';
import * as svc from '../../services/logisticsAdminService';
import { StageBadge, CustomsBadge } from '../../components/admin/StageBadge';
import { MilestoneProgress } from '../../components/admin/MilestoneProgress';
import {
  enabledStagesFor, isCustomsStage, nextAdvanceableStages,
  CASE_TYPE_LABELS, LEG_DIRECTION_LABELS, STAGE_LABELS,
} from '../../types/logistics';

export function LogisticsCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { logisticsCase: c, loading, error, refresh } = useLogisticsCase(caseId);
  const [target, setTarget] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  if (loading) return <div className="p-6 text-on-surface-variant">Loading…</div>;
  if (error || !c) return <div className="p-6 text-error">{error?.message || 'Case not found'}</div>;

  const enabled = enabledStagesFor(c.caseType, c.enabledStages);
  // Guided next-step options (next happy stage + CUSTOMS_HOLD branch + CANCELLED) —
  // prevents accidental far jumps like PRODUCTION → CLOSED while still allowing
  // exception states to be skipped. The backend remains the hard floor.
  const advanceOptions = nextAdvanceableStages(c.currentStage, enabled);
  const customsLegMissing = c.customsRequired && (c.legs || []).some((l) => l.customsRequired && !l.customsStatus);

  async function advance() {
    if (!caseId || !target) return;
    setBusy(true);
    setAdvanceError(null);
    try {
      await svc.advanceLogisticsStage(caseId, target, detail || undefined, false);
      setTarget(''); setDetail(''); refresh();
    } catch (e) {
      setAdvanceError(e instanceof Error ? e.message : 'Failed to advance stage');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/logistics" className="text-sm text-primary hover:underline">← All cases</Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-on-surface">{c.caseNumber}</h1>
        <StageBadge stage={c.currentStage} size="md" />
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase">{CASE_TYPE_LABELS[c.caseType]}</span>
      </header>
      <div className="text-sm text-on-surface-variant">
        <span>{c.customerName}</span>{c.contactName ? ` · ${c.contactName}` : ''}
        {c.relatedOrderId && <> · <Link className="text-primary hover:underline" to={`/admin/orders/${c.relatedOrderId}`}>Order {c.relatedOrderId}</Link></>}
        {!c.relatedOrderId && c.relatedEntityType && <> · {c.relatedEntityType}: {c.relatedEntityId}</>}
      </div>

      {customsLegMissing && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠ A customs-bearing leg has no customs status set.
        </div>
      )}

      {/* Milestone progress */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Progress</h2>
        <MilestoneProgress enabledStages={enabled} currentStage={c.currentStage} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-on-surface-variant">
            Advance to stage
            <select aria-label="Advance to stage" value={target} onChange={(e) => setTarget(e.target.value)}
              className="mt-1 block rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
              <option value="">Select…</option>
              {advanceOptions.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Note (optional)"
            className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm" />
          <button onClick={advance} disabled={!target || busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">Advance</button>
        </div>
        {advanceError && <p className="text-error text-sm">{advanceError}</p>}
      </section>

      {/* Legs */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Shipment Legs</h2>
        {(c.legs || []).map((l) => (
          <div key={l.legId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
            <span className="font-semibold">{LEG_DIRECTION_LABELS[l.direction]}</span>
            {l.carrier && <span>{l.carrier}</span>}
            {l.trackingNumber && (l.trackingUrl
              ? <a href={l.trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{l.trackingNumber}</a>
              : <span>{l.trackingNumber}</span>)}
            {l.freightForwarder && <span className="text-on-surface-variant">{l.freightForwarder}</span>}
            {l.blOrAwb && <span className="text-on-surface-variant">{l.blOrAwb}</span>}
            <CustomsBadge status={l.customsStatus} />
          </div>
        ))}
        {!(c.legs || []).length && <p className="text-sm text-on-surface-variant">No legs yet.</p>}
        {/* Task 6B wires the add / edit / remove leg forms into this section. */}
      </section>

      {/* Milestone log */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">History</h2>
        <ol className="space-y-2">
          {[...(c.milestoneLog || [])].reverse().map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="material-symbols-rounded text-[16px] text-on-surface-variant">
                {e.internalOnly ? 'lock' : 'history'}
              </span>
              <div>
                <div className="font-medium">
                  {e.fromStage ? `${STAGE_LABELS[e.fromStage]} → ` : ''}{e.toStage ? STAGE_LABELS[e.toStage] : e.action}
                  {e.toStage && isCustomsStage(e.toStage) && <span className="ml-1 text-tertiary">(customs)</span>}
                </div>
                <div className="text-xs text-on-surface-variant">{e.operator} · {new Date(e.timestamp).toLocaleString('en-US')}{e.detail ? ` · ${e.detail}` : ''}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
