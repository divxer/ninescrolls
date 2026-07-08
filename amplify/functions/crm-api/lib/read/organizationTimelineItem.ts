export type ResolutionTone = 'confirmed' | 'domain-match' | 'inferred' | 'unknown';
export type TimelineChipGroup = 'rfq' | 'lead' | 'order' | 'quote' | 'logistics' | 'site_visits' | 'other';

export interface OrganizationTimelineItem {
  id: string; occurredAt: string; source: string; kind: string;
  sourceFilterGroup: TimelineChipGroup; icon: string; tone: ResolutionTone;
  primaryLabel: string; resolutionStatus: string; resolutionReason: string; confidence: number | null;
  isInternalOnly: boolean;
  productModel: string | null; specificModel: string | null; equipmentCategory: string | null;
  leadType: string | null; productName: string | null; stageFrom: string | null; stageTo: string | null;
  fileName: string | null; pageCount: number | null; activeSeconds: number | null; topPaths: string[] | null;
  sourceEntityType: string; sourceEntityId: string; payload: Record<string, unknown> | null;
}

export interface StoredTimelineEvent {
  id: string; occurredAt: string; source: string; kind: string; summary: string;
  resolutionStatus: string; resolutionReason: string; confidence: number;
  isInternalOnly: boolean; sourceEntityType: string; sourceEntityId: string;
  payload: Record<string, unknown> | null;
}

const GROUP_BY_SOURCE: Record<string, TimelineChipGroup> = {
  rfq: 'rfq', lead: 'lead', order: 'order', quote: 'quote', logistics: 'logistics', analytics: 'site_visits',
};
const ICON_BY_SOURCE: Record<string, string> = {
  rfq: 'rfq', lead: 'lead', order: 'order', quote: 'quote', logistics: 'logistics', analytics: 'site_visit',
};

function toTone(reason: string, status: string): ResolutionTone {
  if (status === 'manually_linked') return 'confirmed';
  switch (reason) {
    case 'manual':
    case 'existing_matchedOrgId':
    case 'contact_email_exact': return 'confirmed';
    case 'email_domain_exact':
    case 'email_domain_new': return 'domain-match';
    case 'visitor_prior_event':
    case 'organization_name_match': return 'inferred';
    default: return 'unknown';
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const strArr = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;

export function toOrganizationTimelineItem(e: StoredTimelineEvent): OrganizationTimelineItem {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const tone = toTone(e.resolutionReason, e.resolutionStatus);
  return {
    id: e.id, occurredAt: e.occurredAt, source: e.source, kind: e.kind,
    sourceFilterGroup: GROUP_BY_SOURCE[e.source] ?? 'other',
    icon: ICON_BY_SOURCE[e.source] ?? 'event',
    tone,
    primaryLabel: e.summary,
    resolutionStatus: e.resolutionStatus, resolutionReason: e.resolutionReason,
    confidence: tone === 'inferred' || tone === 'unknown' ? e.confidence : null,
    isInternalOnly: e.isInternalOnly,
    productModel: str(p.productModel), specificModel: str(p.specificModel), equipmentCategory: str(p.equipmentCategory),
    leadType: str(p.type), productName: str(p.productName),
    stageFrom: str(p.fromStatus) ?? str(p.fromStage), stageTo: str(p.toStatus) ?? str(p.toStage),
    fileName: str(p.fileName), pageCount: num(p.pageCount), activeSeconds: num(p.activeSeconds), topPaths: strArr(p.topPaths),
    sourceEntityType: e.sourceEntityType, sourceEntityId: e.sourceEntityId,
    payload: e.payload,
  };
}
