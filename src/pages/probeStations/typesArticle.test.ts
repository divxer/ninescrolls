import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import matrix from '../../data/probeStations/typeMatrixContent.json';

// ---------------------------------------------------------------------------
// Single-source guard families. Consumed by: (a) matrix-cell assertions,
// (b) article-content assertions, (c) the mutation meta-test. Mirrors the
// GUARD_FAMILIES pattern in cryoBuyersGuideArticle.test.ts.
// ---------------------------------------------------------------------------
// Unit alternation is split by casing ambiguity (case-scoping, 2026-07-19):
// multi-character units are unambiguous as letter SEQUENCES, so they match
// case-insensitively -- "5 ghz" / "5 mhz" / "5 db" can't dodge the guard by
// casing. (Under the `i` flag `Pa` also covers pA, and the ampere multiples
// nA/µA/uA/mA are listed explicitly.) Single-LETTER units (K, A, V, W, Ω,
// plus °C) stay case-SENSITIVE: matching them insensitively turned ordinary
// prose like "Figure 4a" / "step 3a" into false positives. The lowercase
// escapees this reintroduces are either not real unit notations ("3 a",
// "2 v", "9 w") or already covered elsewhere ("4 k" is caught by the
// kelvin-discipline regex in the article-body test, which stays
// case-insensitive).
const UNIT_MULTI = String.raw`(?:GHz|MHz|kHz|Hz|dBm|dB|mbar|torr|Pa|nA|µA|uA|mA|mV|kV|mW|kW|ohm|nm|µm|um|mm|cm)`;
const UNIT_SINGLE = String.raw`(?:K|A|V|W|Ω|°C)`;
// Terminator: NOT `\b` -- `\b` never fires directly after a non-word
// character like Ω (Ohm), so "5 Ω" / "5Ω" silently escaped the old regex. A
// lookahead that forbids the next char being a letter/digit (Unicode-aware,
// hence the `u` flag) closes that gap without needing a word character to
// anchor on.
const UNIT_TERMINATOR = String.raw`(?![\p{L}\p{N}])`;
const GUARD_FAMILIES = {
  // Any digit attached to a physical unit -- the article teaches WHAT to
  // review, never HOW MUCH. (\d then optional space/decimal then unit, not
  // immediately followed by another letter/digit.) Two entries: the
  // case-insensitive multi-character set and the case-sensitive
  // single-letter set -- see the case-scoping note above.
  noUnitNumbers: [
    new RegExp(String.raw`\d+(?:\.\d+)?\s?${UNIT_MULTI}${UNIT_TERMINATOR}`, 'iu'),
    new RegExp(String.raw`\d+(?:\.\d+)?\s?${UNIT_SINGLE}${UNIT_TERMINATOR}`, 'u'),
  ],
  // Currency symbols, codes, price words with digits, and relative-cost runs.
  noCurrency: [
    /[$€£¥]/,
    /\bUSD|CNY|EUR|RMB\b/,
    /\$+\s*[\u2013-]\s*\$+/,
    /\bprice[sd]?\s+(?:from|at|around)\s+\d/i,
  ],
  // Competitor / third-party probe-station brand names -- banned
  // EVERYWHERE: both matrix cells and the article body outside references.
  // A competitor mention doesn't belong in either place.
  noCompetitorBrands: [/formfactor|lake\s*shore|micromanipulator|mpi\b|accretech/i],
  // NineScrolls' OWN brand names (SEMISHARE, NineScrolls) -- banned in
  // matrix cells ONLY (the comparison table stays vendor-neutral).
  // Deliberately NOT applied to the body: the interlink href
  // `/wafer-probe-stations/semishare`, the related-products JSON, and the
  // "Where NineScrolls Fits" section all legitimately mention both names
  // outside the matrix.
  noOwnBrandInMatrix: [/semishare/i, /ninescrolls/i],
} as const;
// NOTE for Task 5 (mutation meta-test, not yet written): brand-mutation rows
// must reference `noCompetitorBrands` / `noOwnBrandInMatrix` by their new
// names, not the retired single `noBrandInMatrix` key.

