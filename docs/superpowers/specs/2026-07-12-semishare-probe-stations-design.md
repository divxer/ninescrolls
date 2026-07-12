# SEMISHARE Probe Stations — Website Launch Design

**Date:** 2026-07-12
**Status:** Approved by Harvey (brainstorming session 2026-07-12)
**Branch:** `feature/semishare-probe-stations`
**Strategy sources (external, not in repo):**
- `合作厂家/深圳森美协尔科技有限公司/13_BSW模式_NS美洲对标战略.md`
- `合作厂家/深圳森美协尔科技有限公司/森美协尔_SEO与Google能见度调研_2026-07-05.md`
- `合作厂家/深圳森美协尔科技有限公司/官网内容/how-to-choose-wafer-probe-station-university-lab.md` (drafted article)

## Background

NineScrolls has agreed to a channel partnership with SEMISHARE CO., LTD.
(semishareprober.com), a Shenzhen wafer probe station manufacturer, to represent
their products in the US/Canada market. SEO research shows a structural gap:
SEMISHARE ranks well in US Google but every result is tagged "Missing: usa" and
Google AI Overview classifies them as a "global supplier" with no US procurement
path. BSW Testsystems (Switzerland) proved the "regional partner + Chinese
brand" model in Europe, including using "Semishare" in page titles for SEO.
NineScrolls replicates that structure for the Americas.

## Confirmed Constraints (from brainstorming)

1. **Full scope this release**: all 4 strategy pages + first insight article +
   SEO infrastructure. Model-level product pages (X8, CGX, …) are OUT of scope.
2. **Hybrid URL architecture**: standalone SEO strategy pages
   (`/wafer-probe-stations`, `/wafer-probe-stations/semishare`,
   `/applications/*`) plus a "Wafer Probe Stations" category entry on
   `/products` linking to the capability page. Model-level pages will later go
   into `/products/*` reusing the existing ProductDetailPage template — not now.
3. **Public-verifiable data only (first version)**: the official SEMISHARE
   datasheet pack has NOT arrived. Every specification must trace to a public
   semishareprober.com page, annotated per-row with source URL + capture date.
   When the official pack arrives, specs are re-verified and corrected.
4. **No OEM website images**: first version uses original schematic diagrams
   (brand colors, generated via Python/PIL), each labeled "Schematic
   illustration, not actual product appearance". Official product photos are
   added only from the authorized material pack (or after explicit image-use
   confirmation). Never hotlink or copy images from semishareprober.com.
5. **Approach A**: independent page components reusing existing building blocks
   (SEO, FAQ, CTA, Breadcrumbs) plus a small set of new probe-station shared
   components. Do NOT extend the ProductDetailPage config template.
6. **Attestation wording gate**: L2 (brand-name page titles, partner listing)
   is verbally agreed but not yet confirmed in writing. Page titles MAY use
   "SEMISHARE" (BSW-aligned usage). However, attestation-style wording that
   asserts an authorization relationship ("Authorized channel partner",
   partner badges/logos) is gated behind a single config flag and ships OFF.
   Until the flag is turned on (upon explicit written L2 confirmation), the
   banner uses neutral, factual service wording, e.g. "NineScrolls provides
   US & Canada procurement, import, and support for SEMISHARE wafer probe
   stations." Flipping the wording later is a one-line config change.
   All gated outputs are defined in ONE controlled-wording registry next to
   the flag (data module): attestation phrases ("Authorized channel partner",
   "Channel Partner"), partner badges/logos, and JSON-LD partnership claims.
   Enforcement is two-layer (details in §6):
   - **Access path**: components never hardcode partner-relationship phrasing
     or assets; every gated output (banner text, gated title variant,
     Organization JSON-LD claim, badge assets) is obtained through the
     registry's API, which resolves per the flag.
   - **Static scan**: the registry also exports a forbidden-pattern list — a
     superset of the gated phrases plus known synonym PHRASES (phrase-level
     patterns such as `authori[sz]ed (channel )?(partner|distributor|dealer|
     reseller)`, `official (partner|distributor)`, case-insensitive — NOT the
     bare word "authorized", which would false-positive on auth code like
     "Unauthorized") and badge asset path patterns — and a static test fails
     if any of them appears in `src/**` source outside the registry module and
     its tests. This catches hardcoded bypasses; genuinely novel synonyms
     remain a review-time concern, which is why the access-path rule exists.
