import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { readVisitorBridge, upsertManualVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';
import { ensureRepairMarker, deleteRepairMarkerIfUnchanged } from '../repair/repairMarker';
import { replayAnalyticsSideEffects } from '../repair/replaySideEffects';

export async function linkVisitor(args: { visitorId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const send = toSend(docClient);
  const bridge = await readVisitorBridge(send, TABLE_NAME(), args.visitorId);

  if (bridge?.orgSource === 'manual') {
    // already committed-manual: heal sessions a prior attempt's retro missed (idempotent). NO marker.
    let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
    try { await reResolveVisitorSessions({ visitorId: args.visitorId }); }
    catch (err) {
      postCommitStatus = 'post_commit_failed';
      console.error(JSON.stringify({ event: 'crm.link.post_commit_error', visitorId: args.visitorId, phase: 'repair_retro', error: err instanceof Error ? err.message : String(err) }));
    }
    return { alreadyLinked: true, existingOrgId: bridge.matchedOrgId, postCommitStatus };
  }
  if (bridge?.matchedOrgId) return { alreadyResolved: true, existingOrgId: bridge.matchedOrgId };

  const nowIso = new Date().toISOString();
  const up = await upsertManualVisitorBridge(send, TABLE_NAME(), { visitorId: args.visitorId, matchedOrgId: args.targetOrgId, now: nowIso });
  if (!up.written) return { alreadyResolved: true, existingOrgId: up.existingOrgId };

  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
  // Versioned publish (NEVER the version-less putRepairMarker: a drainer that
  // read a version-less marker could complete-delete a version-less overwrite
  // — ABA — killing this fresh work). We hold the written version for our own
  // fenced completion delete below.
  let publishedVersion: number | undefined;
  try {
    const pub = await ensureRepairMarker({ unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso });
    publishedVersion = pub.workVersion;
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.marker_put_error', visitorId: args.visitorId, error: err instanceof Error ? err.message : String(err) }));
  }

  // NOT markerOwned: our marker Put above is best-effort (failure only
  // logged) — if it failed and the retro truncates, the retro itself must
  // publish via ensureRepairMarker or RETRO#STATE would be stranded with no
  // pending marker for the drainer to find.
  const replay = await replayAnalyticsSideEffects({ visitorId: args.visitorId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso });
  if (replay.ok) {
    // Version-fenced completion delete with the version WE published. A
    // concurrent publish bumps it (different version) → our delete is fenced
    // out and the marker stays pending for the drainer — success for us, not
    // a failure. If our publish failed (publishedVersion undefined), the
    // absence-fence either no-ops on a missing marker or is fenced out by
    // any versioned marker another publisher created — never kills it.
    try {
      await deleteRepairMarkerIfUnchanged({ unitType: 'analytics', unitKey: args.visitorId, workVersion: publishedVersion });
    }
    catch { postCommitStatus = 'post_commit_failed'; }
  } else if (replay.errorType !== 'in_progress') {
    // in_progress = retro has more pages; the marker survives and the drainer completes it — not a failure.
    postCommitStatus = 'post_commit_failed';
  }

  return { sessionsResolved: replay.sessionsResolved ?? 0, pending: replay.pending ?? false, existingOrgId: args.targetOrgId, postCommitStatus };
}
