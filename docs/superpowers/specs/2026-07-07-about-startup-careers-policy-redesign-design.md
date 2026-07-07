# About, Startup, Careers, and Policy Redesign Design

Date: 2026-07-07
Status: Draft for review

## Goal

Bring the remaining company, startup-package, recruiting, and policy pages into the new NineScrolls redesign language without changing route contracts, conversion modals, legal meaning, or analytics assumptions.

This phase covers:

- `/about`
- `/startup-package`
- `/careers`
- `/privacy`
- `/return-policy`

The goal is not to add new product funnels. It is to remove the visual discontinuity between the redesigned product/conversion system and these still-legacy support pages, while fixing customer-facing copy that no longer fits the NineScrolls brand posture.

## Non-Goals

- Do not redesign Insights, News, admin, product detail pages, cart, checkout, RFQ, contact, or service/support in this phase.
- Do not rename routes.
- Do not add new modals, checkout mechanics, lead-capture APIs, or form fields.
- Do not change legal meaning on `/privacy` or `/return-policy`.
- Do not disclose OEM, manufacturing partner, supplier-chain, distributor, or exclusive-representative relationships on customer-facing pages.
- Do not introduce unsupported competitive claims or unverifiable scale claims.
- Do not create a broad design-system sprint. Reuse existing `src/components/conversion/` primitives where they fit, and add only narrow page-local helpers if necessary.
- Do not invent warranty, installation, training, delivery, or customer-count claims.

## Design Brief

Product:

- NineScrolls is a U.S.-based scientific and semiconductor equipment company serving universities, national laboratories, and research teams.

Visual source:

- Match the already-merged high-fidelity redesign language: Precision White with restrained slate borders, sky-blue accent, compact engineering copy, and dark CTA bands where useful.
- Use the product-detail and conversion-chain pages as the primary design references.

Interactivity:

- Full interactivity for existing controls:
  - Startup Package quote modal opens and closes.
  - Startup Package download gate opens and closes.
  - Existing links continue to route correctly.
  - Mailto links remain functional.
- Static visual polish for policy content; no new interactive policy UI.

## Page Roles

### About

Role: company trust page for institutional buyers and research teams.

Current issues:

- Uses older `hero-gradient` and legacy card language.
- Contains customer-facing manufacturing-partner disclosure:
  - `Engineering & Manufacturing Partner`
  - `Tyloong Semiconductor Equipment`
  - `exclusive U.S. representative`
- Contains scale metrics that are not part of the current verified redesign evidence set:
  - `30+`
  - `1,000+`
  - `6+`
- Contains prose scale wording tied to the OEM disclosure:
  - `over three decades`
  - `Systems Installed Globally`
- Brand-story copy is long and somewhat detached from the engineering buyer journey.

Design direction:

- Reposition as a concise, credible company page:
  - U.S.-based scientific equipment supplier.
  - Engineering-led configuration support.
  - Plasma processing and thin-film equipment focus.
  - Procurement-ready support for universities, labs, and semiconductor innovators.
- Use a clean hero with direct positioning:
  - Suggested H1: `U.S.-based support for advanced semiconductor process equipment`
  - Supporting copy should emphasize equipment selection, process fit, procurement support, and post-sale coordination.
- Replace the manufacturing-partner section with a customer-facing operating model section:
  - `Application-first equipment selection`
  - `Configuration and quotation support`
  - `Delivery and installation coordination`
  - `Post-sale service and warranty support`
- Keep procurement credibility where already present:
  - San Diego, California.
  - D-U-N-S number.
  - UEI number.
  - Government/institutional procurement readiness.
- Keep the brand story, but compress it:
  - One restrained section about order, precision, and engineering.
  - Do not let the mythology/story section dominate the page.
- End with a dark or high-contrast CTA:
  - `Explore Equipment`
  - `Talk to an Engineer`

Copy constraints:

- Must not contain `Tyloong`, `exclusive U.S. representative`, `manufacturing partner`, `supplier-provided`, `distributor`, or equivalent OEM-chain wording.
- Must not contain unsupported global-scale metrics such as `1,000+ systems`, `30+ years`, or customer counts unless separately verified before implementation.
- Must not claim NineScrolls manufactures every product in-house.

Schema:

- Keep `AboutPage` + `Organization` JSON-LD.
- Update schema copy to match the new customer-facing positioning.
- Do not include OEM partner names in JSON-LD.

### Startup Package

Role: conversion page for new PIs, new labs, and startup-funded semiconductor/materials research groups.

Current issues:

- Older visual language.
- Dated badge: `STARTUP PACKAGE 2025`.
- Existing copy includes unsupported or imprecise claims:
  - `2–3 years warranty plus free installation and training`
  - `Over 300 research institutions worldwide trust NineScrolls systems`
  - `Fast Delivery & Setup`
