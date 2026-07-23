import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { acquireLease, releaseLeaseKeepCursor, readState, persistPage } from '../sweep/sweepState';
import {
  queryPendingMarkers, deleteRepairMarkerIfUnchanged, markStuck, bumpAttempt, touchInProgress,
  queryBuildingOlderThan, promoteAbandonedBuilding, markStuckV2, bumpAttemptFenced,
  deleteRepairMarkerFenced, queryStuckByReason, republishStuckFenced,
  type RepairMarkerItem, type StructuredMarkerV2,
} from './repairMarker';
import { replayStructuredSideEffects, replayAnalyticsSideEffects, resolveEffectiveTarget, type ReplayResult } from './replaySideEffects';

const LAMBDA_TIMEOUT_SEC = 120; // keep in sync with crm-api/resource.ts
const LINK_LAMBDA_TIMEOUT_MS = 120_000; // keep in sync with crm-api/resource.ts (link Lambda timeout)
const MAX_ATTEMPTS = 5;

// Merge-residual VISIBILITY probe (scope-cut 2026-07-22: no draining, no convergence claims).
const MERGE_LAG_HORIZON_MS = 15 * 60 * 1000; // keep in sync with organization-api MERGE_LAG_HORIZON_MS
// Every GSI2SK prefix that shares an ORG#<orgId> partition, verified against the real writers:
// RFQ# (submit-rfq), ORDER# (convertRfqToOrder), LEAD# (submit-lead), CONTACT#/TLEVENT# (crm keys.ts).
// AUDIT# (LINK_AUDIT rows, keys.ts auditKeys) is known-immutable and deliberately NOT probed.
// backend.ts also documents FEEDBACK# on this partition, but no writer exists — comment-only schema.
const PROBE_PREFIXES = ['RFQ#', 'ORDER#', 'LEAD#', 'CONTACT#', 'TLEVENT#'] as const;
const PROBE_MARKER_LIMIT = 10;   // markers per cycle, oldest first
const PROBE_PAGE_LIMIT = 20;     // first page ONLY — presence measurement, never totals
const PROBE_SAMPLE_CAP = 10;     // PKs total across the five queries

type Counters = {
  examined: number; repaired: number; inProgress: number; blocked: number; retrying: number;
  stuck: number; errors: number; aged: number; raced: number; recovered: number; probed: number;
};

// Pending markers arrive from ONE partition but in two shapes: v1 (analytics + pre-Task-10
// structured) and v2 (generation-suffixed structured). `generation` is the discriminator.
type DrainMarker = RepairMarkerItem & Partial<Pick<StructuredMarkerV2, 'generation' | 'customerEmail' | 'affectedEventIdsSample'>>;

function asV2(m: DrainMarker): StructuredMarkerV2 | null {
  return m.unitType === 'structured' && m.generation !== undefined ? (m as unknown as StructuredMarkerV2) : null;
}

async function replayFor(m: DrainMarker): Promise<ReplayResult> {
  if (m.unitType === 'analytics') {
    // markerOwned: the drainer read this marker off the pending partition and
    // does version-fenced bookkeeping on it — the retro must not self-bump.
    return replayAnalyticsSideEffects({ visitorId: m.unitKey, targetOrgId: m.targetOrgId, operator: m.operator, createdAt: m.createdAt, markerOwned: true });
  }
  const v2 = m.generation !== undefined;
  return replayStructuredSideEffects({
    sourceType: m.sourceType ?? '', sourceEntityId: m.sourceEntityId ?? '', backfillPk: m.backfillPk ?? null,
    targetOrgId: m.targetOrgId, unitKey: m.unitKey, operator: m.operator, createdAt: m.createdAt,
    affectedEventIds: (v2 ? m.affectedEventIdsSample : m.affectedEventIds) ?? [],
    movedCount: m.movedCount ?? 0, contactStatus: m.contactStatus ?? 'missing_email',
    // Generational replay (Task 8): resolve-first, fenced writes, contact retry via customerEmail.
    ...(v2 ? { generation: m.generation, customerEmail: m.customerEmail ?? null } : {}),
  });
}

// Building-aging: a marker abandoned mid-transaction (link Lambda died before sealing) surfaces
// after 2× the link Lambda timeout. promoteAbandonedBuilding carries its own building+version+age
// condition, so {lost:true} = fresh foreground activity → silent skip.
async function agingPass(nowIso: string, counters: Counters): Promise<void> {
  const cutoffIso = new Date(Date.parse(nowIso) - 2 * LINK_LAMBDA_TIMEOUT_MS).toISOString();
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await queryBuildingOlderThan(cutoffIso, 25, lastKey);
    for (const b of page.markers) {
      const r = await promoteAbandonedBuilding(b, cutoffIso, nowIso);
      if (!r.lost) counters.aged += 1;
    }
    lastKey = page.lastKey;
  } while (lastKey);
}

