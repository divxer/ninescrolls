# ICP-300 Facility Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate and overwrite the two NineScrolls ICP-300 customer PDFs using only supplier-confirmed parameters.

**Architecture:** A focused Python generator will hold the supplier-confirmed data as constants, build the branded Facility Requirements PDF with ReportLab, and build the branded Layout Drawing by placing a high-resolution rendering of the supplier drawing without altering its engineering content. A verification test will extract text from the final PDFs and assert required and forbidden content before visual inspection.

**Tech Stack:** Python 3, ReportLab, pypdf/pdfplumber, Poppler (`pdftoppm`, `pdftotext`, `pdfinfo`).

## Global Constraints

- The supplier PDFs are the only technical source of truth.
- Do not infer or introduce equipment, utility, environmental, electrical, or installation parameters.
- Preserve supplier SI values exactly.
- Back up both existing NineScrolls PDFs before overwriting them.
- Do not modify unrelated repository changes.

---

### Task 1: Generator and parameter contract

**Files:**
- Create: `scripts/generate-icp300-facility-documents.py`
- Create: `scripts/test_generate_icp300_facility_documents.py`

**Interfaces:**
- Consumes: supplier PDF paths and output directory passed on the command line.
- Produces: `NineScrolls-ICP-300-Facility-Requirements.pdf` and `NineScrolls-ICP-300-Layout-Drawing.pdf`.

- [ ] **Step 1: Write a failing parameter-contract test**

Create a unittest that runs the generator in a temporary directory, extracts text using `pypdf.PdfReader`, and asserts required tokens including `10 kW`, `380 V`, `50 A`, `Vent (GN2)`, `KF40`, `40 m3/h`, and `400 sccm`. It must also reject `Minimum Ceiling Height`, `18 - 28`, `Relative Humidity`, `400V/50Hz`, `EU installations`, and `lid open`.

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
python3 -m unittest scripts/test_generate_icp300_facility_documents.py -v
```

Expected: failure because the generator does not yet exist.

- [ ] **Step 3: Implement the generator**

Implement stable ReportLab page templates, supplier-data tables, page headers/footers, and a layout page that embeds a high-resolution supplier drawing rendering. Accept `--supplier-facility`, `--supplier-layout`, `--output-dir`, and `--logo` arguments. Use ASCII-compatible chemical labels in extracted text while rendering subscripts where practical.

- [ ] **Step 4: Run the contract test**

Run the unittest command from Step 2.

Expected: all tests pass and both PDFs are generated in the temporary directory.

### Task 2: Backup and overwrite customer PDFs

**Files:**
- Modify: `/Users/harvey/MyDocuments/Company_Registration/NineScrolls LLC/Clients/Diamond Foundry/Quote/NineScrolls-ICP-300-Facility-Requirements.pdf`
- Modify: `/Users/harvey/MyDocuments/Company_Registration/NineScrolls LLC/Clients/Diamond Foundry/Quote/NineScrolls-ICP-300-Layout-Drawing.pdf`
- Create: timestamped backup copies beside the two existing PDFs.

**Interfaces:**
- Consumes: the tested generator from Task 1 and the two supplier PDFs.
- Produces: revised customer-facing PDFs at the existing paths.

- [ ] **Step 1: Copy the current PDFs to timestamped backup paths**

Use explicit source and destination filenames ending in `.pre-supplier-alignment-20260722.pdf`.

- [ ] **Step 2: Run the generator against the supplier files**

Pass the Quote directory as `--output-dir` and the repository logo as `--logo`.

- [ ] **Step 3: Confirm output identity and page metadata**

Run `pdfinfo` on both outputs and confirm the Facility Requirements document has all intended sections and the Layout Drawing is a single landscape page.

### Task 3: Textual and visual verification

**Files:**
- Create during verification: `tmp/pdfs/icp300-final/` rendered PNGs and extracted text.

**Interfaces:**
- Consumes: final overwritten PDFs.
- Produces: verification evidence only; no additional customer artifacts.

- [ ] **Step 1: Extract final text and compare required/forbidden terms**

Run the unittest against the final output directory and independently inspect `pdftotext -layout` output.

- [ ] **Step 2: Render every page at 180 dpi**

Use `pdftoppm -png -r 180` for both final PDFs.

- [ ] **Step 3: Visually inspect all pages**

Confirm there is no clipping, overlap, broken glyph, incorrect dimension, illegible engineering label, or bad page break. Confirm all four layout service-space dimensions are 800 mm.

- [ ] **Step 4: Report outputs and backups**

Provide clickable absolute paths to the two final PDFs and identify the two recoverable backup files.