- The page has real conversion mechanics:
  - `QuoteModal`
  - `DownloadGateModal`
  - downloadable equipment guide

Resolved policy/copy inputs:

- The user previously confirmed the standard warranty is 2 years across product lines.
- The redesign may say `2-year standard warranty`.
- Do not say `2–3 years warranty`.
- Do not say `free installation and training` unless the user later confirms a specific program policy.
- Do not say `300+ institutions` or similar unverified customer-count claims.

Design direction:

- Treat this as a compact B2B landing page, not a generic marketing page.
- Suggested H1: `Startup lab equipment packages for new research programs`
- Position the offer around:
  - equipment selection for new labs
  - budgetary quote support
  - startup-funding/procurement context
  - compatible platform bundles
  - 2-year standard warranty
  - configuration review with an engineer
- Replace the benefit cards with verified, non-overpromising benefits:
  - `Startup-aware configuration`
  - `Budgetary quote support`
  - `2-year standard warranty`
  - `Equipment bundles for process workflows`
- Keep product cards for:
  - ICP-RIE / RIE
  - PECVD / ALD
  - Coater / Developer
- Optional additional cards may link to:
  - Sputter
  - Plasma Cleaner
  only if the layout remains focused and the copy stays concise.
- Keep primary CTA:
  - `Request Startup Package Quote`
- Keep secondary CTA:
  - `Download Equipment Guide`
- Keep the final CTA, but remove unsupported institution-count claims.

Functional constraints:

- `QuoteModal` must still open from hero and final CTA.
- `DownloadGateModal` must still open from the guide CTA.
- `DownloadGateModal` must preserve:
  - `fileUrl="/NineScrolls-Equipment-Guide.pdf"`
  - `fileName="NineScrolls-Equipment-Guide.pdf"`
  - Turnstile site key wiring.
- `QuoteModal` must preserve the existing `onDownloadBrochure` behavior.
- Do not change routes, modal APIs, or file paths.

Schema:

- Keep `WebPage`, `Service`, and product graph structure if still appropriate.
- Update descriptions to remove unsupported claims.
- Do not put `extended warranty` or `free installation/training` in JSON-LD.
- Use `2-year standard warranty` only as visible copy and schema description if the implementation keeps warranty copy in schema.

### Careers

Role: lightweight recruiting page for potential sales, applications, and service hires.

Current issues:

- Older visual language.
- Role cards use strong hover inversion and feel unlike the redesigned site.
- CTA uses old gradient language.

Design direction:

- Keep the page simple and credible.
- Suggested H1: `Build the next generation of scientific equipment support`
- Keep the three anticipated roles:
  - Sales Representative
  - Applications / Pre-Sales Engineer
  - Field Service / After-Sales Engineer
- Keep San Diego and travel/location context.
- Use a restrained card list, not interactive job-board chrome.
- Keep `careers@ninescrolls.com` as the primary application CTA.
- Keep links to `/about` and `/products`.

Copy constraints:

- Avoid overclaiming company scale.
- Avoid `vanguard`-style consumer-startup rhetoric if it feels less credible than the new B2B equipment voice.
- Preserve the fact that roles are anticipated/current growth roles, not guaranteed open requisitions, unless the implementation confirms exact openings.

Schema:

- Keep `WebPage` + `Organization` schema.
- Do not add `JobPosting` schema unless exact job postings, salaries, locations, and application requirements are verified.

### Privacy

Role: policy page.

Design direction:

- Visual polish only.
- Preserve legal text meaning.
- Use the new site shell:
  - quiet page hero
  - constrained content width
  - readable section rhythm
  - slate borders or subtle background where useful
- Keep `privacy@ninescrolls.com` links.
- Keep last-updated date unless the user explicitly changes legal policy.

Content constraints:

- Do not rewrite policy substance.
- Minor copy-formatting changes are allowed only if meaning is identical.
- Do not add marketing CTAs that could distract from policy intent.

SEO:

- Keep `/privacy` route and SEO title.
- Keep `index, follow` unless explicitly changed by the user.

### Return Policy

Role: policy page for returns, exchanges, RMA, and support-first resolution.

Design direction:

- Visual polish only.
- Preserve policy meaning.
- Use the same policy shell as `/privacy`.
- Make sections easier to scan without changing legal obligations.
- Keep `support@ninescrolls.com`.
- Keep effective date.

Content constraints:

- Do not change eligibility rules, reporting window, RMA requirements, refund exclusions, governing law, or support-first language.
- Do not add marketing claims.
- Do not rewrite policy substance except for formatting and equivalent clarity.

SEO:

- Keep `/return-policy` route and SEO title.
- Keep `index, follow` unless explicitly changed by the user.

## Shared Visual System

Use existing primitives first:

- `ConversionHero`
- `ConversionCard`
- `TrustSignalList`
- `FormSection`

