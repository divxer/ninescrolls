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
      // flowchart, so the caption states that phase order and duration vary
      // rather than presenting the sequence as a universal fixed schedule.
      const afterBlock = content.slice(
        content.indexOf(block!) + block!.length,
        content.indexOf(block!) + block!.length + 800
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i
      );
      expect(captionMatch, `adjacent <figcaption> after ${name}`).toBeTruthy();
      expect(captionMatch![1], `variable-order-and-duration disclaimer in ${name} caption`).toMatch(
        /order and duration of individual phases vary by institution and award/i,
      );
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

  // ─── Shared guard families (SINGLE SOURCE OF TRUTH) ───────────────────────
  // The article assertions below AND the mutation meta-test consume these same
  // arrays. A weakened production guard therefore fails the mutation table —
  // there is no shadow copy that can stay green (re-review finding).
  const GUARD_FAMILIES: Record<string, RegExp[]> = {
    staleThresholds: [
      /\$10,?000|\$10k|usd\s?10,?000|\b(10|ten)\s+thousand\s+dollars/i,
      /\$250,?000|\$250k|usd\s?250,?000|\b250\s+thousand\s+dollars/i,
    ],
    fiscalExpiry: [
      /(funds?|money|grant|award|balance)[^.]{0,60}(lapse|expire)/i,
      /(spend|spent|use|used|obligate|obligated)[^.]{0,40}(by|before)[^.]{0,40}(\bfy\b|fy[- ]end|fiscal year|september 30)/i,
      /(award|grant|balance|funds?)[^.]{0,60}(must|has|have) to be (used|spent|obligated)[^.]{0,60}(september 30|fiscal year|fy[- ]end)/i,
      /federal fiscal year/i,
      /funds\s+expire/i,
    ],
    samMandatory: [
      // Bidirectional proximity with TEMPERED gaps ((?!\bnot\b)[^.]) so the
      // mandated negated qualifier ("supplier is NOT universally required to
      // register…") stays legal while every affirmative phrasing — including
      // "have to register" — is caught.
      /(vendor|supplier)s?(?:(?!\bnot\b)[^.]){0,80}(must|required|mandatory|need(s|ed)?|ha(s|ve)\s+to)(?:(?!\bnot\b)[^.]){0,80}sam(\.gov)?/i,
      /sam(\.gov)?(?:(?!\bnot\b)[^.]){0,80}(mandatory|required|must|ha(s|ve)\s+to)(?:(?!\bnot\b)[^.]){0,80}(vendor|supplier)s?/i,
      /sam\s+registration\s+is\s+required/i,
      /federally\s+funded\s+purchases\s+require\s+sam/i,
      /(nsf|doe)\s+requires\s+(vendor|supplier)s?/i,
      // Lookbehind excludes preceding negation ("not universally required to
      // register in SAM.gov" is the mandated qualifier and must not match).
      /(?<!\bnot\b[^.]{0,30})required to (have|maintain|register)[^.]{0,40}sam/i,
      /sam(\.gov)?\s?(enrollment|registration)[^.]{0,20}(mandatory|required)/i,
    ],
    deliveryCommitment: [
      // brand/we/our → delivered/landed → price/quote
      /(ninescrolls|semishare|\bwe\b|\bour\b)[^.]{0,80}(delivered|landed|delivery[- ]inclusive|all[- ]inclusive)[^.]{0,30}(pricing|price|quote)/i,
      /(offer|provide)s?[^.]{0,60}(delivered|landed|delivery[- ]inclusive)[^.]{0,30}(pricing|price|quote)/i,
      // price-first / inclusive forms: "our prices include delivery",
      // "pricing is inclusive of delivery"
      /(ninescrolls|semishare|\bwe\b|\bour\b)[^.]{0,80}(price|pricing|quote|quotation)s?[^.]{0,40}(includes?|included|inclusive)[^.]{0,30}(delivery|shipping|freight)/i,
      // delivery-first: "… with delivery included"
      /(ninescrolls|semishare|\bwe\b|\bour\b)[^.]{0,80}(delivery|shipping|freight)[^.]{0,30}(included|inclusive)/i,
    ],
  };
  const ALL_GUARDS: RegExp[] = Object.values(GUARD_FAMILIES).flat();

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
    // The (a)(1)(v) above-$50,000 path must be cited, not just (a)(1)(iv) —
    // and the citation must keep its SEMANTICS: within a window around the
    // citation, the >$50,000 amount, the cognizant agency, and the approval
    // requirement must all still be stated (a bare section number that lost
    // its meaning would pass a toContain check).
    const idx = content.indexOf('200.320(a)(1)(v)');
    expect(idx, 'the (a)(1)(v) citation is present').toBeGreaterThan(-1);
    const window = content.slice(Math.max(0, idx - 400), idx + 400);
    expect(window, '(a)(1)(v) window states the $50,000 amount').toMatch(/\$50,000/);
    expect(window, '(a)(1)(v) window names the cognizant agency').toMatch(/cognizant agency/i);
    expect(window, '(a)(1)(v) window states the approval requirement').toMatch(/approv/i);
  });

  it('does not recite the outdated pre-2025 thresholds (Constraint 1)', () => {
    // The prior MPT ($10,000) and stale SAT figure ($250,000) must not appear
    // in any common spelling — they signal the numbers were not refreshed to
    // the 2025-10-01 set.
    for (const pattern of GUARD_FAMILIES.staleThresholds) {
      expect(normalized, `stale threshold spelling ${pattern}`).not.toMatch(pattern);
    }
  });

  it('never implies federal funds expire at a fiscal-year boundary (Constraint 2)', () => {
    // Phrase families, not exact spellings.
    for (const pattern of GUARD_FAMILIES.fiscalExpiry) {
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
    for (const pattern of GUARD_FAMILIES.samMandatory) {
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
    for (const pattern of GUARD_FAMILIES.deliveryCommitment) {
      expect(normalized, `banned delivery-commitment wording ${pattern}`).not.toMatch(pattern);
    }
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

  it('guard families catch known prohibited variants (table-driven mutation cases)', () => {
    // Meta-test of the PRODUCTION guards: it consumes ALL_GUARDS — the exact
    // arrays the article assertions use — so weakening any family fails here
    // even though the article itself is untouched. Every sentence is a
    // natural (non-evasive) phrasing of a prohibited claim from past reviews.
    const MUTATIONS = [
      'The old threshold is USD 10,000.',
      'The old threshold is 10 thousand dollars.',
      'The award balance must be used before September 30.',
      'All vendors are required to register with SAM.gov.',
      'Vendors have to register with SAM.gov.',
      'SAM enrollment is mandatory.',
      'We offer delivered pricing for SEMISHARE systems.',
      'NineScrolls offers landed pricing.',
      'NineScrolls offers delivery-inclusive pricing.',
      'Our prices include delivery.',
      'NineScrolls pricing is inclusive of delivery.',
      'We quote SEMISHARE systems with delivery included.',
      'Grant funds lapse at the end of the period.',
    ];
    for (const sentence of MUTATIONS) {
      const mutated = (content + ' ' + sentence).toLowerCase().replace(/\s+/g, ' ');
      expect(
        ALL_GUARDS.some((p) => p.test(sentence.toLowerCase())) &&
          ALL_GUARDS.some((p) => p.test(mutated)),
        `mutation not caught by any guard family: "${sentence}"`,
      ).toBe(true);
    }

    // Negative controls: the MANDATED wording must never trip a family — a
    // future "tightening" that flags these is itself a regression.
    const NEGATIVE_CONTROLS = [
      'A commercial equipment supplier is not universally required to register in SAM.gov merely because the purchase is charged to a Federal grant.',
      'The quotation identifies the applicable delivery term, import responsibilities, and any separately stated logistics charges for the quoted configuration.',
    ];
    for (const sentence of NEGATIVE_CONTROLS) {
      const hit = ALL_GUARDS.find((p) => p.test(sentence.toLowerCase()));
      expect(hit, `negative control falsely flagged by ${hit}: "${sentence}"`).toBeUndefined();
    }
  });
});
