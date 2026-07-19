# Evidence seeders — Tailong `publication` records

Reproducible scripts that seed peer-reviewed `publication`-type `Evidence` records
into DynamoDB as **`status: draft`** (hidden from the public `listPublishedEvidence`
Lambda until explicitly published). Most records document a paper that used
**Tailong Electronics / Beijing Zhongke Tailong Electronic Technology** (北京中科泰龙 /
芯微诺达 / Nano-Promiso) process equipment — NineScrolls is the authorized distributor
of this platform, so each `meta.relationshipDisclosure` states that honestly.

The one exception is the **e-beam / MEB-600 batch** (`seed-evidence-ebeam.ts`):
MEB-600 is NineScrolls's **own** product model, not an OEM instrument string, so
those records carry no `manufacturerAsNamed`/`instrumentAsNamed`/`relationshipDisclosure`
keys (MEB-600 provenance lives in a non-sensitive `meta.platform` key + free-text
`verification`), and MEB-600 is deliberately **not** a `bannedOem` token.

## Prerequisites

1. `amplify_outputs.json` in repo root (not tracked), containing the target
   GraphQL endpoint and Cognito settings. If it is missing or stale, regenerate it:
   `npx ampx generate outputs --app-id d244ebmxcttcdz --branch main`. Evidence
   model introspection is not required because every command below uses checked
   **raw GraphQL** (`client.graphql`) against the deployed schema.
