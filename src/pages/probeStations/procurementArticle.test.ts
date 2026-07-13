import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from '../../../scripts/lib/parseArticleHtml';
import { FORBIDDEN_ATTESTATION_PATTERNS } from '../../data/probeStations/semishare';

// Second article in the probe-station SEO cluster: the "how to buy compliantly"
// companion to how-to-choose-wafer-probe-station-university-lab. Like the buyer
// guide it lives as a standalone HTML file consumed by create-insight.ts;
// parseArticleHtml is the exact parser that script uses, so these assertions
// guard the content as it will actually be written to DynamoDB.
const SLUG = 'probe-station-procurement-nsf-doe-funded-projects';
const HTML_PATH = `scripts/articles/${SLUG}.html`;
const BUYER_GUIDE_SLUG = 'how-to-choose-wafer-probe-station-university-lab';

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

describe('probe station procurement standalone article', () => {
  it('parses to full content with no hand-written TOC', () => {
    expect(content.length).toBeGreaterThan(10_000); // full article, not a stub
    // The page auto-generates the TOC — the content must not carry one in any
    // of the forms the site (or a naive conversion) could produce:
    expect(content).not.toMatch(/table of contents/i);
    expect(content).not.toMatch(/\bid="toc"|class="[^"]*\btoc\b[^"]*"/i);
    expect(content).not.toMatch(/<nav[^>]*toc/i);
    expect(content).not.toMatch(/<h[23][^>]*>\s*(contents|in this (article|guide))\s*<\/h[23]>/i);
  });

  it('embeds the timeline figure as its own <picture> block with slug-scoped CDN URLs, adjacent caption, and on-disk source assets', () => {
    const pictureBlocks = content.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
    const CDN = `https://cdn.ninescrolls.com/insights/${SLUG}`;

    // figure name (as it appears in the CDN path) -> local UPLOAD SOURCE basename.
    const FIGURES: Array<{ name: string; localBase: string }> = [
      { name: 'procurement-timeline', localBase: 'probe-station-procurement-timeline' },
    ];

    for (const { name, localBase } of FIGURES) {
      const block = pictureBlocks.find((b) => b.includes(`${CDN}/${name}`));
      expect(block, `<picture> block for ${name}`).toBeTruthy();

      // Responsive webp srcset (absolute slug-scoped CDN), all inside THIS block.
      for (const size of ['sm', 'md', 'lg', 'xl']) {
        expect(block, `${name}-${size}.webp CDN srcset`).toContain(`${CDN}/${name}-${size}.webp`);
        // The local source copies remain on disk — they are the upload source of
        // truth (the Lambda regenerates every variant from the base image).
        expect(existsSync(`public/assets/images/insights/${localBase}-${size}.webp`), `${localBase}-${size}.webp on disk`).toBe(true);
        expect(existsSync(`public/assets/images/insights/${localBase}-${size}.png`), `${localBase}-${size}.png on disk`).toBe(true);
      }
      // The <img> fallback is the -lg variant, NOT a multi-MB base png.
      expect(block, `${name}-lg.png CDN fallback <img>`).toMatch(
        new RegExp(`<img[^>]+src="${CDN}/${name}-lg\\.png"`)
      );
      // The upload SOURCE base png (what upload-insights-image.ts is pointed at).
      expect(existsSync(`public/assets/images/insights/${localBase}.png`), `${localBase}.png on disk`).toBe(true);

      // The IMMEDIATELY ADJACENT caption element (allowing only closing wrapper
      // tags in between) must be a <figcaption>. This figure is a process
      // flowchart, so the caption carries the "illustrative sequence" disclaimer
      // (the "Schematic illustration" phrasing is for scientific schematics).
      const afterBlock = content.slice(
        content.indexOf(block!) + block!.length,
        content.indexOf(block!) + block!.length + 800
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i
      );
      expect(captionMatch, `adjacent <figcaption> after ${name}`).toBeTruthy();
      expect(captionMatch![1], `illustrative-sequence disclaimer in ${name} caption`).toMatch(/illustrative sequence/i);
    }

    // Cover upload source (base + responsive variants) must be on disk too —
    // the create-insight cover step reads them.
    expect(existsSync('public/assets/images/insights/probe-station-procurement-cover.png')).toBe(true);
    for (const size of ['sm', 'md', 'lg', 'xl']) {
      expect(existsSync(`public/assets/images/insights/probe-station-procurement-cover-${size}.webp`), `cover-${size}.webp on disk`).toBe(true);
      expect(existsSync(`public/assets/images/insights/probe-station-procurement-cover-${size}.png`), `cover-${size}.png on disk`).toBe(true);
    }
  });

  it('cross-links the buyer guide, the capability hub, the brand page, and the attributed RFQ path', () => {
    // Further Reading + import cross-links to the buyer guide (this article owns
    // "how to buy"; the buyer guide owns "how to choose").
    expect(content).toContain(`href="/insights/${BUYER_GUIDE_SLUG}"`);
    expect(content).toContain('href="/wafer-probe-stations"');
    expect(content).toContain('href="/wafer-probe-stations/semishare"');
    // The attributed RFQ CTA — exact href (serialized &amp; as it appears in the
    // parsed content, which does NOT entity-decode body markup).
    expect(content).toContain(
      'href="/request-quote?products=wafer-probe-station&amp;source=insights/probe-station-procurement-nsf-doe-funded-projects"'
    );
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
      'A compliance-first checklist for buying a probe station on an NSF or DOE award — start with your award terms and institutional thresholds, pick the right procurement method, plan realistic time windows, and clear vendor onboarding before the purchase order.'
    );
    expect(parsed.category).toBe('Metrology & Testing');
    expect(parsed.tags).toEqual([
      'probe station',
      'NSF grant',
      'DOE funding',
      'university procurement',
      'equipment procurement',
      'SAM.gov',
    ]);
    expect(parsed.tags).toHaveLength(6);
    expect(parsed.articleType).toBe('TechArticle');
    expect(parsed.imageUrl).toBe('/assets/images/insights/probe-station-procurement-cover.png');
    expect(parsed.publishDate).toBe('2026-07-13');
    expect(parsed.author).toBe('NineScrolls Engineering');

    expect(parsed.relatedProducts).toHaveLength(2);
    expect(parsed.relatedProducts!.map((p) => p.href)).toEqual([
      '/wafer-probe-stations',
      '/wafer-probe-stations/semishare',
    ]);
  });

  it('derives the expected title and a create-insight-compatible slug', () => {
    const expectedTitle =
      'Probe Station Procurement for NSF and DOE-Funded Projects: A Practical Guide';
    expect(parsed.title).toBe(expectedTitle);

    // create-insight.ts resolves the slug as: --slug flag > <meta article:slug>
    // > generateSlug(title). This title alone would derive a DIFFERENT, longer
    // slug, so the standalone file carries an explicit article:slug meta to
    // preserve the canonical /insights/<slug> URL.
    expect(parsed.slug).toBe(SLUG);
    const resolvedSlug = parsed.slug ?? generateSlug(parsed.title);
    expect(resolvedSlug).toBe(SLUG);
    // Guard that the meta override is actually doing work — the title alone
    // would NOT produce the canonical slug.
    expect(generateSlug(parsed.title)).not.toBe(SLUG);
  });
});

