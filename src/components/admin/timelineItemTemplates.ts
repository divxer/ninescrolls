import type { OrganizationTimelineItem } from '../../hooks/useOrganizationTimeline';

export const CHIP_LABELS: Record<string, string> = {
  all: 'All', rfq: 'RFQ', lead: 'Lead', order: 'Order', quote: 'Quote', logistics: 'Logistics', site_visits: 'Site visits',
};

export const ICON_GLYPH: Record<string, string> = {
  rfq: '📄', lead: '✉️', order: '📦', quote: '💬', logistics: '🚚', site_visit: '🌐', event: '•',
};

export function toneBadge(tone: string): string {
  switch (tone) {
    case 'confirmed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'domain-match': return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'inferred': return 'bg-amber-50 text-amber-700 border border-amber-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export const TONE_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', 'domain-match': 'Domain match', inferred: 'Inferred', unknown: 'Unknown link',
};

const fmtDuration = (s: number): string => {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

type Item = Pick<OrganizationTimelineItem, 'kind' | 'primaryLabel' | 'stageFrom' | 'stageTo' | 'fileName' | 'pageCount' | 'activeSeconds' | 'productModel' | 'equipmentCategory' | 'leadType' | 'productName'>;

export function composeTimelineText(item: Item): { title: string; snippet: string | null } {
  switch (item.kind) {
    case 'rfq_submitted':
      return { title: 'RFQ submitted', snippet: item.equipmentCategory ?? item.primaryLabel };
    case 'lead_captured':
      return { title: 'Lead captured', snippet: item.productName ?? item.leadType ?? null };
    case 'order_created':
      return { title: 'Order created', snippet: item.productModel ?? null };
    case 'order_stage_changed':
      return { title: `Order stage: ${item.stageFrom ?? '—'} → ${item.stageTo ?? '—'}`, snippet: null };
    case 'quote_sent':
      return { title: 'Quote sent', snippet: item.fileName ?? null };
    case 'logistics_milestone':
      return { title: `Logistics: ${item.stageFrom ?? '—'} → ${item.stageTo ?? '—'}`, snippet: null };
    case 'site_visit_session':
      return {
        title: 'Site visit',
        snippet: [item.pageCount != null ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : null,
                  item.activeSeconds != null ? fmtDuration(item.activeSeconds) : null].filter(Boolean).join(' · ') || null,
      };
    default:
      return { title: item.primaryLabel, snippet: null };
  }
}
