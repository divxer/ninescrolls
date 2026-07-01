import { timelineId } from '../timelineId';
import type { EmitArgs } from '../../../../lib/crm/types';
import {
  buildRfqEmitArgs, buildLeadEmitArgs, buildOrderCreatedEmitArgs,
  buildOrderStageChangedEmitArgs, buildQuoteSentEmitArgs, buildLogisticsMilestoneEmitArgs,
} from '../../../../lib/crm/emit-builders';

export interface ExpectedEvent { id: string; args: EmitArgs; }
const withId = (args: EmitArgs): ExpectedEvent => ({ id: timelineId(args.idInput), args });

export function rfqEvents(rfq: { rfqId: string; submittedAt: string; email?: string | null; equipmentCategory?: string | null; specificModel?: string | null; matchedOrgId?: string | null }): ExpectedEvent[] {
  return [withId(buildRfqEmitArgs(rfq, rfq.matchedOrgId ?? null))];
}

export function leadEvents(lead: { leadId: string; submittedAt: string; type: string; email?: string | null; productName?: string | null; inquiryType?: string | null; matchedOrgId?: string | null }): ExpectedEvent[] {
  return [withId(buildLeadEmitArgs(lead, lead.matchedOrgId ?? null))];
}

// MIRROR live-emit: order_created carries the primary contact `email` in resolveInput (createOrder passes
// primaryContactEmail; convert-rfq passes the RFQ email). It matters when matchedOrgId is absent — CRM then
// resolves by contact/domain, so omitting it would recover an unmatched order as `unresolved-*`. The order
// channel (existencePass) reconstructs the email from the stored row; pass it through here.
export function orderCreatedEvents(order: { orderId: string; createdAt: string; productModel?: string | null; matchedOrgId?: string | null; rfqId?: string | null; email?: string | null }): ExpectedEvent[] {
  return [withId(buildOrderCreatedEmitArgs(order, { matchedOrgId: order.matchedOrgId ?? null, email: order.email ?? null, rfqId: order.rfqId ?? null }))];
}

// MIRROR live-emit: only STATUS_CHANGE logs become stage events (matches order-api/updateOrderStatus).
export function orderStageEvents(order: { orderId: string; matchedOrgId?: string | null }, logs: Array<{ id?: string; action: string; toStatus?: string; fromStatus?: string | null; timestamp: string }>): ExpectedEvent[] {
  // The !!id && !!toStatus guards are belt-and-suspenders: live-emit always stamps both on a
  // STATUS_CHANGE log, so a real record can't miss them (unlike logistics' legacy entries → no warn needed).
  return logs
    .filter((l) => l.action === 'STATUS_CHANGE' && !!l.id && !!l.toStatus)
    .map((l) => withId(buildOrderStageChangedEmitArgs(order, { id: l.id!, toStatus: l.toStatus!, fromStatus: l.fromStatus ?? null, timestamp: l.timestamp })));
}

// MIRROR live-emit: only QUOTATION docs become quote_sent (matches order-api/confirmDocumentUpload).
// Stored DOC items carry `docId` (not `id`); accept `id` too for forward-compat. The !!docId guard is
// belt-and-suspenders: a QUOTATION doc always has a docId at the live-emit site (no silent-drop warn needed).
export function quoteEvents(order: { orderId: string; matchedOrgId?: string | null }, docs: Array<{ docId?: string; id?: string; docType: string; fileName: string; uploadedAt: string }>): ExpectedEvent[] {
  return docs
    .map((d) => ({ d, docId: d.docId ?? d.id }))
    .filter(({ d, docId }) => d.docType === 'QUOTATION' && !!docId)
    .map(({ d, docId }) => withId(buildQuoteSentEmitArgs(order, { id: docId!, fileName: d.fileName, uploadedAt: d.uploadedAt })));
}

// `toStage`/`timestamp` are OPTIONAL on the source LogisticsLogEntry (legacy entries predate the
// stable-id + structured-stage fields). Skip entries missing id/toStage/timestamp rather than emit a
// malformed event; log a count so silent drops are visible (this is an audit tool).
export function logisticsEvents(c: { caseId: string; caseType?: string | null; milestoneLog?: Array<{ id?: string; action: string; toStage?: string | null; fromStage?: string | null; timestamp?: string; internalOnly?: boolean }> }, matchedOrgId: string | null): ExpectedEvent[] {
  const entries = c.milestoneLog ?? [];
  const usable = entries.filter((m) => !!m.id && !!m.toStage && !!m.timestamp);
  if (usable.length !== entries.length) {
    console.warn(JSON.stringify({ event: 'crm.sweep.logistics.skipped_malformed', caseId: c.caseId, skipped: entries.length - usable.length }));
  }
  return usable.map((m) => withId(buildLogisticsMilestoneEmitArgs(
    { caseId: c.caseId, caseType: c.caseType },
    { id: m.id!, toStage: m.toStage!, fromStage: m.fromStage ?? null, timestamp: m.timestamp!, internalOnly: m.internalOnly ?? false, action: m.action },
    matchedOrgId,
  )));
}
