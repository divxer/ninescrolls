import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { readVisitorBridge, upsertManualVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';
import { writeLinkAuditLog } from '../auditStore';

export async function linkVisitor(args: { visitorId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const send = toSend(docClient);
  const bridge = await readVisitorBridge(send, TABLE_NAME(), args.visitorId);
  if (bridge?.orgSource === 'manual') return { alreadyLinked: true, existingOrgId: bridge.matchedOrgId };
  if (bridge?.matchedOrgId) return { alreadyResolved: true, existingOrgId: bridge.matchedOrgId };

  const nowIso = new Date().toISOString();
  const up = await upsertManualVisitorBridge(send, TABLE_NAME(), { visitorId: args.visitorId, matchedOrgId: args.targetOrgId, now: nowIso });
  if (!up.written) return { alreadyResolved: true, existingOrgId: up.existingOrgId };

  const retro = await reResolveVisitorSessions({ visitorId: args.visitorId });
  const summary = (retro?.summary ?? {}) as Record<string, unknown>;
  const sessionsResolved = Number(summary.resolved ?? summary.emitted ?? 0);
  const pending = summary.hasMore === true;
  await writeLinkAuditLog({
    operator: args.operator, reason: 'manual_link_visitor', timestamp: nowIso, newOrgId: args.targetOrgId,
    details: { unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, retroSummary: summary },
  });
  return { visitorId: args.visitorId, sessionsResolved, pending, existingOrgId: args.targetOrgId };
}