7. **No unverifiable specs**: if a specification (or an entire product-line
   block) has no qualifying public source, it is omitted — not inferred, not
   paraphrased from memory, not back-filled from third-party sites. An omitted
   block renders as a qualitative description with a "detailed specifications
   on request" CTA instead of a spec table.

## 1. Information Architecture & Routing

Four new public routes, lazy-loaded (consistent with the AdminRoutes chunking
pattern so the public bundle does not grow):

| Page | URL | Target keywords |
|---|---|---|
| Capability page | `/wafer-probe-stations` | probe station for university research; wafer probe station types comparison |
| SEMISHARE brand page | `/wafer-probe-stations/semishare` | SEMISHARE distributor USA; SEMISHARE probe station buy USA |
| Cryogenic application page | `/applications/cryogenic-probing` | cryogenic probe station; low temperature probe station buy usa |
| Silicon photonics application page | `/applications/silicon-photonics-probing` | silicon photonics testing setup; wafer-level photonic testing |

Linkage changes:
- `ProductsPage`: add a "Wafer Probe Stations" category card linking to
  `/wafer-probe-stations`.
- Header/Footer navigation: add one entry in the Products area.
- Internal linking: the capability page is the hub; all four pages and the
  insight article cross-link (capability ↔ brand, capability ↔ applications,
  article → capability + brand).

Routes registered in `src/routes/index.tsx` (public section).

## 2. Page Content Design

**Capability page** (`/wafer-probe-stations`): category overview — what a probe
station does → manual / semi-automatic / fully-automatic → temperature
environments → signal types (DC / RF / optical). Educational tone (Ossila
model). Funnels to brand page, both application pages, and the article. RFQ CTA
at bottom. Does not lead with the SEMISHARE brand (category page, not brand
page).

**Brand page** (`/wafer-probe-stations/semishare`), mirroring the BSW page
structure:
- Title: the `SEO` component appends `| NineScrolls LLC` to every title
  (`SEO.tsx` `fullTitle`), so pages pass the title WITHOUT a site-name suffix.
  The `title` prop follows the attestation gate: flag OFF (default at launch) →
  `SEMISHARE Wafer Probe Stations | US & Canada Sales & Support`; flag ON →
  `SEMISHARE Wafer Probe Stations | US & Canada Channel Partner`. Rendered
  document title is therefore `... | NineScrolls LLC`; tests assert the exact
  final string.
