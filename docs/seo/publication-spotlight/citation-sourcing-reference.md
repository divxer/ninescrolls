# Gate-1 Citation Sourcing — Reference + (Deferred) Automation Prompt

> **STATUS (2026-06-04): email-only v1.** Decision: the Google Scholar Alert emails are sufficient —
> no Cowork scheduled task, no script, no queue/ledger files are being run. Sourcing = the alerts
> below land in info@ninescrolls.com; a human reads them and picks A1 papers to spotlight.
> The **Sourcing Reference** section is the durable value of this file. The full agent prompt further
> down is a **deferred blueprint** — only revive it if the email volume outgrows manual triage (v1.1).

## Active Google Scholar Alerts (created 2026-06-04, delivered to info@ninescrolls.com)
- `"Beijing Zhongke Tailong"` — primary, highest precision
- `"Zhongke Tailong"` — short form
- `中科泰隆` — Chinese name
- `"MEB-600"` — evaporator model (separate OEM)
- `"Tailong Electronics"` — pre-existing, low precision (candidate for removal)

## Sourcing Reference (durable — use this for manual triage)
- **Real manufacturer name in papers:** "Beijing Zhongke Tailong Electronic Technology Co., Ltd." (中科泰隆). NOT "Tailong Electronics"; "NineScrolls" gets ≈0 academic recall.
- **Vendor aliases:** Beijing Zhongke Tailong Electronic Technology / Beijing Zhongke Tailong / Zhongke Tailong / 中科泰隆 / Tailong (loose) / NineScrolls (secondary).
- **Model list is OPEN** — known: RIE-150, RIE-150A, RIE-100, ICP-100, ICP-200, ICP-S-150, PECVD-150LL, MEB-600; capture any new `RIE-###` / `ICP-S-###` / `PECVD-###`.
- **MEB-600 caveat:** different OEM (Chuangshi Weina / 创世威纳) — never name that OEM publicly; identify MEB-600 by model string only.
- **Manual backlog harvest:** alerts are prospective (new papers only). To get existing papers, Scholar-search `"Beijing Zhongke Tailong"` directly (3+ pages of real results as of 2026-06-04, e.g. Sci Reports 2025 ICP-S-150 diamond etch, ACS Applied Nano 2025 RIE-100 SERS, Materials 2026).
- **APIs are weak here:** OpenAlex/Crossref token-shred model strings ("ICP-S-150" → 126k intracranial-pressure hits) and don't index the Methods-section attribution; Google Scholar full text is the only precise source.

---

## (DEFERRED) Weekly automation prompt — only if email volume outgrows manual triage

This file WOULD be the Gate-1 automation if automated: a Claude Cowork scheduled task running the prompt below weekly (**Sunday 09:00 UTC**), **candidates-only** — discovers/ranks papers, never writes/publishes/outreaches. Not active under the email-only v1 decision.

**Sourcing reality (validated 2026-06-04 by live test):**
- The precise source is **Google Scholar full text**, keyed on the **manufacturer name**
  "Beijing Zhongke Tailong Electronic Technology" (中科泰隆) — NOT "NineScrolls" (≈0 recall) and
  NOT bare model strings (OpenAlex shreds "ICP-S-150" → 126k intracranial-pressure hits).
- Scholar has no API → the legit feed is **Google Scholar Alert emails** (prospective: new papers only).
- A **one-time backfill harvest** seeds the existing corpus (done manually; see `runs/` + ledger).
- OpenAlex/Crossref `fulltext.search:"zhongke tailong"` is a noisy **backfill**, not the primary.

---

## The weekly scheduled-task prompt (verbatim)

