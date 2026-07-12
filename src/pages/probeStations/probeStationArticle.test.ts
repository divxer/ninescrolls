import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from '../../../scripts/lib/parseArticleHtml';
import { FORBIDDEN_ATTESTATION_PATTERNS } from '../../data/probeStations/semishare';

const SLUG = 'how-to-choose-wafer-probe-station-university-lab';
const HTML_PATH = `scripts/articles/${SLUG}.html`;

// The article now lives as a standalone HTML file consumed by create-insight.ts;
// parseArticleHtml is the exact parser that script uses, so these assertions
// guard the content as it will actually be written to DynamoDB.
const html = readFileSync(HTML_PATH, 'utf8');
const parsed = parseArticleHtml(html);
const content = parsed.content;

// Replicated verbatim from scripts/create-insight.ts::generateSlug — the test
// deliberately does NOT import create-insight.ts (it pulls in Amplify/AWS,
// which must not load in this pure node test). Keep this in lockstep with the
// script so the slug asserted here matches the slug the script would derive.
function generateSlug(title: string): string {
  const raw = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (raw.length <= 80) return raw;
  return raw.slice(0, 80).replace(/-[^-]*$/, '');
}

describe('probe station buyer-guide standalone article', () => {
  it('parses to full content with no hand-written TOC', () => {
    expect(content.length).toBeGreaterThan(10_000); // full conversion, not a stub
    // The page auto-generates the TOC — the content must not carry one in any
    // of the forms the site (or a naive conversion) could produce:
    expect(content).not.toMatch(/table of contents/i);
    expect(content).not.toMatch(/\bid="toc"|class="[^"]*\btoc\b[^"]*"/i);
    expect(content).not.toMatch(/<nav[^>]*toc/i);
    expect(content).not.toMatch(/<h[23][^>]*>\s*(contents|in this (article|guide))\s*<\/h[23]>/i);
  });

  it('embeds each figure as its own complete <picture> block with CDN URLs, adjacent caption, and on-disk source assets', () => {
    const pictureBlocks = content.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
    const CDN = 'https://cdn.ninescrolls.com/insights';

    for (const base of ['probe-station-temperature-regimes', 'probe-station-automation-levels']) {
      // The block DEDICATED to this figure — not just any <picture> plus a bare URL
      const block = pictureBlocks.find((b) => b.includes(`${CDN}/${base}`));
      expect(block, `<picture> block for ${base}`).toBeTruthy();

      // Responsive webp srcset (absolute CDN) + png fallback (absolute CDN), all inside THIS block
      for (const size of ['sm', 'md', 'lg', 'xl']) {
        expect(block, `${base}-${size}.webp CDN srcset`).toContain(`${CDN}/${base}-${size}.webp`);
        // The local source copies remain on disk — they are the upload source of truth.
        expect(existsSync(`public/assets/images/insights/${base}-${size}.webp`), `${base}-${size}.webp on disk`).toBe(true);
        expect(existsSync(`public/assets/images/insights/${base}-${size}.png`), `${base}-${size}.png on disk`).toBe(true);
      }
      expect(block, `${base}.png CDN fallback <img>`).toMatch(
        new RegExp(`<img[^>]+src="${CDN}/${base}\\.png"`)
      );
      expect(existsSync(`public/assets/images/insights/${base}.png`), `${base}.png on disk`).toBe(true);

      // The IMMEDIATELY ADJACENT caption element (allowing only closing wrapper
      // tags in between) must be a <figcaption> carrying the schematic
      // disclaimer — proximity alone is not enough.
      const afterBlock = content.slice(
        content.indexOf(block!) + block!.length,
        content.indexOf(block!) + block!.length + 500
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i
      );
      expect(captionMatch, `adjacent <figcaption> after ${base}`).toBeTruthy();
      expect(captionMatch![1], `schematic disclaimer in ${base} caption`).toMatch(/Schematic illustration/i);
    }
    expect(existsSync('public/assets/images/insights/probe-station-guide-cover.png')).toBe(true);
  });

  it('links to the capability hub, the brand page, and the RFQ path', () => {
    expect(content).toContain('href="/wafer-probe-stations"');
    expect(content).toContain('href="/wafer-probe-stations/semishare"');
    expect(content).toContain('href="/request-quote"');
    // The RFQ route is /request-quote, never /quote.
    expect(content).not.toContain('href="/quote"');
  });

  it('carries no attestation wording and no SEMISHARE-attributed numbers (Constraint 7 tripwire)', () => {
    for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
    // Heuristic tripwire, not proof: a number within 60 chars after "SEMISHARE"
    // flags a potentially product-attributed spec. On a hit, either source the
    // value from src/data/probeStations/semishare.ts (and render it there, not
    // here) or cut the sentence — do not weaken this regex.
    expect(content).not.toMatch(/SEMISHARE[^<.]{0,60}\d+\s?(K\b|mm|inch|"|µm|um)/i);
  });

  it('exposes the authoring metadata the create-insight flow will write to DynamoDB', () => {
    expect(parsed.excerpt).toBe(
      'The five choices that determine which probe station fits your research — automation level, temperature, signal type, sample size, and positioning — plus real cost ranges and the university procurement angles that trip up first-time buyers.'
    );
    expect(parsed.category).toBe('Metrology & Testing');
    expect(parsed.tags).toEqual([
      'probe station',
      'wafer probing',
      'university lab',
      'equipment procurement',
      'device characterization',
    ]);
    expect(parsed.tags).toHaveLength(5);
    expect(parsed.articleType).toBe('TechArticle');
    expect(parsed.imageUrl).toBe('/assets/images/insights/probe-station-guide-cover.png');
    expect(parsed.publishDate).toBe('2026-07-12');
    expect(parsed.author).toBe('NineScrolls Engineering');

    expect(parsed.relatedProducts).toHaveLength(2);
    expect(parsed.relatedProducts!.map((p) => p.href)).toEqual([
      '/wafer-probe-stations',
      '/wafer-probe-stations/semishare',
    ]);
  });

  it('derives the expected title and a create-insight-compatible slug', () => {
    const expectedTitle = 'How to Choose a Wafer Probe Station for Your University Research Lab';
    expect(parsed.title).toBe(expectedTitle);

    // create-insight.ts resolves the slug as: --slug flag > <meta article:slug>
    // > generateSlug(title). This title alone would derive a DIFFERENT, longer
    // slug, so the standalone file carries an explicit article:slug meta to
    // preserve the canonical /insights/<slug> URL (hard-linked from
    // WaferProbeStationsPage). Assert the resolved slug matches canonical.
    expect(parsed.slug).toBe(SLUG);
    const resolvedSlug = parsed.slug ?? generateSlug(parsed.title);
    expect(resolvedSlug).toBe(SLUG);
    // Guard that the meta override is actually doing work — the title alone
    // would NOT produce the canonical slug.
    expect(generateSlug(parsed.title)).not.toBe(SLUG);
  });
});

describe('probe station buyer-guide evidence chain and table accessibility', () => {
  // The eight federal-award PIIDs cited in the article. Amounts were verified
  // out-of-band against the USAspending API; this test deliberately does NOT
  // fetch live data (CI has no external network). It guards the STRUCTURE of
  // the citation — the exact, unique set of award IDs and their shape.
  const EXPECTED_PIIDS = [
    'N6600122P6113',
    'W911QX10P0505',
    'W31P4Q14P0049',
    'N6600118P8072',
    'HQ072718P0020',
    'HQ072718P0016',
    'HQ072719P0032',
    'FA875122C0022',
  ];

  it('cites exactly the eight verified award PIIDs, each a 13-char alphanumeric ID', () => {
    // The reference list is itself exactly eight and free of duplicates.
    expect(EXPECTED_PIIDS).toHaveLength(8);
    expect(new Set(EXPECTED_PIIDS).size).toBe(8);

    for (const piid of EXPECTED_PIIDS) {
      expect(piid, `${piid} PIID shape`).toMatch(/^[A-Z0-9]{13}$/);
      expect(content, `${piid} present in article`).toContain(piid);
    }

    // Each award row renders its PIID inside a <code> cell. The set of
    // 13-char alphanumeric <code> tokens must be EXACTLY the verified eight —
    // no ninth, unverified award id may slip into the table.
    const codeCited = [...content.matchAll(/<code>([A-Z0-9]{13})<\/code>/g)].map((m) => m[1]);
    expect(new Set(codeCited)).toEqual(new Set(EXPECTED_PIIDS));

    // Every PIID cell links directly to its USAspending award-detail record.
    for (const piid of EXPECTED_PIIDS) {
      expect(content, `${piid} detail link`).toContain(
        `href="https://www.usaspending.gov/award/CONT_AWD_${piid}_9700_-NONE-_-NONE-"`,
      );
    }
  });

  it('avoids high-risk procurement and award over-claims', () => {
    const BANNED: RegExp[] = [
      /generally need(s)? .{0,40}SAM/i,
      /cannot buy with your grant/i,
      /\bguaranteed\b/i,
      /installation.{0,30}(included|free)/i,
      /typically includes? .{0,40}(installation|warranty)/i,
    ];
    for (const pattern of BANNED) {
      expect(content, `banned wording ${pattern}`).not.toMatch(pattern);
    }
  });

  it('gives every content table a caption, column headers, and row headers', () => {
    const tables = content.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    expect(tables.length, 'at least the automation + awards tables').toBeGreaterThanOrEqual(2);

    for (const table of tables) {
      expect(table, 'table <caption>').toMatch(/<caption[\s>]/i);
      expect(table, 'table has a scope="col" header').toMatch(/<th\s+scope="col"/i);

      const tbody = table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0];
      expect(tbody, 'table has a <tbody>').toBeTruthy();

      const rows = tbody!.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
      expect(rows.length, 'tbody has rows').toBeGreaterThan(0);
      for (const row of rows) {
        expect(row, 'body row starts with a scope="row" header').toMatch(
          /^\s*<tr[^>]*>\s*<th\s+scope="row"/i,
        );
      }
    }
  });
});