- Hero with `PartnerAttestationBanner` (gated wording per Constraint 6).
- Product line sections: A series (fully automatic 8/12"), X series
  (semi-automatic), CGX (cryogenic vacuum 77K/10K–450K), SM/SE/SH manual
  series, wafer-level silicon photonics probing, Mask Laser Repair. Each with a
  `SourcedSpecTable` of public-verifiable specs — or, where no qualifying
  public source exists, a qualitative description with a "detailed
  specifications on request" CTA instead (Constraint 7).
- "Why buy through NineScrolls": US customs/import experience, SAM.gov UEI
  (C4BFCTH5L5D1) federal supplier registration, local after-sales support,
  8+ years North American research equipment channel.
- Installed-base credibility from public sources only (NUS, NTU installations).
- FAQ block + RFQ CTA.

**Cryogenic application page**: educational deep-dive — why vacuum cryo probing,
77K (LN2) vs 10K (He) regimes, application mapping (superconductors, quantum
transport, 2D materials), selection criteria, embedded CTA.

**Silicon photonics application page**: wafer-level photonic testing — fiber
coupling + electrical probing, academic use cases, what to look for, embedded
CTA.

**Structured data (JSON-LD)**: all four pages get `BreadcrumbList`. `FAQPage`
markup is emitted ONLY on pages that render a visible FAQ block, and its
questions/answers must match the visible content exactly. The capability page
and brand page ship with visible FAQ blocks; the two application pages add
`FAQPage` only if their content includes a rendered FAQ section.
The brand page additionally gets Organization-level markup describing
NineScrolls as a US-based supplier/support provider for SEMISHARE wafer probe
stations (wording follows the attestation gate), so Google AI Overview learns
the "US procurement path for SEMISHARE" association.

## 3. Components & Data (Approach A)

New files:
- `src/pages/probeStations/` — four page components
  (`WaferProbeStationsPage`, `SemishareBrandPage`, `CryogenicProbingPage`,
  `SiliconPhotonicsProbingPage`) + tests.
- `src/components/probeStations/` — shared building blocks:
  1. `PartnerAttestationBanner` — single point of maintenance for partner
     wording; reads the attestation flag (Constraint 6).
  2. `SourcedSpecTable` — spec table where every row carries a source
     annotation (URL + capture date); renders an OEM-confirmation disclaimer
     ("Specifications from manufacturer public materials; subject to OEM
     confirmation"). (Superseded by Amendment 2026-07-12: source annotations are
     data-module-only — the table no longer renders per-row source URLs
     customer-facing; see the Amendment section below.)
  3. `StationTypeComparison` — manual / semi-auto / full-auto comparison block
     for the React pages. The insight article (HTML stored in DynamoDB) cannot
     render React components, so it keeps its own editorial comparison table;
     there is no shared rendering or single-source requirement between the two.
     The scope of the "data-module only" rule: **product-line performance
     specifications** — any number attributed to a specific SEMISHARE series
     or model (e.g. "CGX: 77K–450K", "A series: 12-inch, 8-inch compatible",
     positioning resolution of a given micropositioner) — live only in
     `semishare.ts` and render only through `SourcedSpecTable`. Generic domain
     quantities NOT attributed to a SEMISHARE product (LN2 temperature 77 K as
     physics, standard wafer diameters as a category, typical temperature
     regimes in educational prose and schematics) may appear in page prose,
     the article, and diagrams; they still follow normal editorial accuracy
     but need no `source` entry. If a sentence ties a number to a SEMISHARE
     product, that number must come from the data module.
  4. `SchematicFigure` — figure wrapper that always renders the "Schematic
     illustration, not actual product appearance" caption.
- `src/data/probeStations/semishare.ts` — the single source of truth for all
  SEMISHARE product-line data. Every spec entry has a required `source` field
  (`{ url, capturedOn }`). No spec may be added without one (enforced by test,
  §6). The attestation flag lives here too.

Reused existing components: `SEO` (`src/components/common/SEO.tsx`),
`Breadcrumbs`, FAQ pattern from the product template, RFQ/quote CTA components,
`OptimizedImage`, layout components.

## 4. SEO Infrastructure

- **Sitemap**: add the 4 URLs to BOTH static URL lists —
  `scripts/generate-seo.ts` and
  `amplify/functions/generate-sitemaps/handler.ts` (production Lambda).
- **Amplify Console routing**: rewrite rules live in the Amplify Console, not
  the repo, so whether the existing SPA fallback covers the new paths cannot be
  verified from code (past experience says new routes have needed Console
  rules, but that is unconfirmed for these paths). Do NOT pre-add rules.
  Deployment acceptance check: after deploy, direct-load all 4 URLs in
  production (fresh tab, no client-side navigation); add Console rewrite rules
  only for paths that fail. The PR deployment checklist records this check.
- **llms.txt**: add the 4 pages to `public/llms.txt` and `public/llms-full.txt`.
  Note `check-llms-sync` only validates `/insights/<slug>` links against
  DynamoDB and does NOT cover static pages — so add a unit test asserting all
  4 URLs are present in both files (still run `check-llms-sync` for the
  article, §5).
- **Per-page SEO**: full title / meta description / OG tags / canonical via the
  existing `SEO` component.
- **Do not compete** with SEMISHARE's own rankings on generic category terms
  ("wafer probe station" head term); pages target the US-procurement-path and
  educational long-tail keywords listed in §1.

## 5. Insight Article Publication

The drafted article "How to Choose a Wafer Probe Station for Your University
Research Lab" (already written, lives in the partner materials folder) ships
via the existing insights pipeline:
- Convert to HTML in `scripts/insightsPostsData.ts`; publish to DynamoDB via
  the existing update/seed scripts (DynamoDB is the source of truth).
- Fill the draft's two "Figure Suggestion" placeholders with original diagrams
  (Python/PIL, brand colors navy `#1e3a5f` / blue `#3b82f6`): (a) temperature
  regime tiers, (b) manual vs semi-auto vs full-auto comparison. Responsive
  `<picture>` WebP variants (sm/md/lg/xl) under
  `public/assets/images/insights/`.
- No TOC in the HTML (the page auto-generates one).
- Article internal links: capability page + brand page.
- Sitemap for the article comes from the dynamic insights sitemap (no static
  entry needed).

## 6. Testing & Verification

- Each page gets a `.test.tsx` (renders, SEO tags present — including exact
  final document title with the `| NineScrolls LLC` suffix — key content
  assertions) matching existing page-test style.
- Attestation gate tests (Constraint 6), three layers:
  - **Static scan test**: no forbidden-literal (registry's forbidden list:
    gated phrases + known synonyms, case-insensitive) and no badge asset path
    pattern appears anywhere in `src/**` source outside the registry module
    and test files. This runs against source text, not rendered output, so it
    is not circular with the registry.
  - **Render tests, all 4 routes × both flag states**. Per state, assert each
    output category separately — rendered body text, document title, every
    JSON-LD script payload, and image alt/src (badges/logos):
    - Flag OFF: no gated phrase or badge asset in any category on any route;
      the banner renders the neutral service wording; the brand-page title is
      the "Sales & Support" variant; Organization JSON-LD contains no
      partnership claim.
    - Flag ON: each gated output renders exactly its registry value — banner
      phrase, "Channel Partner" title variant, Organization JSON-LD
      partnership claim, and badge assets (if defined) each asserted
      individually.
- Spec-traceability test: every spec entry in
  `src/data/probeStations/semishare.ts` has a `source.url` that parses via
  `new URL()`, uses `https:`, and whose hostname is exactly
  `semishareprober.com` or `www.semishareprober.com`; and a `capturedOn` that
  matches `YYYY-MM-DD`, is a real calendar date (round-trip check — parsing
  then re-formatting yields the same string, rejecting rollover dates like
  `2026-02-30`), and is not in the future.
- Browser verification on the dev server: all 4 pages + the published article
  render; mobile breakpoint screenshots; console free of new errors (known
  pre-existing: Segment fetch failures, fetchPriority warning).
- Vitest run excludes `**/.claude/**` (worktree glob trap).

## Out of Scope (YAGNI)

- Model-level product pages and Stripe commerce panels (probe stations are
  RFQ-only, no cart/checkout).
- The remaining 5 articles of the SEO content series (published one at a time
  later).
- SEMISHARE's own website changes (Contact Us listing NineScrolls — their
  action, tracked in the partnership docs).