// STUCK recovery (R5 blocker 3): markStuckV2 removes a marker from the pending partition, so a
// fixed org chain must be actively re-checked. Keyed-partition query (R6: no FilterExpression) with
// a PERSISTED ROTATION CURSOR on the 3C drain state item (R7: 25 still-unavailable head markers
// must not starve the tail), updated under the drain lease; wraps to null at partition end.
async function recoveryPass(lease: string, nowIso: string, counters: Counters): Promise<void> {
  const state = await readState('repair', 'drain');
  const page = await queryStuckByReason('target_unavailable', 25, state.cursor);
  for (const m of page.markers) {
    try {
      const target = await resolveEffectiveTarget(m.targetOrgId);
      if (target.status !== 'active') continue;             // still unavailable → leave stuck
      const r = await republishStuckFenced(m, nowIso);      // stuck→pending: NEXT drain repairs it
      if (!r.lost) counters.recovered += 1;                 // {lost:true} = another actor moved it → skip
    } catch (err) {
      // Resolver THROW (org-read failure) is transient: leave stuck, retry next cycle — never
      // misclassify a wobbly read as still-unavailable-forever or as recovered.
      console.error(JSON.stringify({ event: 'crm.repair.recovery_error', unitKey: m.unitKey, generation: m.generation, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  await persistPage('repair', 'drain', lease, {
    cursor: page.lastKey,                                   // undefined persists as null = wrap to head
    hasMore: !!page.lastKey,
    counters: { recovered: counters.recovered },
    leaseExpiresAt: new Date(Date.parse(nowIso) + 2 * LAMBDA_TIMEOUT_SEC * 1000).toISOString(),
  });
}

// Merge-residual VISIBILITY probe (R9 mechanics): discover pending_probe markers past the lag
// horizon via a KEY condition (GSI1SK stores mergedAt, so `mergedAt <= now-15min` ⟺
// `lagHorizonAt <= now`), take FIVE first-page presence measurements on the archived org's GSI2
// partition, and flip pending_probe→needs_review under a state+version fence. NO draining.
async function mergeResidualProbe(nowIso: string, counters: Counters): Promise<void> {
  const horizonCutoff = new Date(Date.parse(nowIso) - MERGE_LAG_HORIZON_MS).toISOString();
  const disc = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :cut',
    ExpressionAttributeValues: { ':pk': 'MERGE_RECON#pending_probe', ':cut': horizonCutoff },
    ScanIndexForward: true,                                 // oldest first
    Limit: PROBE_MARKER_LIMIT,
  }));
  for (const marker of (disc.Items ?? []) as Array<Record<string, unknown>>) {
    try {
      let residuals = 0;
      const samples: string[] = [];
      for (const prefix of PROBE_PREFIXES) {
        const page = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME(), IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :pfx)',
          ExpressionAttributeValues: { ':pk': `ORG#${String(marker.fromOrgId)}`, ':pfx': prefix },
          ScanIndexForward: true, Limit: PROBE_PAGE_LIMIT,
          // NO ExclusiveStartKey — EVER. First page only: presence, not totals.
        }));
        for (const row of (page.Items ?? []) as Array<Record<string, unknown>>) {
          const pk = String(row.PK ?? '');
          // LINK_AUDIT rows are known-immutable, non-touching, non-blocking — never residuals.
          if (row.entityType === 'LINK_AUDIT' || pk.startsWith('AUDIT#') || pk.startsWith('LINK_AUDIT')) continue;
          residuals += 1;                                   // ANY other row counts — unknowns included
          if (samples.length < PROBE_SAMPLE_CAP) samples.push(pk);
        }
      }
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME(), Key: { PK: marker.PK, SK: marker.SK },
          UpdateExpression: 'SET #st = :review, GSI1PK = :reviewPk, residualsDetected = :d, residualSamples = :s, probedAt = :now, updatedAt = :now, version = version + :one',
          ConditionExpression: '#st = :probe AND version = :v',
          ExpressionAttributeNames: { '#st': 'state' },
          ExpressionAttributeValues: {
            ':review': 'needs_review', ':reviewPk': 'MERGE_RECON#needs_review',
            ':d': residuals > 0, ':s': samples, ':now': nowIso, ':one': 1,
            ':probe': 'pending_probe', ':v': marker.version,
          },
        }));
        counters.probed += 1;
      } catch (err) {
        // CCFE: another actor advanced the marker — silent skip, no retry within the cycle.
        if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
      }
    } catch (err) {
      // Probe read (or non-CCFE write) failure ⇒ transient: marker untouched, retried next cycle.
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.repair.probe_error', fromOrgId: marker.fromOrgId, toOrgId: marker.toOrgId, error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

export async function reconcileRepair(args: { limit?: number }): Promise<Record<string, unknown>> {
  const nowIso = new Date().toISOString();
  const lease = await acquireLease('repair', 'drain', LAMBDA_TIMEOUT_SEC, nowIso);
  if (!lease) return { skippedLeaseHeld: true };

  const counters: Counters = { examined: 0, repaired: 0, inProgress: 0, blocked: 0, retrying: 0, stuck: 0, errors: 0, aged: 0, raced: 0, recovered: 0, probed: 0 };

  try { await agingPass(nowIso, counters); }
  catch (err) { counters.errors += 1; console.error(JSON.stringify({ event: 'crm.repair.aging_error', error: err instanceof Error ? err.message : String(err) })); }

  const limit = args.limit ?? 100;
  const { markers, hasMore } = await queryPendingMarkers(limit) as { markers: DrainMarker[]; hasMore: boolean };

  for (const m of markers) {
    counters.examined += 1;
    const v2 = asV2(m);
    try {
      const r = await replayFor(m);
      if (r.ok) {
        // superseded/locked replay outcomes are OK-path: the unit's truth is committed elsewhere.
        if (v2) { (await deleteRepairMarkerFenced(v2)).lost ? counters.raced += 1 : counters.repaired += 1; }
        else { (await deleteRepairMarkerIfUnchanged(m)).lost ? counters.raced += 1 : counters.repaired += 1; }
      } else if (r.errorType === 'target_unavailable' && v2) {
        // Spec R10 final: NOT ok, NOT transient — blocked/actionable, surfaces in CRM Health,
        // recovered by the recovery pass; never deleted, never burns a retry.
        (await markStuckV2(v2, r.reason ?? 'target_unavailable', 'target_unavailable', nowIso)).lost ? counters.raced += 1 : counters.blocked += 1;
      } else if (r.errorType === 'in_progress' && !r.churning) {
        // Forward progress (retro has more pages) — keep pending, never counts as an attempt.
        await touchInProgress(m, nowIso); counters.inProgress += 1;
      } else if (r.errorType === 'source_conflict') {
        if (v2) { (await markStuckV2(v2, 'source_conflict', 'other', nowIso)).lost ? counters.raced += 1 : counters.blocked += 1; }
        else { (await markStuck(m, 'source_conflict', 'source_conflict', nowIso)).lost ? counters.raced += 1 : counters.blocked += 1; }
      } else { // transient, OR a churning retro (in_progress re-failing the SAME sessions with no
               // progress): age it through the attempt budget so a persistently-poison marker reaches
               // `stuck` (surfaces in Health) instead of touchInProgress-ing forever.
        const err = r.error ?? (r.errorType === 'in_progress' ? 'retro_churning' : 'transient');
        if ((m.attemptCount ?? 0) + 1 >= MAX_ATTEMPTS) {
          if (v2) { (await markStuckV2(v2, 'max_attempts', 'other', nowIso)).lost ? counters.raced += 1 : counters.stuck += 1; }
          else { (await markStuck(m, 'max_attempts', err, nowIso)).lost ? counters.raced += 1 : counters.stuck += 1; }
        } else {
          if (v2) { (await bumpAttemptFenced(v2, err, nowIso)).lost ? counters.raced += 1 : counters.retrying += 1; }
          else { await bumpAttempt(m, err, nowIso); counters.retrying += 1; }
        }
      }
    } catch (err) {
      // A bookkeeping write failed (replayFor never throws). Isolate: count it, leave the marker
      // pending, keep draining the rest. The lease still releases at the end; next fire retries it.
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.repair.marker_error', unitType: m.unitType, unitKey: m.unitKey, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  try { await recoveryPass(lease, nowIso, counters); }
  catch (err) { counters.errors += 1; console.error(JSON.stringify({ event: 'crm.repair.recovery_pass_error', error: err instanceof Error ? err.message : String(err) })); }

  try { await mergeResidualProbe(nowIso, counters); }
  catch (err) { counters.errors += 1; console.error(JSON.stringify({ event: 'crm.repair.probe_pass_error', error: err instanceof Error ? err.message : String(err) })); }

  const summary = { ...counters, hasMore };
  await releaseLeaseKeepCursor('repair', 'drain', lease, { lastSummary: summary, hasMore });
  console.log(JSON.stringify({ event: 'crm.repair.summary', ...summary }));
  return summary;
}
