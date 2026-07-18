import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from '../../../scripts/lib/parseArticleHtml';
import { FORBIDDEN_ATTESTATION_PATTERNS } from '../../data/probeStations/semishare';

// Third article in the probe-station SEO cluster: the cryogenic buyer's guide.
// It is the "how to compare cooling architectures and write an acceptance-ready
// RFQ" companion to the /applications/cryogenic-probing application page (which
// owns "when cryogenic probing is appropriate"). Like the other cluster
// articles it lives as a standalone HTML file consumed by create-insight.ts;
// parseArticleHtml is the exact parser that script uses, so these assertions
// guard the content as it will actually be written to DynamoDB.
const SLUG = 'cryogenic-probe-station-buyers-guide';
const HTML_PATH = `scripts/articles/${SLUG}.html`;
const APP_PAGE = '/applications/cryogenic-probing';
const BUYER_GUIDE_1_SLUG = 'how-to-choose-wafer-probe-station-university-lab';

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

describe('cryogenic probe station buyer’s guide standalone article', () => {
  it('parses to full content with no hand-written TOC', () => {
    expect(content.length).toBeGreaterThan(10_000); // full article, not a stub
    // The page auto-generates the TOC — the content must not carry one in any
    // of the forms the site (or a naive conversion) could produce:
    expect(content).not.toMatch(/table of contents/i);
    expect(content).not.toMatch(/\bid="toc"|class="[^"]*\btoc\b[^"]*"/i);
    expect(content).not.toMatch(/<nav[^>]*toc/i);
    expect(content).not.toMatch(/<h[23][^>]*>\s*(contents|in this (article|guide))\s*<\/h[23]>/i);
  });

  it('embeds the cooling-architectures figure as its own <picture> block with slug-scoped CDN URLs, adjacent caption, and on-disk source assets', async () => {
    const pictureBlocks = content.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
    const CDN = `https://cdn.ninescrolls.com/insights/${SLUG}`;
    const FIGURE_ALT = 'Comparison diagram of liquid-nitrogen flow or reservoir, closed-cycle cryocooler, and liquid-helium flow or bath architectures, showing thermal paths, consumables and utilities, mechanical vibration sources, operating patterns, and buyer questions';
    const figureSizes = { sm: [640, 360], md: [768, 432], lg: [1024, 576], xl: [1280, 720] } as const;

    // figure name (as it appears in the CDN path) -> local UPLOAD SOURCE basename.
    const FIGURES: Array<{ name: string; localBase: string }> = [
      { name: 'cooling-architectures', localBase: 'cryo-cooling-architectures' },
    ];

    for (const { name, localBase } of FIGURES) {
      const block = pictureBlocks.find((b) => b.includes(`${CDN}/${name}`));
      expect(block, `<picture> block for ${name}`).toBeTruthy();
      expect(block, `${name} exact approved alt`).toContain(`alt="${FIGURE_ALT}"`);

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
      const sourcePath = `public/assets/images/insights/${localBase}.png`;
      const sourceMeta = await sharp(sourcePath).metadata();
      expect(sourceMeta.width).toBe(1600);
      expect(sourceMeta.height).toBe(900);
      expect(sourceMeta.space).toBe('srgb');
      for (const [size, [width, height]] of Object.entries(figureSizes)) {
        for (const extension of ['png', 'webp']) {
          const variantPath = `public/assets/images/insights/${localBase}-${size}.${extension}`;
          const meta = await sharp(variantPath).metadata();
          expect(meta.width, `${size}.${extension} width`).toBe(width);
          expect(meta.height, `${size}.${extension} height`).toBe(height);
          expect(meta.space, `${size}.${extension} colorspace`).toBe('srgb');
        }
      }

      // The IMMEDIATELY ADJACENT caption element (allowing only closing wrapper
      // tags in between) must be a <figcaption>. This figure is a neutral
      // comparison, so the caption flags it as illustrative rather than a
      // product-spec table.
      const afterBlock = content.slice(
        content.indexOf(block!) + block!.length,
        content.indexOf(block!) + block!.length + 800
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i
      );
      expect(captionMatch, `adjacent <figcaption> after ${name}`).toBeTruthy();
      expect(captionMatch![1], `illustrative-comparison disclaimer in ${name} caption`).toMatch(
        /illustrative comparison/i,
      );
    }

    // Cover upload source (base + responsive variants) must be on disk too —
    // the create-insight cover step reads them.
    const coverPath = 'public/assets/images/insights/cryo-buyers-guide-cover.png';
    expect(existsSync(coverPath)).toBe(true);
    const coverMeta = await sharp(coverPath).metadata();
    expect(coverMeta.width).toBe(1600);
    expect(coverMeta.height).toBe(900);
    expect(coverMeta.space).toBe('srgb');
    const coverSizes = { sm: [640, 360], md: [768, 432], lg: [1024, 576], xl: [1280, 720] } as const;
    for (const [size, [width, height]] of Object.entries(coverSizes)) {
      for (const extension of ['png', 'webp']) {
        const variantPath = `public/assets/images/insights/cryo-buyers-guide-cover-${size}.${extension}`;
        expect(existsSync(variantPath), `cover-${size}.${extension} on disk`).toBe(true);
        const variantMeta = await sharp(variantPath).metadata();
        expect(variantMeta.width, `${size}.${extension} width`).toBe(width);
        expect(variantMeta.height, `${size}.${extension} height`).toBe(height);
        expect(variantMeta.space, `${size}.${extension} colorspace`).toBe('srgb');
      }
    }
  });

  it('cross-links the application page, buyer guide #1, the brand page (once), the hub, and the attributed RFQ path', () => {
    // Lane cross-link: this guide sits above the application page (which owns
    // "when cryogenic probing is appropriate").
    expect(content).toContain(`href="${APP_PAGE}"`);
    // Further Reading link to the university-lab selection guide (buyer guide #1).
    expect(content).toContain(`href="/insights/${BUYER_GUIDE_1_SLUG}"`);
    // The capability hub.
    expect(content).toContain('href="/wafer-probe-stations"');
    // The brand page, linked exactly once.
    expect(
      (content.match(/href="\/wafer-probe-stations\/semishare"/g) ?? []).length,
      'brand page linked exactly once',
    ).toBe(1);
    // The attributed RFQ CTA — exact href (serialized &amp; as it appears in the
    // parsed content, which does NOT entity-decode body markup).
    expect(content).toContain(
      'href="/request-quote?products=cryogenic-probe-station&amp;source=insights/cryogenic-probe-station-buyers-guide"'
    );
    // The RFQ route is /request-quote, never /quote.
    expect(content).not.toContain('href="/quote"');
  });

  it('carries no attestation wording (Constraint 7 tripwire)', () => {
    for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
    // Heuristic tripwire, not proof: a number+unit within 60 chars after
    // "SEMISHARE" flags a potentially product-attributed spec.
    expect(content).not.toMatch(/SEMISHARE[^<.]{0,60}\d+\s?(K\b|mm|inch|"|µm|um)/i);
  });

  it('mentions SEMISHARE exactly once across body AND metadata combined (locked scope)', () => {
    // Locked scope: one brand mention total. Checked against the FULL HTML
    // document (not just the parsed body) so a related-products JSON entry or
    // meta tag cannot reintroduce a second mention invisibly. The canonical
    // route href is excluded first — it is navigation, not brand copy.
    const htmlSansRoute = html.replace(/href="\/wafer-probe-stations\/semishare"/g, '');
    expect(
      (htmlSansRoute.match(/semishare/gi) ?? []).length,
      'SEMISHARE brand mentions across body + metadata',
    ).toBe(1);
  });

  it('exposes the authoring metadata the create-insight flow will write to DynamoDB', () => {
    expect(parsed.excerpt).toBe(
      'How to compare cryogenic probe station cooling architectures, read temperature and vibration specifications the way a metrologist does, and turn a vendor conversation into an acceptance-ready RFQ — base temperature under defined load, comparable vibration metrics, vacuum and interface dimensions, and total cost of ownership.'
    );
    expect(parsed.category).toBe('Metrology & Testing');
    expect(parsed.tags).toEqual([
      'cryogenic probe station',
      'closed-cycle cryocooler',
      'liquid nitrogen',
      'low-temperature measurement',
      'equipment procurement',
    ]);
    expect(parsed.tags).toHaveLength(5);
    expect(parsed.articleType).toBe('TechArticle');
    expect(parsed.imageUrl).toBe('/assets/images/insights/cryo-buyers-guide-cover.png');
    expect(parsed.publishDate).toBe('2026-07-13');
    expect(parsed.author).toBe('NineScrolls Engineering');

    expect(parsed.relatedProducts).toHaveLength(2);
    // The brand page is deliberately NOT a related product — SEMISHARE appears
    // exactly once (the body "Where NineScrolls fits" link); the second related
    // slot cross-links the application page (lane companion) instead.
    expect(parsed.relatedProducts!.map((p) => p.href)).toEqual([
      '/wafer-probe-stations',
      '/applications/cryogenic-probing',
    ]);
  });

  it('derives the expected title and the canonical create-insight slug', () => {
    const expectedTitle =
      "Cryogenic Probe Station Buyer's Guide: Architectures, Specifications, and an Acceptance-Ready RFQ";
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

  it('gives every content table a caption, column headers, and row headers', () => {
    const tables = content.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    expect(tables.length, 'at least the four-temperatures table').toBeGreaterThanOrEqual(1);

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

describe('cryogenic buyer’s guide accuracy constraints (editorial-review tripwires)', () => {
  // Normalized view for phrase-FAMILY bans: lowercase, whitespace collapsed —
  // so a ban can't be dodged by casing, line wrapping, or double spaces.
  const normalized = content.toLowerCase().replace(/\s+/g, ' ');

  // ─── Shared guard families (SINGLE SOURCE OF TRUTH) ───────────────────────
  // The article assertions below AND the mutation meta-test consume these same
  // arrays. A weakened production guard therefore fails the mutation table —
  // there is no shadow copy that can stay green. NONE of these carry the /g
  // flag (stateful lastIndex would break repeated .test() calls).
  // Unified kelvin token: digits OR spelled-out numbers, "K" or "kelvin" —
  // every family below (brand proximity AND capability promises) sees both
  // forms, so "four kelvin" is exactly as banned as "4 K".
  // Spelled numbers use a composable grammar (ones, teens, tens with optional
  // hyphen/space compounds, and "a/one hundred [and] …"), not an enumeration —
  // "eleven kelvin" and "one hundred kelvin" are as banned as "4 K".
  const ONES = String.raw`(?:one|two|three|four|five|six|seven|eight|nine)`;
  const TEENS = String.raw`(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)`;
  const TENS = String.raw`(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)`;
  const SPELLED = String.raw`(?:(?:a|one)\s+hundred(?:\s+(?:and\s+)?(?:${TENS}(?:[-\s]${ONES})?|${TEENS}|${ONES}))?|${TENS}(?:[-\s]${ONES})?|${TEENS}|${ONES})`;
  const KELVIN_NUM = String.raw`(?:\d+(?:\.\d+)?|${SPELLED})`;
  const KELVIN = String.raw`${KELVIN_NUM}\s?(?:k\b|kelvin\b)`;
  const GUARD_FAMILIES: Record<string, RegExp[]> = {
    // A product brand (SEMISHARE / CGX) within ±80 chars of any kelvin figure,
    // in EITHER direction — the core "no brand-attributed temperature" ban.
    brandNearKelvin: [
      new RegExp(`(?:semishare|cgx)[\\s\\S]{0,80}${KELVIN}|${KELVIN}[\\s\\S]{0,80}(?:semishare|cgx)`, 'i'),
    ],
    // Product-capability temperature PROMISES: a system "will reach / achieves /
    // delivers / guaranteed / operates at / cools (down) to / has a base
    // temperature of" some kelvin figure — in digits or spelled out. The verbs
    // are anchored to capability phrasings ("boils at 4.2 K" is a property of
    // the cryogen, not a capability promise, and must stay legal).
    capabilityTempPromise: [
      // Verb set includes bare "reach(es)" — a system "reaches N K" is a
      // capability promise with or without a brand in range.
      new RegExp(`(?:will\\s+reach|reach(?:es|ing)?|achieves?|delivers?|guaranteed)[^.]{0,40}${KELVIN}`, 'i'),
      new RegExp(`\\b(?:operates?|cool(?:s|ing)?\\s+down|cools?)\\s+(?:at|to)[^.]{0,20}${KELVIN}`, 'i'),
      // "base temperature is/of/at N K" — with or without a has/have prefix.
      new RegExp(`\\bbase\\s+temperature\\s*(?:of|is|at|:)?[^.]{0,25}${KELVIN}`, 'i'),
    ],
    // "guaranteed performance / base temperature" and the bare word "guaranteed"
    // anywhere — temperature claims are acceptance criteria, never guarantees.
    guaranteedClaims: [
      /guaranteed\s+(?:performance|base\s+temperature)/i,
      /\bguaranteed\b/i,
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

  it('never attributes a kelvin temperature to a product brand (locked scope)', () => {
    for (const pattern of GUARD_FAMILIES.brandNearKelvin) {
      expect(normalized, `banned brand-near-kelvin wording ${pattern}`).not.toMatch(pattern);
    }
  });

  it('makes no product-capability temperature promise and never says "guaranteed"', () => {
    for (const pattern of [...GUARD_FAMILIES.capabilityTempPromise, ...GUARD_FAMILIES.guaranteedClaims]) {
      expect(content, `banned capability/guarantee wording ${pattern}`).not.toMatch(pattern);
    }
  });

  it('presents 77.4 K and 4.2 K only as normal boiling points of their cryogen (Constraint 3)', () => {
    // 77.4 K must sit within 200 chars of liquid nitrogen AND a boiling-point phrase.
    expect(
      windowsAround('77.4 K', 200).some((w) => /liquid nitrogen|ln2|ln₂/i.test(w)),
      '77.4 K near liquid nitrogen',
    ).toBe(true);
    expect(
      windowsAround('77.4 K', 200).some((w) => /boiling point|normal boiling/i.test(w)),
      '77.4 K near a boiling-point phrase',
    ).toBe(true);
    // 4.2 K must sit within 200 chars of liquid helium AND a boiling-point phrase.
    expect(
      windowsAround('4.2 K', 200).some((w) => /liquid helium|lhe/i.test(w)),
      '4.2 K near liquid helium',
    ).toBe(true);
    expect(
      windowsAround('4.2 K', 200).some((w) => /boiling point|normal boiling/i.test(w)),
      '4.2 K near a boiling-point phrase',
    ).toBe(true);
  });

  it('uses "10 K-class" only as a category orientation, never as a brand promise (Constraint 3)', () => {
    expect(normalized, '"10 K-class" is present').toMatch(/10 k-class/i);
    // A class/category/orientation qualifier must sit within 200 chars...
    expect(
      windowsAround('10 K-class', 200).some((w) => /\b(class|category|orientation)\b/i.test(w)),
      '"10 K-class" carries a category/orientation qualifier',
    ).toBe(true);
    // ...and no brand may sit within 80 chars of it.
    for (const w of windowsAround('10 K-class', 80)) {
      expect(w, '"10 K-class" must never sit near a brand name').not.toMatch(/semishare|cgx/i);
    }
  });

  it('names all four temperature locations plus "defined load" and "acceptance criteria" (Constraints 4, 8)', () => {
    // The four distinct locations a single "base temperature" claim can confuse.
    expect(normalized, 'names the cold head').toContain('cold head');
    expect(normalized, 'names the sample stage / chuck').toMatch(/sample stage|stage\/chuck|\bchuck\b/i);
    expect(normalized, 'names the sensor location').toContain('sensor location');
    expect(normalized, 'names the sample / device').toMatch(/\bsample\b|\bdevice\b/i);
    // The spine phrase and the RFQ language.
    expect(normalized, 'states "defined load"').toMatch(/(under )?defined load/i);
    expect(normalized, 'uses "acceptance criteria" language').toContain('acceptance criteria');
  });

  it('guard families catch known prohibited variants (table-driven mutation cases)', () => {
    // Meta-test of the PRODUCTION guards: it consumes ALL_GUARDS — the exact
    // arrays the article assertions use — so weakening any family fails here
    // even though the article itself is untouched. Every sentence is a natural
    // (non-evasive) phrasing of a prohibited claim from the locked review.
    const MUTATIONS = [
      // Each family has at least one row ONLY it catches, so deleting any
      // family (or its load-bearing pattern) fails this table:
      //  - brandNearKelvin uniquely: 'The CGX chuck stays below 20 K.'
      //    ("stays below" is not a capability verb; no "guaranteed"), and
      //    its REVERSE branch uniquely: 'Four kelvin is the SEMISHARE
      //    target.' / 'One hundred kelvin is the CGX target.' (temperature
      //    precedes the brand, no capability verb).
      //    Brand rows with capability verbs ('CGX series reaches 4 K',
      //    'SEMISHARE stations cool to 77 K', 'CGX platform cools to four
      //    kelvin') are intentionally caught by BOTH families — the locked
      //    requirement is that the capability guard covers "reaches N K"
      //    regardless of brand presence.
      //  - capabilityTempPromise uniquely: 'This system achieves 3.5 K.',
      //    'This system operates at 4 K.', 'It cools down to 4 K.',
      //    'The station has a base temperature of 4 K.', and the spelled-out
      //    'This cryostat reaches ten kelvin.' (no brand within range).
      //  - guaranteedClaims (bare \bguaranteed\b) uniquely:
      //    'Cooldown time is guaranteed.' (no kelvin figure, no brand,
      //    no "performance/base temperature" noun).
      'The CGX chuck stays below 20 K.',
      // Reverse-direction regression lock: kelvin BEFORE the brand, no
      // capability verb — ONLY brandNearKelvin's reverse alternation catches
      // this row; deleting that branch fails the table.
      'Four kelvin is the SEMISHARE target.',
      'One hundred kelvin is the CGX target.',
      // Composable spelled-number grammar coverage:
      'This system reaches eleven kelvin.',
      'SEMISHARE reaches twelve kelvin.',
      'The CGX series reaches 4 K.',
      'The CGX platform cools to four kelvin.',
      'This system reaches 4 K.',
      'The base temperature is 4 K.',
      'It reaches 4 kelvin.',
      'The station has a base temperature of four kelvin.',
      'This system achieves 3.5 K.',
      'Guaranteed base temperature of 10 K.',
      'SEMISHARE stations cool to 77 K.',
      'Cooldown time is guaranteed.',
      'This system operates at 4 K.',
      'It cools down to 4 K.',
      'The station has a base temperature of 4 K.',
      'This cryostat reaches ten kelvin.',
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
      'Liquid nitrogen has a normal boiling point of 77.4 K at atmospheric pressure.',
      'Liquid helium boils at 4.2 K at atmospheric pressure.',
      'Closed-cycle systems are often described as 10 K-class as a category orientation; the actual stage temperature depends on heat load, thermal links, and configuration.',
      'Frame these as acceptance criteria to be demonstrated, and both sides know what working means before the purchase order is issued.',
    ];
    for (const sentence of NEGATIVE_CONTROLS) {
      const hit = ALL_GUARDS.find((p) => p.test(sentence.toLowerCase()));
      expect(hit, `negative control falsely flagged by ${hit}: "${sentence}"`).toBeUndefined();
    }
  });
});
