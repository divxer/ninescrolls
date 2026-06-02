# RIE Cluster Phase 2 — Change Log (2026-06-02)

Intent-deconfliction edits applied to **DynamoDB (live source of truth)**. The 3 surgical edits are not committed as code (per the one-shot-not-committed convention); this file is their audit trail. The ICP-RIE expansion has committed provenance HTML.

Spec: `docs/superpowers/specs/2026-06-02-rie-cluster-intent-deconfliction-design.md`
Plan: `docs/superpowers/plans/2026-06-02-rie-cluster-intent-deconfliction.md`

## reactive-ion-etching-vs-ion-milling (ion-milling) — priority 1, top traffic leak
- **Title:** unchanged — "Reactive Ion Etching vs Ion Milling (IBE): Complete Comparison Guide"
- **First H2:** `Introduction` → `RIE vs Ion Milling: Two Different Material-Removal Mechanisms`
- **Opening:** "In advanced semiconductor fabrication … dry etching plays a central role … Among the most widely used techniques are RIE and Ion Milling." → "This guide compares two fundamentally different material-removal mechanisms — chemically driven RIE and physically driven Ion Milling — and shows when to choose each."

## understanding-differences-pe-rie-icp-rie-plasma-etching (comparison) — priority 3
- **Title:** "RIE vs ICP-RIE vs PE: Plasma Etching Comparison" → "PE vs RIE vs ICP-RIE: Which Plasma Etching Process Should You Choose?"
- **Opening:** appended an ICP-RIE canonical pointer after the existing RIE-Guide link → now links `/insights/icp-rie-technology-advanced-etching` ("For ICP-RIE technology in depth …").

## deep-reactive-ion-etching-bosch-process (DRIE) — priority 4
- **Title:** unchanged — "Deep Reactive Ion Etching (DRIE): Bosch Process Guide for MEMS & TSV"
- **Opening:** "Deep Reactive Ion Etching (DRIE) is a specialized anisotropic etching technique that enables extremely high aspect ratio (HAR) features …" → "Deep Reactive Ion Etching (DRIE) extends conventional reactive ion etching to create extremely deep, high aspect ratio (HAR) structures …" (DRIE in first ~20 words, cedes generic-RIE intent to pillar).

## icp-rie-technology-advanced-etching (ICP-RIE) — priority 2, now the cluster's ICP-RIE canonical
- **Title:** "ICP‑RIE Technology – High‑Density Plasma for Advanced Etching" → "ICP-RIE Technology: Principles, Equipment & Applications"
- **Body:** expanded **841 → 2,080 words**, 9 sections (What Is ICP-RIE → ICP plasma generation → source vs bias power → high-density rationale → equipment architecture → applications [Logic&Memory, SiC/GaN, III-V, Advanced Packaging] → advantages → limitations → ICP-RIE vs RIE table). Passed an independent technical-accuracy review. Provenance HTML committed at `scripts/articles/icp-rie-technology-advanced-etching.html`.

## reactive-ion-etching-guide (pillar) — unchanged (verify-only)
Remains the canonical RIE owner; the only page permitted a generic-RIE definitional opening and a generic-RIE first H2.

---

**Governance:** 8 anti-cannibalization rules (R1–R7 + R8 advisory). See spec. Re-pull GSC ~3–4 weeks out to score Success Metrics #1–#4 (pillar off page 5; ICP overtakes comparison for icp-rie terms; ion-milling impressions down + CTR up; pillar "reactive ion etching" impression share 61% → >90%).
