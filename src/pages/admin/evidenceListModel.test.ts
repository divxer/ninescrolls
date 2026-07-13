import { describe, it, expect } from 'vitest';
import { parseMeta, applyListView, deriveVerification, EvidenceRecord } from './evidenceListModel';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const pub = (over: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: 'e1',
  title: 'Biomimetic sapphire windows',
  type: EVIDENCE_TYPE.PUBLICATION,
  status: EVIDENCE_STATUS.DRAFT,
  products: ['icp-etcher'],
  summary: 'Peer-reviewed research using the ICP platform...',
  sourceUrl: 'https://doi.org/10.1186/s43074-022-00047-3',
  images: null,
  pdfUrl: null,
  articleSlug: null,
  updatedAt: '2026-07-13T00:00:00Z',
  meta: JSON.stringify({ doi: '10.1186/s43074-022-00047-3', journal: 'PhotoniX', year: 2022, verifiedAt: '2026-07-13', relationshipDisclosure: 'NineScrolls is the authorized distributor of this platform (Tailong Electronics)' }),
  ...over,
});

describe('parseMeta', () => {
  it('parses a JSON string, passes an object through, tolerates junk', () => {
    expect(parseMeta('{"doi":"x"}')).toEqual({ doi: 'x' });
    expect(parseMeta({ doi: 'y' })).toEqual({ doi: 'y' });
    expect(parseMeta(null)).toEqual({});
    expect(parseMeta('not json')).toEqual({});
  });
});

describe('applyListView', () => {
  const rows = [
    pub({ id: 'a', title: 'Alpha', type: EVIDENCE_TYPE.PUBLICATION, status: EVIDENCE_STATUS.DRAFT, products: ['icp-etcher'], updatedAt: '2026-07-13T00:00:00Z' }),
    pub({ id: 'b', title: 'Beta', type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.PUBLISHED, products: ['rie-etcher'], updatedAt: '2026-07-10T00:00:00Z' }),
  ];
  it('filters by type and status', () => {
    expect(applyListView(rows, { search: '', typeFilter: EVIDENCE_TYPE.PUBLICATION, statusFilter: 'all', sortKey: 'title', sortDir: 'asc' }).map(r => r.id)).toEqual(['a']);
    expect(applyListView(rows, { search: '', typeFilter: 'all', statusFilter: EVIDENCE_STATUS.PUBLISHED, sortKey: 'title', sortDir: 'asc' }).map(r => r.id)).toEqual(['b']);
  });
  it('searches across title, type label, and product slugs (case-insensitive)', () => {
    expect(applyListView(rows, { search: 'beta', typeFilter: 'all', statusFilter: 'all', sortKey: 'title', sortDir: 'asc' }).map(r => r.id)).toEqual(['b']);
    expect(applyListView(rows, { search: 'rie-etcher', typeFilter: 'all', statusFilter: 'all', sortKey: 'title', sortDir: 'asc' }).map(r => r.id)).toEqual(['b']);
    expect(applyListView(rows, { search: 'published research', typeFilter: 'all', statusFilter: 'all', sortKey: 'title', sortDir: 'asc' }).map(r => r.id)).toEqual(['a']);
  });
  it('sorts by updatedAt desc (newest first)', () => {
    expect(applyListView(rows, { search: '', typeFilter: 'all', statusFilter: 'all', sortKey: 'updatedAt', sortDir: 'desc' }).map(r => r.id)).toEqual(['a', 'b']);
  });
  it('sorts by title asc/desc', () => {
    expect(applyListView(rows, { search: '', typeFilter: 'all', statusFilter: 'all', sortKey: 'title', sortDir: 'desc' }).map(r => r.id)).toEqual(['b', 'a']);
  });
});

describe('deriveVerification', () => {
  it('for a publication returns all five checks reflecting real fields', () => {
    const items = deriveVerification(pub());
    const byLabel = Object.fromEntries(items.map(i => [i.label, i]));
    expect(byLabel['Product selected'].ok).toBe(true);
    expect(byLabel['Payload present'].ok).toBe(true);
    expect(byLabel['Payload present'].value).toBe('Source URL');
    expect(byLabel['DOI recorded'].ok).toBe(true);
    expect(byLabel['DOI recorded'].value).toBe('10.1186/s43074-022-00047-3');
    expect(byLabel['Verified'].ok).toBe(true);
    expect(byLabel['Attribution disclosure present'].ok).toBe(true);
  });
  it('flags missing publication fields as not-ok', () => {
    const items = deriveVerification(pub({ meta: JSON.stringify({}) , sourceUrl: null }));
    const byLabel = Object.fromEntries(items.map(i => [i.label, i]));
    expect(byLabel['Payload present'].ok).toBe(false);
    expect(byLabel['DOI recorded'].ok).toBe(false);
    expect(byLabel['Attribution disclosure present'].ok).toBe(false);
  });
  it('for a non-publication returns only Product + Payload (no DOI/attribution rows)', () => {
    const items = deriveVerification(pub({ type: EVIDENCE_TYPE.APPLICATION_NOTE }));
    expect(items.map(i => i.label)).toEqual(['Product selected', 'Payload present']);
  });
});

import { safeExternalUrl } from './evidenceListModel';
describe('safeExternalUrl', () => {
  it('allows http(s) and relative URLs', () => {
    expect(safeExternalUrl('https://doi.org/10.1/x')).toBe('https://doi.org/10.1/x');
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com');
    expect(safeExternalUrl('/products/icp-etcher')).toBe('/products/icp-etcher');
  });
  it('blocks javascript:, data:, and vbscript: schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
  });
  it('returns null for empty/nullish', () => {
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});