const allCells: string[] = (matrix.cells as string[][]).flat();

describe('type matrix single source', () => {
  it('has 6 types × 4 dimensions with a full cell grid', () => {
    expect(matrix.types).toHaveLength(6);
    expect(matrix.dimensions).toHaveLength(4);
    expect(matrix.cells).toHaveLength(4);
    for (const row of matrix.cells) expect(row).toHaveLength(6);
  });

  it('cells contain no unit-numbers, currency, or brand names', () => {
    for (const cell of allCells) {
      for (const family of Object.values(GUARD_FAMILIES)) {
        for (const pattern of family) {
          expect(cell, `cell "${cell}" vs ${pattern}`).not.toMatch(pattern);
        }
      }
    }
  });

  it('uses typographic punctuation in locked copy', () => {
    expect(matrix.dimensions[3]).toBe('Buyer\u2019s key question');
    expect(allCells.join(' ')).not.toContain("Buyer's"); // no straight-quote drift
  });
});

const ARTICLE_PATH = 'scripts/articles/types-of-wafer-probe-stations.html';
const html = () => readFileSync(ARTICLE_PATH, 'utf8');

// References-exemption scoping: guard families apply OUTSIDE the references
// block only. The article MUST wrap references in these exact markers.
const REF_OPEN = '<!-- guard-exempt:references -->';
const REF_CLOSE = '<!-- /guard-exempt:references -->';
// Single source for locating the references block. Both `outsideReferences`
// (strips it for body-guard checks) and the proximity sentinel (scans inside
// it) MUST go through this helper -- previously they duplicated the same
// indexOf/indexOf pair, and outsideReferences's own copy silently no-op'd
// when the markers were missing or reordered (doc.slice(-1, -1) === '', so
// every guard check against an empty string vacuously passed). Routing both
// call sites through one helper with hard assertions means a missing/
// reordered marker now fails LOUDLY instead of silently disabling every
// downstream guard.
const referencesSpan = (doc: string) => {
  const start = doc.indexOf(REF_OPEN);
  const end = doc.indexOf(REF_CLOSE);
  expect(start, 'references exemption markers present').toBeGreaterThan(-1);
  expect(end, 'references markers ordered').toBeGreaterThan(start);
  return { start, end };
};
const outsideReferences = (doc: string) => {
  const { start, end } = referencesSpan(doc);
  return doc.slice(0, start) + doc.slice(end + REF_CLOSE.length);
};

