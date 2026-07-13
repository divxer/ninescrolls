import { EVIDENCE_TYPE, evidenceTypeLabel, hasPayload } from '../../config/evidence';

export interface EvidenceRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  products?: (string | null)[] | null;
  summary?: string | null;
  sourceUrl?: string | null;
  pdfUrl?: string | null;
  articleSlug?: string | null;
  images?: (string | null)[] | null;
  meta?: unknown;
  updatedAt?: string | null;
}

export function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      const p = JSON.parse(meta);
      return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
}

export type SortKey = 'title' | 'type' | 'status' | 'products' | 'updatedAt';
export type SortDir = 'asc' | 'desc';
export interface ListView {
  search: string;
  typeFilter: string;
  statusFilter: string;
  sortKey: SortKey;
  sortDir: SortDir;
}

const productsText = (r: EvidenceRecord) => (r.products ?? []).filter(Boolean).join(' ');

export function applyListView(rows: EvidenceRecord[], view: ListView): EvidenceRecord[] {
  const q = view.search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (view.typeFilter !== 'all' && r.type !== view.typeFilter) return false;
    if (view.statusFilter !== 'all' && r.status !== view.statusFilter) return false;
    if (!q) return true;
    const hay = `${r.title} ${evidenceTypeLabel(r.type)} ${productsText(r)}`.toLowerCase();
    return hay.includes(q);
  });

  const dir = view.sortDir === 'asc' ? 1 : -1;
  const key = (r: EvidenceRecord): string => {
    switch (view.sortKey) {
      case 'type': return evidenceTypeLabel(r.type);
      case 'status': return r.status;
      case 'products': return productsText(r);
      case 'updatedAt': return r.updatedAt ?? '';
      case 'title':
      default: return r.title;
    }
  };
  return [...filtered].sort((a, b) => key(a).localeCompare(key(b)) * dir);
}

export interface VerificationItem {
  label: string;
  value: string;
  ok: boolean;
}

export function deriveVerification(rec: EvidenceRecord): VerificationItem[] {
  const meta = parseMeta(rec.meta);
  const products = (rec.products ?? []).filter(Boolean) as string[];

  const payloadValue = rec.sourceUrl
    ? 'Source URL'
    : rec.pdfUrl
    ? 'PDF'
    : rec.articleSlug
    ? 'Article'
    : (rec.images ?? []).filter(Boolean).length
    ? 'Images'
    : '—';

  const items: VerificationItem[] = [
    { label: 'Product selected', ok: products.length > 0, value: products.join(', ') || '—' },
    {
      label: 'Payload present',
      ok: hasPayload({
        articleSlug: rec.articleSlug,
        pdfUrl: rec.pdfUrl,
        sourceUrl: rec.sourceUrl,
        images: (rec.images ?? []).filter(Boolean) as string[],
      }),
      value: payloadValue,
    },
  ];

  if (rec.type === EVIDENCE_TYPE.PUBLICATION) {
    const doi = typeof meta.doi === 'string' ? meta.doi : '';
    const verifiedAt = typeof meta.verifiedAt === 'string' ? meta.verifiedAt : '';
    const disclosure = typeof meta.relationshipDisclosure === 'string' ? meta.relationshipDisclosure : '';
    items.push(
      { label: 'DOI recorded', ok: !!doi, value: doi || '—' },
      { label: 'Verified', ok: !!verifiedAt, value: verifiedAt || '—' },
      { label: 'Attribution disclosure present', ok: !!disclosure, value: disclosure ? 'Present' : '—' }
    );
  }
  return items;
}