describe('probe station procurement accuracy constraints (editorial-review tripwires)', () => {
  // Normalized view for phrase-FAMILY bans: lowercase, whitespace collapsed —
  // so a ban can't be dodged by casing, line wrapping, or double spaces.
  const normalized = content.toLowerCase().replace(/\s+/g, ' ');

  /** Every window of ±radius chars around each occurrence of `needle`. */
  const windowsAround = (needle: string, radius: number): string[] => {
    const wins: string[] = [];
    let from = 0;
    for (;;) {
      const idx = content.indexOf(needle, from);
      if (idx === -1) return wins;
      wins.push(content.slice(Math.max(0, idx - radius), idx + needle.length + radius));
      from = idx + needle.length;
    }
  };

  it('states the FAR thresholds with institution-first framing (Constraint 1)', () => {
    // The current (2025-10-01) FAR figures must both appear...
    expect(content).toContain('$15,000');
    expect(content).toContain('$350,000');
    // ...and each must be framed institution-first: at least one occurrence of
    // each figure sits within 200 chars of the word "institution". This is the
    // tripwire against a bare federal-number recital with no institution-adopted
    // caveat.
    const nearInstitution = (needle: string): boolean =>
      windowsAround(needle, 200).some((w) => /institution/i.test(w));
    expect(nearInstitution('$15,000'), '$15,000 framed near "institution"').toBe(true);
    expect(nearInstitution('$350,000'), '$350,000 framed near "institution"').toBe(true);
  });

  it('frames the MPT as a baseline (never a ceiling) and the SAT as the true ceiling (Constraint 1)', () => {
    // $15,000 is the FAR default BASELINE — institutions may go lower, self-
    // certify up to $50,000 (§200.320(a)(1)(iv)), or exceed $50,000 with
    // cognizant-agency approval (§200.320(a)(1)(v)). At least one occurrence
    // must be framed as baseline/default...
    expect(
      windowsAround('$15,000', 200).some((w) => /baseline|default/i.test(w)),
      '$15,000 framed as baseline/default',
    ).toBe(true);
    // ...and NO occurrence may be framed as a ceiling/maximum/cap.
    for (const w of windowsAround('$15,000', 100)) {
      expect(w, '$15,000 must never read as a ceiling').not.toMatch(/ceiling|maximum|cap\b/i);
    }
    // The SAT is the one figure that IS a ceiling institutions may not exceed.
    expect(
      windowsAround('$350,000', 200).some((w) => /ceiling|may not exceed/i.test(w)),
      '$350,000 framed as a ceiling',
    ).toBe(true);
    // The (a)(1)(v) above-$50,000 path must be cited, not just (a)(1)(iv).
    expect(content).toContain('200.320(a)(1)(v)');
  });

  it('does not recite the outdated pre-2025 thresholds (Constraint 1)', () => {
    // The prior MPT ($10,000) and stale SAT figure ($250,000) must not appear
    // in any common spelling — they signal the numbers were not refreshed to
    // the 2025-10-01 set.
    expect(normalized).not.toMatch(/\$10,?000|\$10k|\$250,?000|\$250k/i);
  });

  it('never implies federal funds expire at a fiscal-year boundary (Constraint 2)', () => {
    // Phrase families, not exact spellings.
    const BANNED_FISCAL: RegExp[] = [
      /(funds?|money|grant)[^.]{0,40}(lapse|expire)/i,
      /spend[^.]{0,30}by[^.]{0,30}(\bfy\b|fiscal year|september 30)/i,
      /federal fiscal year/i,
      /funds\s+expire/i,
    ];
    for (const pattern of BANNED_FISCAL) {
      expect(normalized, `banned fiscal-expiry wording ${pattern}`).not.toMatch(pattern);
    }
    // Positive: the clocks that DO bind must be named — the award's period of
    // performance and the institution's own internal deadlines.
    expect(normalized).toContain('period of performance');
    expect(
      normalized,
      'institutional deadline/cutoff/closeout framing present',
    ).toMatch(/institution[^.]{0,60}(deadline|cutoff|closeout)/i);
  });

  it('does not overstate SAM.gov or vendor-registration requirements (Constraint 6)', () => {
    const BANNED_SAM: RegExp[] = [
      /vendors?\s+must\s+(be\s+)?register(ed)?\s+in\s+sam/i,
      /suppliers?\s+must\s+(be\s+)?register(ed)?\s+in\s+sam/i,
      /sam\s+registration\s+is\s+required/i,
      /federally\s+funded\s+purchases\s+require\s+sam/i,
      /(nsf|doe)\s+requires\s+vendors/i,
      /required to (have|maintain)[^.]{0,30}sam/i,
      /sam(\.gov)?\s?(enrollment|registration)[^.]{0,20}(mandatory|required)/i,
    ];
    for (const pattern of BANNED_SAM) {
      expect(normalized, `banned SAM/vendor wording ${pattern}`).not.toMatch(pattern);
    }
    // The exact allowed SAM statement must be present verbatim (bonus fact, not
    // requirement) together with its UEI.
    expect(content).toContain(
      'NineScrolls LLC maintains an active SAM.gov registration and UEI C4BFCTH5L5D1.'
    );
  });

  it('makes no delivered-pricing commitment (locked scope: delivery terms are per-quotation)', () => {
    // Policy is unsettled — the article may only say the QUOTATION identifies
    // the delivery term. Any "NineScrolls/SEMISHARE ... delivered pricing"
    // commitment is a release blocker.
    expect(normalized).not.toMatch(/(ninescrolls|semishare)[^.]{0,80}delivered pricing/i);
  });

  it('avoids NineScrolls approval-status inflation and high-risk procurement over-claims (Constraints 4, 7)', () => {
    const BANNED: RegExp[] = [
      // Reference-article bans, carried forward.
      /generally need(s)? .{0,40}SAM/i,
      /cannot buy with your grant/i,
      /\bguaranteed\b/i,
      /installation.{0,30}(included|free)/i,
      /typically includes? .{0,40}(installation|warranty)/i,
      // NineScrolls approval-status inflation.
      /(approved|certified|preferred)\s+(vendor|supplier)/i,
    ];
    for (const pattern of BANNED) {
      expect(content, `banned wording ${pattern}`).not.toMatch(pattern);
    }
  });

  it('gives every content table a caption, column headers, and row headers', () => {
    const tables = content.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    expect(tables.length, 'at least the procurement-method table').toBeGreaterThanOrEqual(1);

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