describe('types article - structure and metadata', () => {
  it('declares the locked slug, title, and TechArticle schema', () => {
    const doc = html();
    expect(doc).toMatch(/<meta name="article:slug" content="types-of-wafer-probe-stations">/);
    const title = doc.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    expect(title).toContain('Types of Wafer Probe Stations');
    // Convention (matches article #3): the authored <title> carries NO brand
    // suffix -- the production prerender appends " | NineScrolls" at render
    // time, so a hand-written suffix would duplicate it. The ≤70 bound is
    // deliberate slack for the tag; the locked headline below is the tight
    // ≤60 SEO bound.
    expect(title.length).toBeLessThanOrEqual(70);
    // Meta keys must be the ones parseArticleHtml.ts actually reads
    // (readMeta 'article-type' / 'image-url', i.e. article:article-type and
    // article:image-url -- same keys as article #3). The plan's original
    // scaffold said article:type / article:image, which the parser silently
    // ignores: the TechArticle schema and cover would be dropped at
    // create-insight time.
    expect(doc).toMatch(/article:article-type" content="TechArticle"/);
    expect(doc).toMatch(/article:image-url" content="\/assets\/images\/insights\/probe-station-types-cover\.png"/);

    // The DB-facing title comes from <h1> (parseArticleHtml falls back to
    // <title> only when no <h1> exists) -- so the locked headline copy is
    // what actually needs pinning down here, not the <title> tag. The
    // original locked string ("...A Measurement-Environment Guide") was 62
    // characters, which silently contradicted the plan's own "58 chars,
    // assert <=60" claim -- an exact-equality check alone can never fail
    // that kind of contradiction, since it just pins whatever string is
    // given. Resolution (2026-07-19): drop the article "A"; the string
    // below is audited at exactly 60 characters, so both the equality
    // check AND the length bound below are simultaneously satisfiable.
    const h1 = doc.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] ?? '';
    expect(h1, 'h1 headline (source of the DB title via parseArticleHtml)').toBe(
      'Types of Wafer Probe Stations: Measurement-Environment Guide',
    );
    expect(h1.length, 'h1 headline length (SEO title constraint)').toBeLessThanOrEqual(60);
  });

  it('contains the six type-profile sections in locked order', () => {
    const doc = html();
    const positions = matrix.types.map((t) => doc.indexOf(`<h3>${t}</h3>`));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `profile heading "${matrix.types[i]}"`).toBeGreaterThan(-1);
      if (i > 0) expect(pos).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('renders every matrix cell verbatim in the HTML table (single source)', () => {
    const doc = html();
    for (const cell of allCells) expect(doc).toContain(cell);
    for (const dim of matrix.dimensions) expect(doc).toContain(dim);
    expect(doc).toMatch(/<div class="table-scroll"|overflow-x:\s*auto/); // responsive defense
  });

  it('keeps unit-numbers, currency, price symbols, and competitor brands out of the body', () => {
    const body = outsideReferences(html());
    for (const family of [GUARD_FAMILIES.noUnitNumbers, GUARD_FAMILIES.noCurrency, GUARD_FAMILIES.noCompetitorBrands]) {
      for (const pattern of family) expect(body).not.toMatch(pattern);
    }
  });

  it('sentinel: no brand within 3 sentences of any exempted number', () => {
    const doc = html();
    const { start, end } = referencesSpan(doc);
    const refs = doc.slice(start, end);
    // Split the references block into sentence-ish units; any window of 7
    // consecutive units (≈3 sentences each side) containing a digit must not
    // also contain a brand.
    const units = refs.split(/(?<=[.!?])\s+|<\/li>/);
    for (let i = 0; i < units.length; i++) {
      if (!/\d/.test(units[i])) continue;
      const window = units.slice(Math.max(0, i - 3), i + 4).join(' ');
      expect(window, `brand near exempted number: "${units[i].slice(0, 60)}"`).not.toMatch(/ninescrolls|semishare/i);
    }
  });

  it('carries the required interlinks (spec \u00a7Interlink map)', () => {
    const doc = html();
    for (const href of [
      '/insights/how-to-choose-wafer-probe-station-university-lab',
      '/insights/cryogenic-probe-station-buyers-guide',
      '/insights/probe-station-procurement-nsf-doe-funded-projects',
      '/applications/cryogenic-probing',
      '/applications/silicon-photonics-probing',
      '/wafer-probe-stations/semishare',
    ]) {
      expect(doc, `interlink ${href}`).toContain(`href="${href}"`);
    }
  });

  it('keeps the figure figcaption disclaimer adjacent to the matrix figure', () => {
    const doc = html();
    // Scoped to the figure's own <picture> block (identified by the
    // type-matrix-lg fallback source) rather than matching a figcaption
    // ANYWHERE in the document -- mirrors cryoBuyersGuideArticle.test.ts's
    // adjacency pattern. [\s\S]{0,200}? (not [^<]*) tolerates nested tags
    // (e.g. a <strong>) inside the caption without breaking the match.
    const pictureBlocks = doc.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
    const matrixBlock = pictureBlocks.find((b) => b.includes('type-matrix-lg'));
    expect(matrixBlock, 'matrix <picture> block (identified by type-matrix-lg)').toBeTruthy();
    const blockEnd = doc.indexOf(matrixBlock!) + matrixBlock!.length;
    const afterBlock = doc.slice(blockEnd, blockEnd + 800);
    expect(afterBlock, 'figcaption with illustrative-comparison disclaimer adjacent to the matrix figure').toMatch(
      /<figcaption[^>]*>[\s\S]{0,200}?illustrative comparison/i,
    );
  });

  it('inherits kelvin discipline: no kelvin numbers anywhere in this survey article', () => {
    // #4 stays survey-level; temperature quantification lives in #3.
    const body = outsideReferences(html());
    expect(body).not.toMatch(/\d+(?:\.\d+)?\s?(?:k\b|kelvin\b)/i);
    expect(body).not.toMatch(/\bguaranteed\b/i);
    expect(body).not.toMatch(/installation\s+included/i);
  });
});

describe('guard families - mutation meta-test', () => {
  const MUTATIONS: Array<{ text: string; family: keyof typeof GUARD_FAMILIES }> = [
    { text: 'resolves features down to 5 nm', family: 'noUnitNumbers' },
    { text: 'operates at 4 K in this configuration', family: 'noUnitNumbers' },
    { text: 'sweeps up to 67 GHz', family: 'noUnitNumbers' },
    { text: 'chamber reaches 1e-6 torr', family: 'noUnitNumbers' },
    { text: 'withstands 3 kV chuck bias', family: 'noUnitNumbers' },
    { text: 'systems start around $45,000', family: 'noCurrency' },
    { text: 'budget tier: $$ – $$$$', family: 'noCurrency' },
    { text: 'priced from 30000 USD', family: 'noCurrency' },
    { text: 'a SEMISHARE cryogenic platform', family: 'noOwnBrandInMatrix' },
    { text: 'comparable to FormFactor systems', family: 'noCompetitorBrands' },
    // Hardening-work coverage (2026-07-19): each row below exercises a fix
    // made after the plan was written -- case-folded multi-char units, the
    // Ω lookahead terminator, a bare-number price phrasing, and a second
    // competitor-brand alias.
    { text: 'sweeps up to 67 ghz', family: 'noUnitNumbers' }, // case-fold multi-char
    { text: 'a 50 Ω environment', family: 'noUnitNumbers' }, // Ω lookahead terminator
    { text: 'stages priced from 30000 USD', family: 'noCurrency' },
    { text: 'a Lake Shore alternative', family: 'noCompetitorBrands' },
  ];
  const NEGATIVE_CONTROLS = [
    'multi-stage vibration isolation between cryocooler and stage',
    'review leakage-current dynamics across the thermal gradient',
    'dielectric breakdown thresholds of thermal isolation stacks',
    'transient current capacity of vacuum feedthroughs',
    'five decisions determine the platform', // bare digit-free wording
    'Section 3 of the datasheet', // digits without units are allowed
    // Added 2026-07-19: figure/step lettering and inline-citation forms now
    // used in the article body -- these exercise the case-sensitive
    // single-letter unit split (lowercase "a" must never read as amperes).
    'Figure 4a shows the layout',
    'step 3a of the checklist',
    'the answer in [3] applies here',
  ];

  it('every mutation is caught by its family', () => {
    for (const m of MUTATIONS) {
      const caught = GUARD_FAMILIES[m.family].some((p) => p.test(m.text));
      expect(caught, `"${m.text}" should trip ${m.family}`).toBe(true);
    }
  });

  it('negative controls pass every family', () => {
    for (const control of NEGATIVE_CONTROLS) {
      for (const [name, family] of Object.entries(GUARD_FAMILIES)) {
        for (const p of family) {
          expect(p.test(control), `"${control}" wrongly tripped ${name}`).toBe(false);
        }
      }
    }
  });
});

describe('type-matrix figure assets', () => {
  const base = 'public/assets/images/insights/probe-station-type-matrix';
  it('source is 1600×900 sRGB with all eight variants present and sRGB', async () => {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(`${base}.png`).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 900]);
    expect(meta.space).toBe('srgb');
    for (const size of ['sm', 'md', 'lg', 'xl']) {
      for (const ext of ['png', 'webp']) {
        const m = await sharp(`${base}-${size}.${ext}`).metadata();
        expect(m.space, `${size}.${ext}`).toBe('srgb');
      }
    }
  });
});
