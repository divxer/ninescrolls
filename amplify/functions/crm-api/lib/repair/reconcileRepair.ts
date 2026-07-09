import { acquireLease, releaseLeaseKeepCursor } from '../sweep/sweepState';
import { queryPendingMarkers, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, type RepairMarkerItem } from './repairMarker';
import { replayStructuredSideEffects, replayAnalyticsSideEffects, type ReplayResult } from './replaySideEffects';

const LAMBDA_TIMEOUT_SEC = 120; // keep in sync with crm-api/resource.ts
const MAX_ATTEMPTS = 5;

async function replayFor(m: RepairMarkerItem): Promise<ReplayResult> {
  if (m.unitType === 'analytics') {
    return replayAnalyticsSideEffects({ visitorId: m.unitKey, targetOrgId: m.targetOrgId, operator: m.operator, createdAt: m.createdAt });
  }
  return replayStructuredSideEffects({
    sourceType: m.sourceType ?? '', sourceEntityId: m.sourceEntityId ?? '', backfillPk: m.backfillPk ?? null,
    targetOrgId: m.targetOrgId, unitKey: m.unitKey, operator: m.operator, createdAt: m.createdAt,
    affectedEventIds: m.affectedEventIds ?? [], movedCount: m.movedCount ?? 0, contactStatus: m.contactStatus ?? 'missing_email',
  });
}

export async function reconcileRepair(args: { limit?: number }): Promise<Record<string, unknown>> {
  const nowIso = new Date().toISOString();
  const lease = await acquireLease('repair', 'drain', LAMBDA_TIMEOUT_SEC, nowIso);
  if (!lease) return { skippedLeaseHeld: true };

  const limit = args.limit ?? 100;
  const counters = { examined: 0, repaired: 0, inProgress: 0, blocked: 0, retrying: 0, stuck: 0, errors: 0 };
  const { markers, hasMore } = await queryPendingMarkers(limit);

  for (const m of markers) {
    counters.examined += 1;
    try {
      const r = await replayFor(m);
      if (r.ok) {
        await deleteRepairMarker(m.unitType, m.unitKey); counters.repaired += 1;
      } else if (r.errorType === 'in_progress' && !r.churning) {
        // Forward progress (retro has more pages) — keep pending, never counts as an attempt.
        await touchInProgress(m, nowIso); counters.inProgress += 1;
      } else if (r.errorType === 'source_conflict') {
        await markStuck(m, 'source_conflict', 'source_conflict', nowIso); counters.blocked += 1;
      } else { // transient, OR a churning retro (in_progress re-failing the SAME sessions with no
               // progress): age it through the attempt budget so a persistently-poison marker reaches
               // `stuck` (surfaces in Health) instead of touchInProgress-ing forever.
        const err = r.error ?? (r.errorType === 'in_progress' ? 'retro_churning' : 'transient');
        if ((m.attemptCount ?? 0) + 1 >= MAX_ATTEMPTS) { await markStuck(m, 'max_attempts', err, nowIso); counters.stuck += 1; }
        else { await bumpAttempt(m, err, nowIso); counters.retrying += 1; }
      }
    } catch (err) {
      // A bookkeeping write failed (replayFor never throws). Isolate: count it, leave the marker
      // pending, keep draining the rest. The lease still releases at the end; next fire retries it.
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.repair.marker_error', unitType: m.unitType, unitKey: m.unitKey, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  const summary = { ...counters, hasMore };
  await releaseLeaseKeepCursor('repair', 'drain', lease, { lastSummary: summary, hasMore });
  console.log(JSON.stringify({ event: 'crm.repair.summary', ...summary }));
  return summary;
}