2. Admin Cognito creds in `.env`: `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

These scripts write to the backend named by `amplify_outputs.json` (currently
production). Verify that file before running. Every new mutating script requires
an explicit `--apply` argument and rejects unknown arguments.

## Run

```bash
set -a; source .env; set +a
npx tsx scripts/seed-evidence.ts --apply          # 2  — first ICP-100A drafts (merged in #284)
npx tsx scripts/seed-evidence-spotlights.ts --apply       # 5  — Publication Spotlight articles
npx tsx scripts/seed-evidence-catalog.ts --apply          # 24 — vetted internal citation catalog
npx tsx scripts/correct-evidence-false-positives.ts --apply # archive 2 records from older runs
npx tsx scripts/seed-evidence-scholar-verified.ts --apply # 12 new + 3 refinements
npx tsx scripts/seed-evidence-fulltext.ts --apply         # 6 new + 1 refinement
npx tsx scripts/seed-evidence-ebeam.ts --apply            # 3  — MEB-600 (own model): 2 DOI-verified + 1 held
npx tsx scripts/classify-evidence-publish-priority.ts --apply # classify only explicit known slugs
```

Create steps are **duplicate-safe by slug**: an existing record is skipped and
left untouched. Refinements, the false-positive correction, and the classifier
are deterministically convergent and skip records already at the desired state.
The classifier preflights all active publications and aborts before any write if
it encounters a slug not in its explicit classification table.

## What each seeds & its verification tier

| Script | Count | Source / verification tier |
|---|---|---|
| `seed-evidence.ts` | 2 | ICP-100A papers, full-text-verified quotes (PhotoniX 2022, Nanomaterials 2020) |
| `seed-evidence-spotlights.ts` | 5 | Our own DynamoDB **"Publication Spotlight"** insight articles; instrument quoted verbatim from article bodies (written from full text) |
| `seed-evidence-catalog.ts` | 24 | Vetted internal catalog `泰龙电子产品Google_Scholar引用文献统计.md`; **DOIs Crossref-verified**; verbatim full-text re-quote recommended before publish |
| `seed-evidence-scholar-verified.ts` | 12 (+3 refine) | Google Scholar re-verification: 11 verbatim visible snippets + 1 catalog/index lead explicitly held at tier B for re-quote; DOIs Crossref-verified |
| `seed-evidence-fulltext.ts` | 6 (+1 refine) | 5 open-access/author-PDF full-text quotes + 1 search-index snippet explicitly held at tier B for PDF re-quote |
| `seed-evidence-ebeam.ts` | 3 | MEB-600 (NineScrolls's own model) evaporation papers migrated from the `eBeamEvaporatorConfig` static block. P1 Wan 2024 (DOI Crossref-verified) + P2 Luo 2023 (DOI resolves via doi.org; CSTM registrar, not in Crossref) = tier A, launch-eligible; P3 Su 2025 has no resolvable DOI/URL → held at tier B (no `sourceUrl`) until a source is supplied |

`meta` per record holds: `manufacturerAsNamed`, `instrumentAsNamed`, `journal`,
`year`, `doi`, `relationshipDisclosure`, `verifiedAt`, `verification` (source and,
when captured, a verbatim quote). Tier B marks records still requiring re-quote.
**No dynamic "cited-by" counts are stored** (they change over time).

## Deliberately NOT seeded (documented for future reference)

- **Gas-supplier papers** — atmospheric-chemistry papers where "Beijing Tailong
  Electronics **Company**" supplied N₂/O₂ (not equipment).
- **RFG-500 RF-power** papers (incl. a 900+-cited graphene-foam paper) — RFG-500 is
  an RF power supply, not a NineScrolls SKU.
- **"Nano-Promiso" SERS/biomedical cluster** — a **false positive**: full-text checks
  showed those papers (Institute of Microelectronics, CAS) use in-house tools
  "ICP-300" / "DZS500", **not Tailong**.
- **Electrocatalysis cluster** — Tailong appears only as an argon **gas** supplier, or
  the papers use no deposition/etch equipment.
- **Paywalled/source-limited records** — five remaining catalog records, the PET
  nanotemplate catalog/index record, and the RIE-100 infrared-source search-index
  snippet are retained explicitly at tier B without a captured full-text quote.
  None is publish-eligible until its instrument string is re-quoted. Other
  source-limited leads without enough catalog evidence remain unseeded.
- **ALD 光子学报 "T-ALD-100A"** paper — Chinese-journal DOI unresolved.
- **Two catalog records ARCHIVED as false positives** (caught by the full-text
  re-quote pass, 2026-07-13): `sputter-cu-nanotwin-mi-2024` (uses a non-Tailong
  "VCT 300" sputter) and `sputter-wo3-sensor-sensors-2025` ("Tailong" there is a
  **gas supplier**, "Anxing Tailong Gas Chemical", ≠ Beijing Zhongke Tailong).
  `correct-evidence-false-positives.ts` repeatably converges any records from
  older runs to `status: archived` with a checked `meta.removedReason`.
- **Three legacy tail slugs** appeared only as classifier keys in repository
  history; no titles, DOIs, or provenance payloads exist in the reproducible
  seeders. They are excluded rather than reconstructed from invented data. If
  still active in a target backend, classifier preflight intentionally reports
  them as unknown and performs no writes pending separate evidence adjudication.

## Reproducible result

The clean sequence above creates **52 active Evidence records**, all
`status: draft`. On older backends, the correction step may additionally retain
2 archived false-positive records. No-leak boundary holds: the anonymous
`listPublishedEvidence` (apiKey) query returns 0 records. Reproducible publication
coverage by product (active): `rie-etcher` 20 ·
`icp-etcher` 22 · `pecvd` 7 · `sputter` 3 · `e-beam-evaporator` 3 · `ibe-ribe` 1 ·
`striper` 1 (7 product lines; `ald` 0). Tailong models observed: ICP-100A/100/200,
ICP-S-150, ICP-PECVD-150, ICP-I, RIE-100/150/150A/100M, STRIPER-100, PECVD-150LL,
Sputter 100, HighThroughput100-6A.

## Phase-2 publish gating (`classify-evidence-publish-priority.ts`)

Every publication record carries four `meta` fields so Phase 2 can mechanically
select what to publish — **being "verified" alone is NOT enough to auto-publish**:

| field | values | meaning |
|---|---|---|
| `verificationTier` | `A` / `B` | `A` = verbatim instrument quote captured; `B` = DOI+catalog, awaiting full-text re-quote |
| `capabilityRole` | `primary` / `substantial` / `incidental` | how central the Tailong tool is to the paper's result |
| `launchEligible` | boolean | **hard gate** = `tier A` AND `capabilityRole != incidental` AND **not** a conference proceedings |
| `venueType` | `conference` (or absent ⇒ journal) | stamped on records in the classifier's `PROCEEDINGS` set; self-describes the venue axis (internal-only, never in the public projection) |
| `publishPriority` | `wave1` / `wave2` / `wave3` | `wave1` = 6 hero papers (rie/icp/pecvd/sputter); `wave2` = rest of launch-eligible; `wave3` = held (B-tier re-quote, incidental, snippet-tier, conference proceedings) |

**Conference proceedings (policy, 2026-07-18):** the product-page "Peer-reviewed
research" list is for journal-grade evidence, so conference/proceedings papers are
**excluded from launch-eligibility by default**, regardless of tier/role — a
discerning academic/industry reader weighs proceedings far below journal articles,
and mixing them in would dilute the framework's high credibility bar. Any
proceedings record MUST be listed in the classifier's `PROCEEDINGS` set (forces
`launchEligible: false`, `wave3`, `venueType: 'conference'`). Promoting a strong,
on-topic proceedings paper is a deliberate case-by-case exception (remove it from
that set). Today one such record exists: `pub-tailong-sputter-tio2-cuox-robots-raits-2026`
(IEEE RAITS 2026 — a robotics/intelligent-transportation venue, off-topic for a
sputter thin-film capability showcase).

Current reproducible split (52 active records): wave1 **6** · wave2 **30** ·
wave3 **16**; tier A **44** / B **8**; launchEligible **36**.
`ibe-ribe`, `striper`, `ald` have **no** launch-eligible record →
their product pages show no Evidence module at launch (by design — "no strong evidence,
don't show" beats forcing coverage with an incidental-use paper). "One record per product
line" is a **soft** goal; tier-A + non-incidental are the **hard** gates. Re-run anytime
(deterministically convergent; unknown active publication slugs abort before writes).

## Before publishing (Phase 2)

- Do a verbatim full-text instrument-string re-quote pass on the tier-B catalog,
  Scholar/index, and search-index records. Spotlights and tier-A Scholar/full-text
  records already carry their captured quote provenance.
- Confirm no product **page** displays a live aggregate citation count.