- Password-gated portal; Chinese-language pages (target market is US/Canada
  academic and industry customers).

## Follow-ups After Official Material Pack Arrives (not this release)

1. Re-verify every `SourcedSpecTable` row against official datasheets; update
   `source` fields.
2. Replace hero/product-card schematics with authorized product photos; keep
   schematic diagrams for principle/process explanations.
3. Flip the attestation flag upon explicit written L2 confirmation.
4. Build model-level `/products/*` pages with the ProductDetailPage template.

## Amendment 2026-07-12 — Spec sourcing display policy

Owner-approved amendment to §3's `SourcedSpecTable`. This supersedes the
customer-facing rendering described above; it does NOT relax the data model or
its tests.

- **Traceability stays mandatory in the DATA MODULE.** Every spec entry in
  `src/data/probeStations/semishare.ts` still carries a required
  `source: { url, capturedOn }` (Constraint 3), and this remains test-enforced
  (§6 — `source.url` parses, host is `semishareprober.com`/`www.semishareprober.com`,
  `capturedOn` present). Provenance is retained internally for audit and for the
  official-datasheet re-verification follow-up.
- **`SourcedSpecTable` no longer renders per-row source annotations
  customer-facing.** The table renders Specification / Value columns plus the
  OEM-confirmation disclaimer only ("Specifications from manufacturer public
  materials; subject to OEM confirmation"). No per-row source URL or capture date
  is shown to visitors.
- **Zero outbound `semishareprober.com` links on the brand page is a tested
  contract.** `SemishareBrandPage.test.tsx` asserts the rendered page emits no
  anchor to the manufacturer domain; the removal of per-row Reference links is
  enforced, not incidental.
- **Rationale:** funnel protection (per-row OEM links leaked visitors to the
  manufacturer around our procurement funnel) and authority perception (the page
  presents NineScrolls as the integrator of record, not a link farm to the OEM).
