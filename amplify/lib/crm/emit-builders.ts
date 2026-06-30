import type { EmitArgs } from './types';

const orgEmail = (matchedOrgId: string | null, email?: string | null) => ({
  matchedOrgId: matchedOrgId ?? undefined,
  email: email ?? undefined,
});

export function buildRfqEmitArgs(
  rfq: { rfqId: string; submittedAt: string; email?: string | null; equipmentCategory?: string | null; specificModel?: string | null },
  matchedOrgId: string | null,
): EmitArgs {
  const label = rfq.specificModel || rfq.equipmentCategory || 'equipment';
  return {
    source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: rfq.rfqId,
    occurredAt: rfq.submittedAt, summary: `Submitted RFQ — ${label}`,
    idInput: { kind: 'rfq_submitted', rfqId: rfq.rfqId },
    resolveInput: { sourceEntityType: 'rfq', sourceEntityId: rfq.rfqId, channel: 'rfq', ...orgEmail(matchedOrgId, rfq.email) },
    payload: { equipmentCategory: rfq.equipmentCategory ?? null, specificModel: rfq.specificModel ?? null },
  };
}

export function buildLeadEmitArgs(
  lead: { leadId: string; submittedAt: string; type: string; email?: string | null; productName?: string | null; inquiryType?: string | null },
  matchedOrgId: string | null,
): EmitArgs {
  let summary: string;
  if (lead.type === 'download_gate') summary = `Downloaded ${lead.productName ?? 'a resource'}`;
  else if (lead.type === 'newsletter') summary = 'Newsletter signup';
  else summary = `Contact form${lead.inquiryType ? `: ${lead.inquiryType}` : ''}`;
  return {
    source: 'lead', kind: 'lead_captured', sourceEntityType: 'lead', sourceEntityId: lead.leadId,
    occurredAt: lead.submittedAt, summary,
    idInput: { kind: 'lead_captured', leadId: lead.leadId },
    resolveInput: { sourceEntityType: 'lead', sourceEntityId: lead.leadId, channel: 'lead', ...orgEmail(matchedOrgId, lead.email) },
    payload: { type: lead.type, productName: lead.productName ?? null },
  };
}

export function buildOrderCreatedEmitArgs(
  order: { orderId: string; createdAt: string; productModel?: string | null },
  opts: { matchedOrgId: string | null; email?: string | null; rfqId?: string | null },
): EmitArgs {
  const label = order.productModel || 'equipment';
  return {
    source: 'order', kind: 'order_created', sourceEntityType: 'order', sourceEntityId: order.orderId,
    occurredAt: order.createdAt, summary: opts.rfqId ? `Order created from RFQ — ${label}` : `Order created — ${label}`,
    idInput: { kind: 'order_created', orderId: order.orderId },
    resolveInput: { sourceEntityType: 'order', sourceEntityId: order.orderId, channel: 'order', ...orgEmail(opts.matchedOrgId, opts.email) },
    payload: { rfqId: opts.rfqId ?? null, productModel: order.productModel ?? null },
  };
}

export function buildOrderStageChangedEmitArgs(
  order: { orderId: string; matchedOrgId?: string | null },
  log: { id: string; toStatus: string; fromStatus?: string | null; timestamp: string },
  email?: string | null,
): EmitArgs {
  return {
    source: 'order', kind: 'order_stage_changed', sourceEntityType: 'order', sourceEntityId: order.orderId,
    occurredAt: log.timestamp, summary: `Order → ${log.toStatus}`,
    idInput: { kind: 'order_stage_changed', orderId: order.orderId, orderLogId: log.id, toStatus: log.toStatus, occurredAt: log.timestamp },
    resolveInput: { sourceEntityType: 'order', sourceEntityId: order.orderId, channel: 'order', ...orgEmail(order.matchedOrgId ?? null, email) },
    payload: { fromStatus: log.fromStatus ?? null, toStatus: log.toStatus },
  };
}

export function buildQuoteSentEmitArgs(
  order: { orderId: string; matchedOrgId?: string | null },
  doc: { id: string; fileName: string; uploadedAt: string },
  email?: string | null,
): EmitArgs {
  return {
    source: 'quote', kind: 'quote_sent', sourceEntityType: 'quote', sourceEntityId: doc.id,
    occurredAt: doc.uploadedAt, summary: `Quote sent — ${doc.fileName}`,
    idInput: { kind: 'quote_sent', quoteDocId: doc.id },
    resolveInput: { sourceEntityType: 'quote', sourceEntityId: doc.id, channel: 'quote', ...orgEmail(order.matchedOrgId ?? null, email) },
    payload: { orderId: order.orderId, fileName: doc.fileName },
  };
}

export function buildLogisticsMilestoneEmitArgs(
  c: { caseId: string; caseType?: string | null },
  entry: { id: string; toStage: string; fromStage?: string | null; timestamp: string; internalOnly: boolean; action: string },
  matchedOrgId: string | null,
): EmitArgs {
  const summary = entry.action === 'CASE_CREATED'
    ? `Logistics case created — ${c.caseType ?? 'case'}`
    : `Logistics: ${entry.toStage}`;
  return {
    source: 'logistics', kind: 'logistics_milestone', sourceEntityType: 'logistics', sourceEntityId: c.caseId,
    occurredAt: entry.timestamp, summary, isInternalOnly: entry.internalOnly,
    idInput: { kind: 'logistics_milestone', caseId: c.caseId, milestoneId: entry.id, stage: entry.toStage, occurredAt: entry.timestamp },
    resolveInput: { sourceEntityType: 'logistics', sourceEntityId: c.caseId, channel: 'logistics', matchedOrgId: matchedOrgId ?? undefined },
    payload: { fromStage: entry.fromStage ?? null, toStage: entry.toStage },
  };
}
