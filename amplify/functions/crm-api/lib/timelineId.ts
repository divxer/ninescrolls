import crypto from 'node:crypto';

export type TimelineIdInput =
  | { kind: 'order_created'; orderId: string }
  | { kind: 'order_stage_changed'; orderId: string; orderLogId?: string; toStatus?: string; occurredAt?: string }
  | { kind: 'rfq_submitted'; rfqId: string }
  | { kind: 'rfq_status_changed'; rfqId: string; toStatus: string }
  | { kind: 'lead_captured'; leadId: string }
  | { kind: 'logistics_milestone'; caseId: string; milestoneId?: string; stage?: string; occurredAt?: string }
  | { kind: 'quote_sent'; quoteDocId: string }
  | { kind: 'site_visit_session'; sessionId: string }
  | { kind: 'manual'; manualId: string };

function shortHash(...parts: string[]): string {
  return 'h' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
}

export function timelineId(input: TimelineIdInput): string {
  switch (input.kind) {
    case 'order_created': return `tev-order-${input.orderId}-created`;
    case 'order_stage_changed': {
      const key = input.orderLogId ?? shortHash(input.orderId, input.toStatus ?? '', input.occurredAt ?? '');
      return `tev-order-${input.orderId}-stage-${key}`;
    }
    case 'rfq_submitted': return `tev-rfq-${input.rfqId}-submitted`;
    case 'rfq_status_changed': return `tev-rfq-${input.rfqId}-status-${input.toStatus}`;
    case 'lead_captured': return `tev-lead-${input.leadId}`;
    case 'logistics_milestone': {
      const key = input.milestoneId ?? shortHash(input.caseId, input.stage ?? '', input.occurredAt ?? '');
      return `tev-logistics-${input.caseId}-log-${key}`;
    }
    case 'quote_sent': return `tev-quote-${input.quoteDocId}`;
    case 'site_visit_session': return `tev-analytics-session-${input.sessionId}`;
    case 'manual': return `tev-manual-${input.manualId}`;
  }
}
