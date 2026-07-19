# Evidence Framework Phase 2 — Product-page publications (design)

- **Date:** 2026-07-18
- **Status:** Approved (design). Ready for implementation planning.
- **Depends on:** Phase 1 (`2026-07-04-evidence-framework-design.md`), attribution rules from `2026-07-09-research-validation-claim-reframe-design.md`.
- **Prod state today:** ~49 `publication`-type Evidence records exist as `status: draft` (seeded via PR #284 + #288), all hidden. `meta.launchEligible === true` on 35 of them (tier A AND non-incidental), set by `scripts/classify-evidence-publish-priority.ts`.

## Goal

Make the collected peer-reviewed research **visible on product detail pages** as an actual list of publications (title · journal/year · source link), not merely a count. Ship in two decoupled stages so breadth of disclosure is not blocked on per-record copy review:

- **Stage 2a (ship immediately):** publish the 35 launch-eligible records and upgrade the product module to list them **without** a science summary (treatment "A"). Zero render-time OEM-leak surface; no human copy-audit on the critical path.
- **Stage 2b (iterate, page-by-page):** add an attribution-safe one-line science summary (`meta.publicSummary`) per record via an LLM-assisted, human-reviewed rewrite pass; the module renders it automatically wherever present (treatment "B" cards with a highlighted journal badge).

The module is **data-driven**: a record with `publicSummary` renders as B, one without renders as A. A page upgrades A→B on its own as summaries land — no mode flag, no page config. The data is the single source of truth.

## Non-goals (explicitly out of scope)

- The Evidence Center **hub page** and the `Resources` nav entry (spec P2/P4; deferred).
- Any **public Evidence detail page** (`slug` remains reserved; no detail route).
- Publishing **tier-B** (7) or **incidental** records. Launch-eligible = tier A AND non-incidental by definition, so the "tier-B verbatim re-quote before publish" task in `scripts/README-evidence-seeders.md` **does not trigger** for this phase.
- The homepage / ProductsPage "Research Validation" **copy reframe** itself (its own plan, `2026-07-09-...`). We consume its attribution *rules* but do not change that copy here. (Verify it does not read live evidence counts; if it does, revisit.)
- Client-facing search / filter over evidence; product→evidence GSI (not needed until ~100–200 records).

## Attribution rules (hard constraints, from the 2026-07-09 reframe spec)

Every customer-facing surface produced here MUST:

1. Frame papers as validation for **"the [process] platform we represent"** — never as NineScrolls installed-base citations.
2. Never expose the OEM/supplier **name** (Tailong / Beijing Zhongke Tailong / 中科泰龙 / Nano-Promiso / Shanghai Peiyuan / etc.).
3. Never expose the internal **model/instrument string** (`ICP-100A`, `RIE-100`, `PECVD-150LL`, `STRIPER-100`, `ICP-S-150`, `HighThroughput100-6A`, …). Rationale: model + publication-year is a side-channel — a reader can reverse-search the paper and identify the OEM, defeating the server-side filtering. Describe the *structure/capability* the tool produced, not the model code.
4. No bare "Nature" / unsourced "500+" style claims. Counts shown must be real and sourced (they are — one per published record).

`meta` retains the OEM name, legal name, instrument string, and verbatim verification quote **for internal audit only**. These fields never reach an anonymous caller (see §2).

## Detailed design

### §1 — Publish set & mechanism (Stage 2a)

- **Set:** all records where `meta.launchEligible === true` (35). Deterministic, already classified. Tier-B and incidental stay `draft`.
- **Mechanism:** a new idempotent, `--apply`-gated script (e.g. `scripts/publish-launch-eligible-evidence.ts`) reusing the `scripts/lib/evidenceSeedOperations.ts` patterns (checked raw GraphQL, auth via `scripts/lib/auth`, `requireApply`). It:
  1. Lists all `publication` records (paginated, same as the classifier).
  2. Selects those with `meta.launchEligible === true` and `status !== 'published'`.
  3. Sets `status: 'published'` and stamps `publishDate` (the raw-GraphQL path must set `publishDate` explicitly — the auto-stamp in `evidenceAdminService.updateEvidence` is not in this path).
  4. Prints a dry-run summary (counts per product line) by default; writes only under `--apply`.
  5. Is convergent (already-published records are skipped) and reversible (re-runnable; a symmetric `--unpublish`/manual draft flip backs it out).
- **Post-publish:** run `scripts/verify-evidence-boundary.ts` to re-confirm the no-leak boundary (base-table apiKey read denied; `listPublishedEvidence` returns published-only).

### §2 — Public payload whitelist projection (Stage 2a, **hard security requirement**)

Today `listPublishedEvidence` (`amplify/functions/evidence-api/handler.ts`, wired at `amplify/data/resource.ts:1105-1116`) returns **full DynamoDB items including `meta`** to anonymous (`apiKey`) callers — the OEM name and instrument string are in that payload even though the current UI does not render them.

Change the Lambda to return a **whitelisted projection** per record, assembled explicitly:

```
{
  id,                 // uuid — safe; used as React key
  type,               // 'publication'
  title,              // real published paper title — public/safe
  sourceUrl,          // https://doi.org/… — the DOI link
  publishDate,
  products,           // e.g. ['icp-etcher'] — page-safe slugs
  journal,            // pulled from meta
  year,               // pulled from meta
  doi,                // pulled from meta
  publicSummary?,     // pulled from meta, only when present (Stage 2b)
}
```

Fields deliberately **omitted / never returned:**

- **`slug`** — contains the OEM name and model string (`pub-tailong-icp100a-…`). Must not leave the backend.
- The entire raw `meta` blob. Only the four safe sub-fields above are hoisted out; `manufacturerAsNamed`, `instrumentAsNamed`, `manufacturerLegalName`, `verification`, `relationshipDisclosure`, `sourceCategory`, `instrumentRefinedFrom`, `instrumentRefinedVia`, `verificationTier`, `capabilityRole`, `launchEligible`, `publishPriority`, `verifiedAt`, etc. are dropped.

The projection is applied server-side after the Scan+filter, before returning. The `#status = :published` (+ optional `contains(products, :slug)`) filter is unchanged.

### §3 — Product module (data-driven A→B render)

`src/components/products/ProductEvidence.tsx` (rendered at `ProductDetailPage.tsx:277`, fed by `src/services/evidenceService.ts` → `listPublishedEvidence({ productSlug }, { authMode: 'apiKey' })`) changes from **counts-only** to a **publication list**:

- **Section:** eyebrow "Research validation" + heading "Peer-reviewed research", intro line `Published work using the {platform} we represent · {N} papers`. Represented-platform framing; the `{platform}` label comes from product config, not the record. Auto-hides at `N === 0` (unchanged behavior).
- **Per record (card):**
  - Title (the real paper title).
  - `Journal · Year`, with a **highlighted short badge** (e.g. `LSA 2025`, `LPR 2024`) when the journal is in a curated abbreviation map; otherwise the full journal name, no badge. The abbreviation map is a small explicit lookup — no fabricated abbreviations.
  - Source link (`sourceUrl`, "View source ↗" / "DOI ↗").
  - **If `publicSummary` is present**, render it as the one-line science summary (treatment B). If absent, omit that line (treatment A). This is the automatic per-record A→B upgrade.
- **Long lists:** show the first N (e.g. 5) with a "Show all {N}" expander.
- Keep the existing zero-state (`return null`) and the `countEvidenceByType` helper available for any future non-`publication` evidence types, but `publication` records now render as the list rather than a count.
- Fetch path already returns full records as JSON; after §2 it returns the whitelisted shape. `evidenceService` still tolerates JSON-string-or-array and returns `[]` on error (unchanged).

### §4 — Attribution-safe summaries (Stage 2b)

- **Field:** `meta.publicSummary` (string). Written by an idempotent, `--apply`-gated rewrite script (same lib patterns), one entry per record, updating `meta` non-destructively (like the classifier / refiner).
- **Authoring:** LLM-assisted draft → **mandatory human review** → stored. Rules per §"Attribution rules": represented-platform framing, no OEM name, no model/instrument string, describe structure/capability. Example: *"Silicon-nanopillar metasurfaces dry-etched to enable non-invasive 2D visualization of transparent flow fields."*
- **Rollout:** page-by-page. Review + write the ICP set (~22) first → that page auto-upgrades to B; then RIE, etc. No frontend change needed per page — driven entirely by data presence.

### §5 — Verification & banned-words defense-in-depth

- **No-leak boundary:** reuse `scripts/verify-evidence-boundary.ts`. Add an assertion to `amplify/functions/evidence-api/handler.test.ts` that the returned projection contains only the whitelisted keys and **omits** `slug` and every OEM `meta` field.
- **Banned-words static scan (last line of defense):** a script/test that runs over the **actual public payload** (what `listPublishedEvidence` returns for anonymous callers) and fails if any banned token appears anywhere. The blacklist includes:
  - OEM brand + legal names and their abbreviations: `Tailong`, `Beijing Zhongke Tailong`, `中科泰龙`, `泰龙`, `Nano-Promiso`, `Shanghai Peiyuan`, `Anxing Tailong`, …
  - The internal **model/series numbers**: `ICP-100A`, `ICP-100`, `ICP-200`, `ICP-S-150`, `ICP-M-100`, `ICP-PECVD-150`, `ICP-I`, `RIE-100`, `RIE-150`, `RIE-150A`, `RIE-100M`, `STRIPER-100`, `PECVD-150LL`, `Sputter 100`, `HighThroughput100-6A`, …
  - Pattern is modeled on the existing SEMISHARE `bannedContent.ts` static-scan approach.
  This catches a `slug` leak, a `meta` leak, or a `publicSummary` that slipped an OEM/model reference past human review.
- **Browser verification:** after 2a, drive the ICP Etcher product page in the preview and confirm the list renders (title/journal/DOI, no summary) and no banned token appears in the network response. After a 2b page upgrade, confirm the summary line renders.

## Public payload contract (summary)

Anonymous `listPublishedEvidence(productSlug)` returns `Array<{ id, type, title, sourceUrl, publishDate, products, journal, year, doi, publicSummary? }>` — published-only, product-filtered, OEM-free. No `slug`, no raw `meta`.

## Rollout sequence

1. §2 Lambda whitelist projection + tests (must land before/with any publish so the list path is OEM-free at the network layer).
2. §3 module A-render.
3. §5 banned-words scan wired into verification.
4. §1 publish the 35 launch-eligible (dry-run → `--apply`) → boundary re-verify → browser-verify ICP page.
5. §4 Stage 2b: per-page `publicSummary` review/write → auto B-upgrade.

Stages 1–4 are the immediately-shippable unit ("tonight"). Stage 5 iterates.

## Risks / open items

- **Journal abbreviation map** is a small curated lookup; unmapped journals simply show full name (no badge) — acceptable, no fabrication.
- **`platform` label** per product line must be pre-agreed represented-platform wording (e.g. "the ICP etching platform we represent"); sourced from product config, reused across the page.
- **Homepage reframe coupling:** confirm the homepage "Research Validation" section does not read live evidence counts before publishing, else publishing could change that copy unexpectedly.
- **`publishDate` semantics** on the raw-GraphQL publish path must match the admin path (ISO date string).