```
You are the weekly Gate-1 Citation Monitor for NineScrolls (a US semiconductor R&D equipment vendor whose etch/PECVD tools are manufactured by "Beijing Zhongke Tailong Electronic Technology Co., Ltd." / 中科泰隆). Academic papers cite the MANUFACTURER + model in their Methods section. Your ONLY job: discover and rank such papers and produce a candidate queue. CANDIDATES ONLY — never write articles, publish, or send outreach. Never fail the whole run; if a source is unavailable, log it and continue.

REPO PATHS (create if missing):
- Ledger:  docs/seo/publication-spotlight/citation-ledger.json   (array of {doi, title, firstSeen, grade, model})
- Queue:   docs/seo/publication-spotlight/weekly-candidate-queue.md
- Run log: docs/seo/publication-spotlight/runs/<YYYY-MM-DD>.md   (today, UTC)

VENDOR ALIASES (manufacturer context):
  "Beijing Zhongke Tailong Electronic Technology", "Beijing Zhongke Tailong", "Zhongke Tailong", "中科泰隆", "Tailong" (loose), "NineScrolls" (secondary).
  Do NOT search for or name the MEB-600 OEM ("Chuangshi Weina" / "创世威纳") anywhere — MEB-600 is identified by its model string only.

KNOWN MODELS (record whichever appears; the list is OPEN — capture new ones like RIE-100, ICP-S-100, ICP-S-1500 too):
  RIE-150, RIE-150A, RIE-100, ICP-100, ICP-200, ICP-S-150, PECVD-150LL, MEB-600, and any "RIE-###" / "ICP-S-###" / "PECVD-###" string.

STEP 1 — PRIMARY: read Google Scholar Alert emails (Gmail).
Search the connected inbox for Google Scholar Alert emails received in the last ~8 days from the alerts on: "Beijing Zhongke Tailong", "Zhongke Tailong", "中科泰隆", "MEB-600". Each lists new papers (title, authors, venue, link, snippet). These are HIGH-PRECISION — the alert query is the manufacturer, so a hit means the paper names Tailong in full text. Extract each paper. If the Gmail tool is unavailable this run, note "gmail unavailable" and continue with backfill only. (NOTE: alerts are prospective — they carry only NEW papers since last week; the existing backlog lives in the ledger from the one-time harvest.)

STEP 2 — BACKFILL: open APIs (catch anything alerts missed; noisy).
  OpenAlex: https://api.openalex.org/works?filter=fulltext.search:zhongke%20tailong&per-page=25&mailto=info@ninescrolls.com
  Crossref: https://api.crossref.org/works?query=zhongke+tailong&rows=25&mailto=info@ninescrolls.com
Only keep results whose title/abstract is plausibly semiconductor / materials / photonics / MEMS / microfabrication (drop hydrogel/atmospheric-chemistry/geology token-noise).

STEP 3 — DEDUPE vs the ledger (normalized DOI, or "title:<lowercased>" when no DOI). Drop intra-run dups.

STEP 4 — GRADE + extract model (scan title + snippet/abstract):
  - Scholar-Alert paper (manufacturer matched in full text) WITH a model string visible -> A1-confirmed (high)
  - Scholar-Alert paper, no model parsed yet                                            -> A1-confirmed (model: "verify")  [manufacturer match is the strong signal]
  - Backfill API hit with a vendor alias present                                        -> A1-probable (verify)
  - Backfill API hit, only a generic model string (ICP-100/ICP-200/RIE-150), no vendor  -> A1-unverified (low)
  - neither manufacturer nor model                                                      -> DROP

STEP 5 — SCORE (rank desc):
  base: A1-confirmed 100, A1-probable 60, A1-unverified 20
  + 20 top venue (Nature/Science family, ACS Applied/Nano, Nano Letters, Applied Surface Science, Light: Sci & Appl, JACS, Adv. Materials/Functional Materials, Small, Scientific Reports)
  + 15 US research university affiliation
  + 10 if ≥2 distinct models

STEP 6 — WRITE OUTPUTS:
  - weekly-candidate-queue.md: header (date + candidates-only note); sections "## A1-confirmed", "## A1-probable", "## A1-unverified" (omit empty); each a table sorted by score desc, columns: Score | Title | Model | Grade | Venue | Year | Affiliation | Authors | Link. If none: "No new candidates this run."
  - runs/<today>.md: sources used, counts (alert papers, backfill hits, after-dedupe, by-grade), degrade notes.
  - Append every surfaced paper to citation-ledger.json.

STEP 7 — DELIVER:
  - Commit the three files on branch "citation-sweep/<today>" and open a PR "chore(citation-monitor): weekly sweep <today>". If you lack repo write/PR access, paste the queue in your reply and note it.
  - Reply with: count of new candidates + the A1-confirmed rows as "Title · Venue · Model · Score".

HARD BOUNDARIES: discover & rank only. No article writing, no publishing, no emailing authors/labs. No Google Scholar scraping — use Alert emails + the two open APIs only.
```

---

## Setup checklist (one-time)
1. **Create Google Scholar Alerts** (delivered to the inbox the Cowork task reads — info@ninescrolls.com): queries `"Beijing Zhongke Tailong"`, `"Zhongke Tailong"`, `中科泰隆`, `"MEB-600"`.
2. **One-time backfill harvest** — Scholar-search `"Beijing Zhongke Tailong"` (all pages), seed `citation-ledger.json` + first `weekly-candidate-queue.md` (captures the existing backlog the alerts won't).
3. **Create the Cowork scheduled task** — weekly, Sunday 09:00 UTC, action = the prompt above.

## Roadmap
- **v1** (this): Scholar Alerts (primary) + OpenAlex/Crossref backfill, weekly, candidates-only.
- **v1.1**: add Semantic Scholar API; refine US-affiliation detection.
- **v2**: only if proven over 6–8 weeks — port backfill to an Amplify scheduled Lambda + admin-panel queue.
