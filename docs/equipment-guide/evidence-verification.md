# Equipment Guide — Evidence Source Verification

Task 0 of the Equipment Guide Generator plan. This file records **verified facts only**
for the two NEW candidate studies proposed for the evidence page. It gates the evidence
page authored in a later task.

- **Date of verification:** 2026-07-10
- **Verifier tooling:** WebSearch + WebFetch (OpenAlex REST API, publisher pages).
  Google Scholar (`scholar.google.com`) returned **HTTP 403** on every fetch attempt
  during this verification window, so citation counts below are taken from **OpenAlex
  `cited_by_count`** (a live, resolvable source) rather than Scholar's "Cited by N".
- **Scope:** ONLY the two new candidates are checked here. The four already-shipped studies
  (Nature Communications 2021 vdW rectifiers `10.1038/s41467-021-21861-6`;
  Light: Science & Applications 2026 color router `10.1038/s41377-025-02146-9`;
  Advanced Materials 2026 metasurface `10.1002/adma.202519943`;
  Materials Today 2026 Ga2O3 UV detector `10.1016/j.mattod.2026.103220`) are already
  verified/shipped and were NOT re-checked.

---

## Candidate 1 — Scientific Reports 2025 (ICP diamond etch, Zhao et al.)

- **Status:** ✅ VERIFIED — real title, resolvable DOI, cross-checked on multiple sources.
- **Exact title:** *Experimental study of inductively coupled plasma etching of patterned
  single crystal diamonds*
- **First author:** Lei Zhao (Zhao et al.)
- **Journal:** Scientific Reports
- **Year:** 2025 (publication date `2025-07-01`)
- **Volume / article:** Scientific Reports **15**, article no. 21062 (2025)
- **DOI:** `10.1038/s41598-025-08066-3` — **resolves** (Nature article page exists;
  mirrored open-access at PubMed Central `PMC12214984`)
- **Citation count:** **4** (OpenAlex `cited_by_count`, as of Jul 2026).
  Google Scholar "Cited by N" was **not obtainable** — Scholar returned HTTP 403 during
  this verification window. Recommend re-pulling the Scholar count when Scholar is
  reachable; OpenAlex figure recorded in the interim.
- **Query / source URLs used:**
  - WebSearch: `Scientific Reports 2025 ICP diamond etching Zhao inductively coupled plasma`
  - OpenAlex: `https://api.openalex.org/works/https://doi.org/10.1038/s41598-025-08066-3`
    → confirmed title, `publication_date: 2025-07-01`, journal "Scientific Reports",
    DOI, `cited_by_count: 4`, first author "Lei Zhao"
  - Publisher: `https://www.nature.com/articles/s41598-025-08066-3` (article exists;
    303-redirects to Nature IdP for cookie auth, consistent with a live article page)
  - Mirror confirming DOI/content: `https://pmc.ncbi.nlm.nih.gov/articles/PMC12214984/`
- **INCLUDED on evidence page:** **YES**

---

## Candidate 2 — ACS Applied Nano Materials 2025 (RIE-100 SERS, Liu et al.)

- **Status:** ❌ NOT VERIFIED — could not locate a matching real paper with a resolvable DOI.
- **What was searched for:** a 2025 paper in *ACS Applied Nano Materials*, first author
  surname **Liu**, on SERS / surface-enhanced Raman substrates fabricated with an
  **RIE-100** reactive ion etcher.
- **Result of search:** No paper matching all of {journal = ACS Applied Nano Materials,
  year = 2025, first author = Liu, topic = SERS via RIE-100 / reactive ion etching} could
  be confirmed. Near-misses were inspected and rejected:
  - *Biologically Inspired Superwetting SERS Substrates*, ACS Applied Nano Materials
    `10.1021/acsanm.4c04342` — first author **Junrong Fu** (not Liu), published **2024**,
    no RIE/RIE-100 in fabrication → not a match.
  - *Ion-Engineered Nanostructuring of MoO3–Ag–Au Multilayer Surfaces as SERS Substrates*,
    ACS Applied Nano Materials `10.1021/acsanm.5c05867` — first author **Om Prakash**,
    uses swift-heavy-ion irradiation (not RIE), publication date 2026-01 → not a match.
  - *Stable and Reusable Lace-like Black Silicon … for SERS-Based Sensing*, ACS Applied
    Nano Materials `10.1021/acsanm.3c00281` — 2023, not Liu → not a match.
- **Queries / source URLs used:**
  - WebSearch (multiple variants), e.g.
    `ACS Applied Nano Materials 2025 RIE-100 SERS Liu reactive ion etching surface-enhanced Raman`;
    `Liu "ACS Applied Nano Materials" 2025 SERS substrate "10.1021/acsanm" reactive ion etching`;
    `"ACS Applied Nano Materials" 2025 Liu SERS silicon nanostructure "RIE-100" etcher Raman enhancement`
  - OpenAlex search: `https://api.openalex.org/works?search=RIE-100%20SERS%20surface%20enhanced%20Raman%20substrate`
    and DOI look-ups on the near-miss candidates above
  - Google Scholar (`https://scholar.google.com/scholar?q=Liu+SERS+RIE-100+...`) — HTTP 403,
    unavailable during this window
- **DOI:** none confirmed. No DOI invented.
- **INCLUDED on evidence page:** **NO** (unverifiable — omit per decision rule)

---

## Decision rule applied

Per Task 0 Step 2:
- BOTH verify → keep `Nature Portfolio journals, ACS, Advanced Materials, Materials Today, and Scientific Reports`.
- ONLY ACS verifies → drop `Scientific Reports`.
- ONLY Scientific Reports verifies → drop `ACS`.
- NEITHER → `Nature Portfolio journals, Advanced Materials, and Materials Today`.

**Outcome:** Scientific Reports (Zhao) VERIFIED; ACS Applied Nano Materials (Liu) NOT verified
→ **"ONLY Scientific Reports verifies" branch → drop `ACS`**.

### Locked subtitle string

```
Nature Portfolio journals, Advanced Materials, Materials Today, and Scientific Reports
```

- Scientific Reports 2025 (Zhao et al., ICP diamond etch): **INCLUDED**
- ACS Applied Nano Materials 2025 (Liu et al., RIE-100 SERS): **OMITTED** (unverifiable)
