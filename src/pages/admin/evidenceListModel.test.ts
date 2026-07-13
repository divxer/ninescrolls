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

import { normalizeDoi } from './evidenceListModel';
describe('normalizeDoi', () => {
  const valid: [unknown, string, string][] = [
    ['10.1186/s43074-022-00047-3', '10.1186/s43074-022-00047-3', 'https://doi.org/10.1186/s43074-022-00047-3'],
    // trim + doi: prefix
    ['  doi:10.3390/nano10071313 ', '10.3390/nano10071313', 'https://doi.org/10.3390/nano10071313'],
    // resolver-URL forms
    ['https://doi.org/10.3390/nano10071313', '10.3390/nano10071313', 'https://doi.org/10.3390/nano10071313'],
    ['https://dx.doi.org/10.3390/nano10071313', '10.3390/nano10071313', 'https://doi.org/10.3390/nano10071313'],
    // full URL: a REAL ?query / #fragment is dropped (not treated as DOI content)
    ['https://doi.org/10.1234/foo?utm=x#frag', '10.1234/foo', 'https://doi.org/10.1234/foo'],
    // reserved chars in a bare DOI → encoded in the url, literal in the doi
    ['10.1000/abc?x#y', '10.1000/abc?x#y', 'https://doi.org/10.1000/abc%3Fx%23y'],
    // already-encoded input → decoded once then re-encoded (NO double-encoding)
    ['10.1000/abc%3Fx%23y', '10.1000/abc?x#y', 'https://doi.org/10.1000/abc%3Fx%23y'],
    // Unicode is allowed, encoded in the url
    ['10.1234/fôo', '10.1234/fôo', 'https://doi.org/10.1234/f%C3%B4o'],
    // legit punctuation preserved
    ['10.1234/foo.bar-baz_qux', '10.1234/foo.bar-baz_qux', 'https://doi.org/10.1234/foo.bar-baz_qux'],
    // registrant length boundaries (4 and 9 digits)
    ['10.1000/x', '10.1000/x', 'https://doi.org/10.1000/x'],
    ['10.123456789/x', '10.123456789/x', 'https://doi.org/10.123456789/x'],
    // multi-segment suffix keeps slashes as separators
    ['10.1000/a/b?c', '10.1000/a/b?c', 'https://doi.org/10.1000/a/b%3Fc'],
  ];
  it.each(valid)('accepts %s', (input, doi, url) => {
    expect(normalizeDoi(input)).toEqual({ doi, url });
  });

  const invalid: [unknown][] = [
    [''], ['   '], ['not a doi'],
    ['10.abc/xyz'],           // non-numeric registrant
    ['10.123/foo'],           // 3-digit registrant (< 4)
    ['10.1234567890/foo'],    // 10-digit registrant (> 9)
    ['10.1234.56/foo'],       // dotted sub-registrant
    ['10.1234'],              // no suffix
    ['10.1234/'],             // empty suffix
    ['10.1234/foo bar'],      // whitespace in suffix
    ['10.1234/foo\tbar'],     // tab
    ['10.1234/foo\u0001bar'], // ASCII control char
    ['10.1234/foo\u007Fbar'], // DEL
    ['https://example.com/10.1234/foo'], // wrong host
    [null], [undefined], [42],
  ];
  it.each(invalid)('rejects %s', (input) => {
    expect(normalizeDoi(input)).toBeNull();
  });
});
describe('deriveVerification DOI validation', () => {
  it('marks "DOI recorded" not-ok for a malformed doi', () => {
    const items = deriveVerification(pub({ meta: JSON.stringify({ doi: 'not-a-doi', relationshipDisclosure: 'd', verifiedAt: '2026-07-13' }) }));
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i]));
    expect(byLabel['DOI recorded'].ok).toBe(false);
    expect(byLabel['DOI recorded'].value).toBe('—');
  });
});