If these are insufficient, prefer small page-local arrays and simple Tailwind layouts. Do not expand `src/components/conversion/` unless at least two pages benefit from the same primitive.

Visual language:

- Background: `#FAFAFA` or existing near-white page background.
- Cards: white, slate border, restrained radius.
- Accent: sky/primary blue used sparingly.
- Typography: match product/conversion pages.
- Buttons: compact, engineering-B2B style; avoid large pill-heavy consumer styling.
- No gradient-orb, particle, decorative SVG, or purely atmospheric effects.

## Accessibility Requirements

- Preserve semantic `<main>`, `<section>`, `h1`, `h2`, `h3` hierarchy.
- Buttons that open modals must remain `<button>` elements.
- Links that navigate must remain `<Link>` or `<a>`.
- Modal trigger labels must be descriptive.
- Policy pages should have readable line length and clear section headings.
- Do not rely on color-only hover states for role cards or CTA affordances.

## Testing Requirements

### About

Add or update tests that verify:

1. The page renders the new H1.
2. Customer-facing OEM-chain wording is absent:
   - `Tyloong`
   - `exclusive U.S. representative`
   - `manufacturing partner`
   - `supplier-provided`
   - `distributor`
3. Unsupported scale metrics from the old page are absent:
   - `1,000+`
   - `30+`
   - `6+`
   - `over three decades`
   - `three decades`
   - `Systems Installed Globally`
   - `Installed Globally`
4. Procurement identifiers still render:
   - D-U-N-S number
   - UEI number
5. Primary CTA links to `/products` and secondary CTA links to `/contact` or `/request-quote`.
6. Organization JSON-LD remains present and contains no OEM-chain wording.

### Startup Package

Add or update tests that verify:

1. The page renders the new H1.
2. Old unsupported claims are absent:
   - `2–3 years warranty`
   - `free installation and training`
   - `300 research institutions`
   - `STARTUP PACKAGE 2025`
3. Verified warranty copy uses `2-year standard warranty`.
4. Hero quote CTA opens `QuoteModal`.
5. Guide CTA opens `DownloadGateModal`.
6. The equipment guide path remains `/NineScrolls-Equipment-Guide.pdf`.
7. Product links for ICP-RIE/RIE, PECVD/ALD, and Coater/Developer remain valid.
8. JSON-LD descriptions contain no unsupported old claims.

### Careers

Add or update tests that verify:

1. The page renders the new H1.
2. The three role titles remain visible.
3. The mailto CTA points to `mailto:careers@ninescrolls.com`.
4. Links to `/about` and `/products` remain present.
5. No `JobPosting` JSON-LD is emitted.

### Privacy

Add or update tests that verify:

1. `Privacy Policy` H1 remains visible.
2. `Last updated: September 14, 2025` remains visible.
3. `privacy@ninescrolls.com` remains visible and linked.
4. Core legal section headings remain visible.

### Return Policy

Add or update tests that verify:

1. `Return Policy` H1 remains visible.
2. `Effective Date: January 14, 2025` remains visible.
3. `support@ninescrolls.com` remains visible and linked.
4. Core legal section headings remain visible.
5. The `7 days of delivery` reporting window remains visible.

### Regression Commands

Run:

```bash
npm test -- src/pages/AboutPage.test.tsx src/pages/StartupPackagePage.test.tsx src/pages/CareersPage.test.tsx src/pages/PrivacyPage.test.tsx src/pages/ReturnPolicyPage.test.tsx --run
npx tsc --noEmit --pretty false
npm run build
```

Expected:

- Page tests pass.
- TypeScript exits 0.
- Build exits 0. Existing chunk-size warnings are acceptable if there are no new errors.

## Risks

- About copy could become too generic if all manufacturing context is removed. Mitigation: replace supplier-chain detail with concrete customer-facing responsibilities and procurement identifiers.
- Startup Package could overpromise if benefits are written like promotions rather than quote-review terms. Mitigation: use quote-support and configuration language, keep verified 2-year warranty, and avoid free/fast/global-count claims.
- Policy pages could accidentally change legal meaning during visual polish. Mitigation: tests lock dates, support emails, reporting window, and section headings; implementation should preserve policy text with minimal formatting changes.
- Careers could imply active openings when roles are only anticipated. Mitigation: keep `anticipated roles` framing unless exact openings are verified.

## Review Checklist

- About contains no customer-facing OEM/supplier-chain disclosure.
- Startup Package preserves both modals and guide download behavior.
- Startup Package contains no unsupported warranty, installation, training, delivery, or institution-count claims.
- Careers keeps role content and careers email.
- Privacy and Return Policy preserve legal meaning.
- Design language matches product/conversion pages.
- Tests cover both removed-risk copy and preserved functional/legal contracts.
