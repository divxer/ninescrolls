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
    const doi = normalizeDoi(meta.doi); // shared validation — checklist + link agree
    const verifiedAt = typeof meta.verifiedAt === 'string' ? meta.verifiedAt : '';
    const disclosure = typeof meta.relationshipDisclosure === 'string' ? meta.relationshipDisclosure : '';
    items.push(
      { label: 'DOI recorded', ok: !!doi, value: doi?.doi ?? '—' },
      { label: 'Verified', ok: !!verifiedAt, value: verifiedAt || '—' },
      { label: 'Attribution disclosure present', ok: !!disclosure, value: disclosure ? 'Present' : '—' }
    );
  }
  return items;
}

export interface NormalizedDoi {
  /** Canonical bare DOI, e.g. "10.1186/s43074-022-00047-3". */
  doi: string;
  /** Safe resolver URL with the suffix's reserved chars percent-encoded. */
  url: string;
}

/**
 * Normalize + validate a DOI. Trims, strips a `doi:` or `https://doi.org/`
 * prefix, validates the `10.<registrant>/<suffix>` structure, and builds a
 * doi.org URL with reserved characters (?, #, spaces, …) percent-encoded per
 * suffix segment (path separators preserved). Returns null for blank, arbitrary
 * text, or malformed input — so the checklist and the link share one verdict.
 */
export function normalizeDoi(raw: unknown): NormalizedDoi | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
  const m = /^(10\.\d{4,9}(?:\.\d+)*)\/(.+)$/.exec(s);
  if (!m) return null;
  const suffix = m[2].trim();
  if (!suffix) return null;
  const doi = `${m[1]}/${suffix}`;
  const url = `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`;
  return { doi, url };
}

/**
 * Returns the URL only if it is a safe http(s) link, else null — blocks
 * javascript:/data:/vbscript: and other executable schemes from becoming
 * clickable hrefs. Relative URLs resolve against the site origin and are safe.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url, 'https://ninescrolls.com');
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
