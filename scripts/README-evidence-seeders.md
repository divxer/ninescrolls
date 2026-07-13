# Evidence seeders — Tailong `publication` records

Reproducible scripts that seed peer-reviewed `publication`-type `Evidence` records
into DynamoDB as **`status: draft`** (hidden from the public `listPublishedEvidence`
Lambda until explicitly published). Every record documents a paper that used
**Tailong Electronics / Beijing Zhongke Tailong Electronic Technology** (北京中科泰龙 /
芯微诺达 / Nano-Promiso) process equipment — NineScrolls is the authorized distributor
of this platform, so each `meta.relationshipDisclosure` states that honestly.

## Prerequisites

1. `amplify_outputs.json` in repo root (not tracked). Points at the prod backend
   (user pool `us-east-2_3AE21gHBg`). NOTE: the local copy's model introspection
   does **not** include the `Evidence` model, so these scripts use **raw GraphQL**
   (`client.graphql`) against the deployed schema rather than the typed client.
2. Admin Cognito creds in `.env`: `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Run

```bash
set -a; source .env; set +a
npx tsx scripts/seed-evidence.ts                  # 2  — first ICP-100A drafts (merged in #284)
npx tsx scripts/seed-evidence-spotlights.ts       # 5  — Publication Spotlight articles
npx tsx scripts/seed-evidence-catalog.ts          # 26 — internal Tailong citation catalog
npx tsx scripts/seed-evidence-scholar-verified.ts # 12 new + 3 refinements
npx tsx scripts/seed-evidence-fulltext.ts         # 6 new + 1 refinement
```

All scripts are **idempotent** (skip a slug that already exists via
`listEvidenceBySlug`), so re-running is safe.

## What each seeds & its verification tier

| Script | Count | Source / verification tier |
|---|---|---|
| `seed-evidence.ts` | 2 | ICP-100A papers, full-text-verified quotes (PhotoniX 2022, Nanomaterials 2020) |
| `seed-evidence-spotlights.ts` | 5 | Our own DynamoDB **"Publication Spotlight"** insight articles; instrument quoted verbatim from article bodies (written from full text) |
| `seed-evidence-catalog.ts` | 26 | Internal catalog `泰龙电子产品Google_Scholar引用文献统计.md`; **DOIs Crossref-verified**; verbatim full-text re-quote recommended before publish |
| `seed-evidence-scholar-verified.ts` | 12 (+3 refine) | Google Scholar re-verification (keyword "Tailong Electronics"); **verbatim Scholar snippet** stored in `meta.verification`; DOIs Crossref-verified |
| `seed-evidence-fulltext.ts` | 6 (+1 refine) | Exhaustive full-text pass (open-access PDFs / PMC / Nature Protocols); each has a verbatim quote from full text |

`meta` per record holds: `manufacturerAsNamed`, `instrumentAsNamed`, `journal`,
`year`, `doi`, `relationshipDisclosure`, `verifiedAt`, `verification` (source +
quote). **No dynamic "cited-by" counts are stored** (they change over time).

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
- **~11 paywalled papers** — genuine leads whose Methods sections are behind hard
  paywalls (ACS / Elsevier / Wiley-Cloudflare / IEEE); not seeded without a
  full-text read.
- **ALD 光子学报 "T-ALD-100A"** paper — Chinese-journal DOI unresolved.

## Result (verified 2026-07-13)

**54 Evidence records, all `status: draft`.** No-leak boundary holds: the anonymous
`listPublishedEvidence` (apiKey) query returns 0 records. Publication coverage by
product: `rie-etcher` 23 · `icp-etcher` 22 · `pecvd` 7 · `sputter` 5 · `ibe-ribe` 1
· `striper` 1 (6 product lines; `ald` 0). Tailong models observed: ICP-100A/100/200,
ICP-S-150, ICP-PECVD-150, ICP-I, RIE-100/150/150A/100M, STRIPER-100, PECVD-150LL,
Sputter 100, HighThroughput100-6A.

## Before publishing (Phase 2)

- Do a verbatim full-text instrument-string re-quote pass on the
  `seed-evidence-catalog.ts` batch (the spotlights + Scholar-verified + full-text
  batches already carry verbatim quotes).
- Confirm no product **page** displays a live aggregate citation count.
