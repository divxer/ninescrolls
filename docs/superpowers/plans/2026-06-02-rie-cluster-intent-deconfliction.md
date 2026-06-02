# RIE Cluster Intent Deconfliction (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition 5 RIE-cluster pages to one-URL-one-intent so the pillar lifts off page 5, the ICP page becomes the ICP-RIE canonical, and the ion-milling page sheds junk impressions — enforced by 7 verifiable anti-cannibalization rules.

**Architecture:** Two work types. (A) Three **surgical metadata edits** (ion-milling, comparison, DRIE) applied by ONE idempotent dry-run find/replace script against DynamoDB — NOT committed. (B) One **content expansion** of the ICP-RIE page (841 → 1,700–2,200 words) drafted section-by-section, written to a committed provenance HTML, then pushed to DDB. Live source of truth is DynamoDB; HTML in `scripts/articles/` is git provenance only.

**Tech Stack:** TypeScript + `tsx`, AWS Amplify Data (DynamoDB), `scripts/lib/auth.ts` (admin sign-in). Verification = grep/word-count assertions (the "tests" for content work).

**Spec:** `docs/superpowers/specs/2026-06-02-rie-cluster-intent-deconfliction-design.md`

**Branch:** `seo/rie-cluster-intent-deconfliction` (already created from `origin/main`; spec already committed there).

**Env loading (every script run):** `set -a; . ./.env; set +a` then `npx tsx <script>`. Auth uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` via `scripts/lib/auth.ts`.

---

## The 7 rules (verification reference — grep targets)

| Rule | Check |
|---|---|
| R1 | Only pillar opening has definitional `Reactive ion etching is` / `RIE is`. Non-pillar openings: none. |
| R2 | Only ICP opening defines `ICP-RIE is` / `Inductively Coupled Plasma … is`. Comparison first 150 words: none. |
| R3 | Each non-pillar page has **exactly one** opening pillar up-link anchored `Reactive Ion Etching (RIE)`; surgical edits must not change the pillar-link count. |
| R4 | ICP page final body 1,700–2,200 words. |
| R5 | Title ownership: pillar="Reactive Ion Etching", ICP="ICP-RIE", DRIE="Deep Reactive Ion Etching", comparison/ion-milling=comparison intent. |
| R6 | No non-pillar page has a generic-RIE first H2 (`What is Reactive Ion Etching?` etc.). |
| R7 | Comparison + ion-milling pages stay comparison/selection; never `What is X?` canonical bodies. |
| R8 (advisory) | Only the ICP page targets "ICP etcher"/"ICP-RIE" in title or first H2; no `What Is an ICP Etcher?` H2 elsewhere. |

**Page IDs (DDB):**
- ion-milling `reactive-ion-etching-vs-ion-milling` = `fc4956be-1255-4d49-8a47-3348ac1f8118`
- comparison `understanding-differences-pe-rie-icp-rie-plasma-etching` = `7270743f-f865-41fc-bfce-2447401f015a`
- DRIE `deep-reactive-ion-etching-bosch-process` = `5811caa1-923c-4098-979a-ef276996cd25`
- ICP `icp-rie-technology-advanced-etching` (fetch id at runtime via slug)
- pillar `reactive-ion-etching-guide` (verify-only)

---

## Task 1: One-shot surgical edit script (ion-milling + comparison + DRIE)

**Files:**
- Create: `scripts/rie-deconfliction-edits.ts` (one-shot — deleted in Task 6, NOT committed)

Each edit is verbatim find → replace with an idempotency guard (skip if guard string already present). Ion-milling first (largest leak). `--dry-run` prints would-change without writing.

- [ ] **Step 1: Write the one-shot script**

```typescript
/**
 * Phase 2 RIE deconfliction — 3 surgical metadata edits (NOT committed).
 * Order: ion-milling (priority 1) -> comparison (3) -> DRIE (4).
 * Dry-run + idempotency guards. Run: npx tsx scripts/rie-deconfliction-edits.ts [--dry-run]
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });

// Build a whitespace/attribute-tolerant regex from a literal HTML snippet:
//  - escape regex metachars
//  - collapse any whitespace run to \s+ (tolerates newlines/indentation drift)
//  - loosen opening block tags so <h2> also matches <h2 id="intro">
const rx = (s: string): RegExp => new RegExp(
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
   .replace(/\s+/g, '\\s+')
   .replace(/<(h2|h3|p)>/g, '<$1[^>]*>'),
  'i',
);

type Edit = { slug: string; field: 'title' | 'content'; find: RegExp; replace: string; guard: string; note: string };

const EDITS: Edit[] = [
  // ---- ION MILLING (priority 1) ----
  {
    slug: 'reactive-ion-etching-vs-ion-milling', field: 'content', note: 'R6 first-H2 page-specific',
    find: rx('<h2>Introduction</h2>'),
    replace: '<h2>RIE vs Ion Milling: Two Different Material-Removal Mechanisms</h2>',
    guard: 'Two Different Material-Removal Mechanisms',
  },
  {
    slug: 'reactive-ion-etching-vs-ion-milling', field: 'content', note: 'R1 contrast-frame opening (keeps both links)',
    find: rx('<p>In advanced semiconductor fabrication and materials science research, <strong>dry etching</strong> plays a central role in transferring patterns with high fidelity. Among the most widely used techniques are <a href="/insights/reactive-ion-etching-guide">Reactive Ion Etching (RIE)</a> and Ion Milling (also called <a href="/products/ibe-ribe">Ion Beam Etching, IBE</a>).</p>'),
    replace: '<p>This guide compares two fundamentally different material-removal mechanisms — chemically driven <a href="/insights/reactive-ion-etching-guide">Reactive Ion Etching (RIE)</a> and physically driven Ion Milling (also called <a href="/products/ibe-ribe">Ion Beam Etching, IBE</a>) — and shows when to choose each.</p>',
    guard: 'two fundamentally different material-removal mechanisms',
  },
  // ---- COMPARISON (priority 3) ----
  {
    slug: 'understanding-differences-pe-rie-icp-rie-plasma-etching', field: 'title', note: 'R5 selection-intent title (keeps PE/RIE/ICP-RIE in front)',
    find: rx('RIE vs ICP-RIE vs PE: Plasma Etching Comparison'),
    replace: 'PE vs RIE vs ICP-RIE: Which Plasma Etching Process Should You Choose?',
    guard: 'Which Plasma Etching Process Should You Choose',
  },
  {
    slug: 'understanding-differences-pe-rie-icp-rie-plasma-etching', field: 'content', note: 'feed ICP canonical (RULE 7-safe pointer)',
    find: rx('see our <a href="/insights/reactive-ion-etching-guide">Reactive Ion Etching (RIE) Guide</a>.</p>'),
    replace: 'see our <a href="/insights/reactive-ion-etching-guide">Reactive Ion Etching (RIE) Guide</a>. For ICP-RIE technology in depth — high-density plasma, source vs bias power, and equipment architecture — see our <a href="/insights/icp-rie-technology-advanced-etching">ICP-RIE Technology Guide</a>.</p>',
    guard: 'For ICP-RIE technology in depth',
  },
  // ---- DRIE (priority 4) ----
  {
    slug: 'deep-reactive-ion-etching-bosch-process', field: 'content', note: 'R1 DRIE-first opening, "extends RIE" (no new pillar link)',
    find: rx('<p>Deep Reactive Ion Etching (DRIE) is a specialized anisotropic etching technique that enables extremely high aspect ratio (HAR) features in silicon substrates.'),
    replace: '<p>Deep Reactive Ion Etching (DRIE) extends conventional reactive ion etching to create extremely deep, high aspect ratio (HAR) structures in silicon substrates.',
    guard: 'extends conventional reactive ion etching to create extremely deep',
  },
];

(async () => {
  const dry = process.argv.includes('--dry-run');
  await authenticate();
  const cache: Record<string, any> = {};
  for (const e of EDITS) {
    if (!cache[e.slug]) {
      const { data } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: e.slug });
      cache[e.slug] = data?.[0];
    }
    const p = cache[e.slug];
    if (!p) { console.error(`SKIP ${e.slug}: not found`); continue; }
    const cur: string = p[e.field] || '';
    if (cur.includes(e.guard)) { console.log(`SKIP ${e.slug}.${e.field} [${e.note}]: guard present (idempotent)`); continue; }
    // Require EXACTLY ONE match before replacing — refuse on 0 (drift) or 2+ (ambiguous, would mis-replace).
    const g = new RegExp(e.find.source, 'gi');
    const n = (cur.match(g) || []).length;
    if (n !== 1) { console.error(`FAIL ${e.slug}.${e.field} [${e.note}]: expected exactly 1 anchor match, found ${n}`); continue; }
    p[e.field] = cur.replace(e.find, e.replace);
    console.log(`${dry ? 'WOULD EDIT' : 'EDIT'} ${e.slug}.${e.field} [${e.note}]`);
  }
  if (dry) { console.log('\\n(dry-run, no writes)'); return; }
  for (const slug of Object.keys(cache)) {
    const p = cache[slug];
    if (!p) continue;
    const { errors } = await client.models.InsightsPost.update({ id: p.id, title: p.title, content: p.content });
    console.log(errors ? `WRITE FAIL ${slug}: ${JSON.stringify(errors)}` : `WROTE ${slug}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run — verify every anchor matches**

```bash
set -a; . ./.env; set +a
npx tsx scripts/rie-deconfliction-edits.ts --dry-run 2>&1 | grep -v "npm warn"
```

Expected: 5 lines, all `WOULD EDIT` (or `SKIP … guard present` on re-runs). **Zero `FAIL … anchor NOT found`.** If any FAIL: the live HTML drifted — re-fetch that page's exact string and fix the `find` before applying.

- [ ] **Step 3: Apply**

```bash
npx tsx scripts/rie-deconfliction-edits.ts 2>&1 | grep -v "npm warn"
```

Expected: `WROTE reactive-ion-etching-vs-ion-milling`, `WROTE understanding-differences-…`, `WROTE deep-reactive-ion-etching-bosch-process`.

- [ ] **Step 4: No commit** — this script is deleted in Task 6. Do not `git add` it.

---

## Task 2: Verify the 3 surgical pages against the rules

**Files:** none (read-only verification)

- [ ] **Step 1: Run the rule-check script**

```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
const pages=[
 ['reactive-ion-etching-vs-ion-milling','ion-milling'],
 ['understanding-differences-pe-rie-icp-rie-plasma-etching','comparison'],
 ['deep-reactive-ion-etching-bosch-process','DRIE'],
];
(async()=>{await authenticate();
for(const [slug,name] of pages){const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug});const p=data[0];const html=p.content||'';
const open=html.slice(0,700);
const firstH2=(html.match(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/)||[])[1]?.replace(/<[^>]+>/g,'').trim()||'(none)';
const openingPillarLinks=(open.match(/<a href=\"\\/insights\\/reactive-ion-etching-guide\">/g)||[]).length;
const totalPillarLinks=(html.match(/<a href=\"\\/insights\\/reactive-ion-etching-guide\">/g)||[]).length;
const r1 = /reactive ion etching is\\b/i.test(open) ? 'VIOLATION' : 'ok';
const r6 = /what is reactive ion etching|how reactive ion etching works|reactive ion etching process/i.test(firstH2) ? 'VIOLATION' : 'ok';
console.log('\\n== '+name+' =='); console.log('TITLE:',p.title);
console.log('first H2:',firstH2);
console.log('R1 (no generic-RIE def in opening):',r1);
console.log('R6 (first H2 not generic-RIE):',r6);
console.log('R3 (OPENING pillar-link count, expect exactly 1):',openingPillarLinks,'| total in article:',totalPillarLinks);
}
})();
" 2>&1 | grep -v "npm warn"
```

Expected:
- ion-milling: title unchanged; first H2 = `RIE vs Ion Milling: Two Different Material-Removal Mechanisms`; R1 ok; R6 ok; opening pillar links = 1.
- comparison: title = `PE vs RIE vs ICP-RIE: Which Plasma Etching Process Should You Choose?`; R1 ok; R6 ok; **opening pillar links = 1** (total in article may be 2 — acceptable per the opening-scoped RULE 3).
- DRIE: title unchanged; first H2 = `1) Introduction to DRIE and the Bosch Process`; R1 ok; R6 ok; opening pillar links = 1.

If any `VIOLATION`: stop, inspect that page, hand-fix via a follow-up verbatim edit, re-run.

- [ ] **Step 2: Confirm ICP canonical link landed on comparison**

```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'understanding-differences-pe-rie-icp-rie-plasma-etching'});
console.log('ICP link present:', (data[0].content||'').includes('For ICP-RIE technology in depth'));})();
" 2>&1 | grep -v "npm warn"
```

Expected: `ICP link present: true`.

---

## Task 3: Draft ICP-RIE expansion — provenance HTML (sections 1–9)

**Files:**
- Create: `scripts/articles/icp-rie-technology-advanced-etching.html` (provenance — COMMITTED in Task 5)

Author the full new body. Semiconductor-accurate, vendor-neutral, NineScrolls house style (matches the other RIE pages: `<h2>` sections, `<p>`, `<table class="insights-table">`, `<ul>`). Target **1,700–2,200 words** (RULE 4). **Opening rules:** lead with a definitional `ICP-RIE is …` (RULE 2 — this page owns it); reference RIE only as contrast with **exactly one** pillar up-link anchored `Reactive Ion Etching (RIE)` (RULE 1, RULE 3); do NOT open with `Reactive ion etching is …`. First H2 = `1) What Is ICP-RIE?` (RULE 6 — ICP-specific).

**Section outline + word budget (≈1,950 mid-target):**

| # | H2 | ~words | Must cover |
|---|---|---|---|
| opening | (intro `<p>`, before first H2) | 90 | "ICP-RIE is…" definition; one pillar up-link as contrast; target term *ICP-RIE* |
| 1 | `1) What Is ICP-RIE?` | 180 | ICP-RIE vs conventional RIE in one paragraph; *ICP etcher*, *ICP plasma etching* |
| 2 | `2) How ICP Plasma Is Generated` | 220 | RF coil, inductive coupling, electron heating; *high-density plasma etching* |
| 3 | `3) ICP Source Power vs RF Bias Power` | 260 | The decoupling story: source→density, bias→ion energy; *independent ion density control*, *ICP source power*, *ICP bias power* |
| 4 | `4) Why ICP Achieves High Plasma Density` | 200 | 10¹¹–10¹² cm⁻³ vs CCP; low-pressure operation; long mean free path → anisotropy |
| 5 | `5) ICP-RIE Equipment Architecture` | 240 | Coil/chamber/electrode, gas delivery, endpoint, temperature control, load-lock |
| 6 | `6) Semiconductor Manufacturing Applications` | 320 | **4 `<h3>` subsections:** Logic & Memory; SiC/GaN Power Devices; III-V Photonics; Advanced Packaging (TSV, deep-Si). Long-tail anchors ("ICP etching for GaN", "ICP etching SiC") |
| 7 | `7) Advantages of ICP-RIE` | 180 | High rate + selectivity + anisotropy at low damage; bulleted |
| 8 | `8) Limitations and Trade-offs` | 160 | Cost, complexity, loading/ARDE, charging; bulleted |
| 9 | `9) ICP-RIE vs RIE: Summary` | 180 | `<table class="insights-table">` comparing density, pressure, control, cost, use-cases. Points to comparison page for full PE/RIE/ICP-RIE selection. |

- [ ] **Step 1: Draft opening + sections 1–3 (via subagent)**

Dispatch a subagent to write the opening intro `<p>` + sections 1–3 into the file. Pass it: the outline rows above (opening, 1, 2, 3), the rules (R1/R2/R3/R6), and the existing house-style example (fetch the current ICP page or pillar for tone). Subagent returns the HTML fragment; write it to `scripts/articles/icp-rie-technology-advanced-etching.html`. Instruct: never use `--no-verify`.

- [ ] **Step 2: Rule-grep sections so far**

```bash
f=scripts/articles/icp-rie-technology-advanced-etching.html
echo "R2 ICP def in opening (expect >=1):"; grep -ioc "ICP-RIE is\|Inductively Coupled Plasma Reactive Ion Etching (ICP-RIE) is" $f
echo "R1 generic-RIE def in opening (expect 0):"; head -c 500 $f | grep -ic "reactive ion etching is" 
echo "R3 pillar uplink (expect 1):"; grep -oc "/insights/reactive-ion-etching-guide" $f
echo "first H2 (expect '1) What Is ICP-RIE?'):"; grep -o "<h2>[^<]*</h2>" $f | head -1
```

Expected: R2 ≥1; R1 = 0; R3 = 1; first H2 = `<h2>1) What Is ICP-RIE?</h2>`.

- [ ] **Step 3: Draft sections 4–6 (via subagent)**

Dispatch a subagent to append sections 4, 5, 6 (with the 4 `<h3>` application subsections). Pass the outline rows + the already-written fragment for continuity. Append to the file.

- [ ] **Step 4: Draft sections 7–9 (via subagent)**

Dispatch a subagent to append sections 7, 8, 9 (incl. the comparison `<table class="insights-table">`). Section 9's table must point to the comparison page for full selection guidance (one link to `/insights/understanding-differences-pe-rie-icp-rie-plasma-etching`), reinforcing the cluster.

- [ ] **Step 5: Word-count + final rule-grep (RULE 4)**

```bash
f=scripts/articles/icp-rie-technology-advanced-etching.html
echo "word count (expect 1700-2200):"; sed 's/<[^>]*>/ /g' $f | tr -s ' ' '\\n' | grep -c .
echo "all H2s:"; grep -o "<h2>[^<]*</h2>" $f
echo "R3 pillar uplink total (expect exactly 1):"; grep -oc "/insights/reactive-ion-etching-guide" $f
echo "links to comparison page (expect 1):"; grep -oc "/insights/understanding-differences-pe-rie-icp-rie-plasma-etching" $f
```

Expected: word count in [1700, 2200]; 9 H2s sections 1–9 + (no generic-RIE H2); exactly 1 pillar uplink; 1 comparison link. If word count <1700, dispatch a subagent to deepen the thinnest section; if >2200, trim section 6 prose (keep subsection structure).

- [ ] **Step 6: Technical Accuracy Review Gate (E-E-A-T spine — blocks DDB push)**

Dispatch a **fresh subagent as a domain reviewer** (not the author) over `scripts/articles/icp-rie-technology-advanced-etching.html`. It must confirm each claim and flag any error with a correction:

1. **Plasma density** — ICP is high-density **10¹¹–10¹² cm⁻³**, vs CCP/conventional RIE ~10⁹–10¹⁰ cm⁻³. (Section 4)
2. **Power decoupling** — **ICP source (coil) power → plasma density**; **RF bias (platen) power → ion energy / DC self-bias**. These are independently controllable (the defining ICP-RIE advantage). (Section 3)
3. **Low-pressure operation** (typ. mTorr range) → longer mean free path → more directional ions → better anisotropy. (Sections 2/4)
4. **ARDE** is named and correctly defined as **Aspect-Ratio-Dependent Etching** (deeper/narrower features etch slower); **microloading** = local etch-rate dependence on pattern density. (Section 8)
5. No invented vendor specs, no fabricated numeric ranges, no claim that contradicts the pillar or comparison page.

Reviewer returns `PASS` or a list of `CORRECTION:` items. If corrections: apply them to the HTML, re-run Step 5's word-count grep, then re-gate. Do **not** proceed to Task 4 until `PASS`.

---

## Task 4: Push ICP expansion to DDB (content + title)

**Files:**
- Create (temp, NOT committed): `scripts/apply-icp-expansion.ts`

`update-insight-from-html` only replaces `content`; we also need the new title, so use a small dedicated script that sets both from the provenance file.

- [ ] **Step 1: Write the apply script**

```typescript
/** Apply ICP expansion: set content (from provenance HTML) + new title. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });

const SLUG = 'icp-rie-technology-advanced-etching';
const TITLE = 'ICP-RIE Technology: Principles, Equipment & Applications';
const html = readFileSync('scripts/articles/icp-rie-technology-advanced-etching.html', 'utf-8');

(async () => {
  const dry = process.argv.includes('--dry-run');
  await authenticate();
  const { data } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  const p = data?.[0] as any;
  if (!p) { console.error('ICP page not found'); process.exit(1); }
  const words = html.replace(/<[^>]+>/g, ' ').split(/\\s+/).filter(Boolean).length;
  console.log(`id=${p.id} new title="${TITLE}" new words=${words}`);
  if (dry) { console.log('(dry-run)'); return; }
  const { errors } = await client.models.InsightsPost.update({ id: p.id, title: TITLE, content: html });
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : 'updated ICP page (title + content)');
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run then apply**

```bash
set -a; . ./.env; set +a
npx tsx scripts/apply-icp-expansion.ts --dry-run 2>&1 | grep -v "npm warn"
npx tsx scripts/apply-icp-expansion.ts 2>&1 | grep -v "npm warn"
```

Expected: dry-run prints id + title + word count (1700–2200); apply prints `updated ICP page (title + content)`.

- [ ] **Step 3: Verify ICP live in DDB**

```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'icp-rie-technology-advanced-etching'});const p=data[0];const h=p.content||'';
console.log('TITLE:',p.title);
console.log('words:',h.replace(/<[^>]+>/g,' ').split(/\\s+/).filter(Boolean).length);
console.log('first H2:',(h.match(/<h2>[^<]*<\\/h2>/)||[])[0]);
console.log('R5 title has ICP-RIE:', /ICP-RIE/.test(p.title));
})();
" 2>&1 | grep -v "npm warn"
```

Expected: title = `ICP-RIE Technology: Principles, Equipment & Applications`; words 1700–2200; first H2 = `<h2>1) What Is ICP-RIE?</h2>`; R5 true.

- [ ] **Step 4: Delete the temp apply script**

```bash
rm scripts/apply-icp-expansion.ts
```

---

## Task 5: Full-cluster verification (all 5 pages, all 7 rules)

**Files:** none (read-only)

- [ ] **Step 1: Run cluster-wide governance check**

```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
const pages=[
 ['reactive-ion-etching-guide','pillar'],
 ['icp-rie-technology-advanced-etching','ICP'],
 ['deep-reactive-ion-etching-bosch-process','DRIE'],
 ['understanding-differences-pe-rie-icp-rie-plasma-etching','comparison'],
 ['reactive-ion-etching-vs-ion-milling','ion-milling'],
];
(async()=>{await authenticate();
for(const [slug,name] of pages){const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug});const p=data[0];const h=p.content||'';
const open=h.slice(0,450);
const firstH2=(h.match(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/)||[])[1]?.replace(/<[^>]+>/g,'').trim()||'(none)';
const isPillar=name==='pillar';
const r1=/reactive ion etching is\\b/i.test(open);
const r6=/what is reactive ion etching|how reactive ion etching works|reactive ion etching process/i.test(firstH2);
console.log('\\n== '+name+' =='); console.log(' title:',p.title); console.log(' firstH2:',firstH2);
console.log(' R1 generic-RIE-def-in-opening:', r1 ? (isPillar?'ok(pillar allowed)':'VIOLATION'):'ok');
console.log(' R6 generic-RIE-first-H2:', r6 ? (isPillar?'ok(pillar allowed)':'VIOLATION'):'ok');
}
})();
" 2>&1 | grep -v "npm warn"
```

Expected: pillar may show R1/R6 "ok(pillar allowed)"; **all 4 non-pillar pages show `ok` for both R1 and R6**. Any `VIOLATION` blocks the PR.

- [ ] **Step 2: Snapshot current positions (baseline for the 3–4 week measurement)**

Record in the PR description the 3-month baseline already captured in the spec, including the **query-ownership baseline for Metric #4**: on exact query "reactive ion etching", pillar share ≈ **61%** of cluster impressions (pillar 2,252 / comparison 875 / ion-milling 511 / DRIE 50). Also: pillar position 49.3; ion-milling 19,161 impr @ 0.27%; ICP 56 clicks vs comparison 126 on "icp". A future session re-pulls GSC to score Success Metrics #1–#4 (target: pillar share >90%).

---

## Task 6: Commit provenance + spec, clean up one-shots, update memory, open PR

**Files:**
- Commit: `scripts/articles/icp-rie-technology-advanced-etching.html`, the spec + plan docs
- Delete: `scripts/rie-deconfliction-edits.ts` (if still present)
- Modify: `memory/seo_strategy.md` (record Phase 2 done + the 7-rule governance framework)

- [ ] **Step 1: Confirm one-shots are gone**

```bash
ls scripts/rie-deconfliction-edits.ts scripts/apply-icp-expansion.ts 2>&1 | grep -v "No such" || echo "one-shots removed"
```

Expected: `one-shots removed` (both deleted).

- [ ] **Step 2: Record the governance framework in memory**

Append to `memory/seo_strategy.md` under the RIE Phase 2 section: "Phase 2 DONE (2026-06-02). 7-rule RIE Cluster Governance Framework enforced (R1 RIE-def-opening pillar-only; R2 ICP-def-opening ICP-only; R3 exactly-one pillar uplink; R4 ICP 1700-2200w; R5 title ownership; R6 no generic-RIE first-H2 on non-pillar; R7 comparison pages never canonical; R8 advisory: 'ICP etcher'/'ICP-RIE' head-term + first-H2 belong to ICP page only). ICP page expanded 841→~1950w as ICP-RIE canonical. Surgical edits live in DDB only (one-shot not committed). Measure GSC in ~3-4 wks: pillar off page 5, ICP overtakes comparison for icp-rie, ion-milling impressions DOWN + CTR UP."

- [ ] **Step 3: Write the committed SEO change-log (auditability for DDB-only edits)**

Create `docs/seo/rie-phase2-change-log.md` recording, for every changed page, old→new title and old→new opening — so a future reader understands why the live pages differ from any historical source even though the 3 surgical edits aren't in any committed diff:

```markdown
# RIE Cluster Phase 2 — Change Log (2026-06-02)

Live edits applied to DynamoDB (source of truth). Surgical edits not committed as code; recorded here.

## reactive-ion-etching-vs-ion-milling (ion-milling)
- Title: unchanged — "Reactive Ion Etching vs Ion Milling (IBE): Complete Comparison Guide"
- First H2: "Introduction" → "RIE vs Ion Milling: Two Different Material-Removal Mechanisms"
- Opening: "In advanced semiconductor fabrication … dry etching plays a central role …" → "This guide compares two fundamentally different material-removal mechanisms — chemically driven RIE and physically driven Ion Milling — and shows when to choose each."

## understanding-differences-pe-rie-icp-rie-plasma-etching (comparison)
- Title: "RIE vs ICP-RIE vs PE: Plasma Etching Comparison" → "PE vs RIE vs ICP-RIE: Which Plasma Etching Process Should You Choose?"
- Opening: appended ICP-RIE canonical pointer → links to /insights/icp-rie-technology-advanced-etching

## deep-reactive-ion-etching-bosch-process (DRIE)
- Title: unchanged
- Opening: "DRIE is a specialized anisotropic etching technique that enables …" → "Deep Reactive Ion Etching (DRIE) extends conventional reactive ion etching to create extremely deep, high aspect ratio (HAR) structures …"

## icp-rie-technology-advanced-etching (ICP-RIE — canonical)
- Title: "ICP‑RIE Technology – High‑Density Plasma for Advanced Etching" → "ICP-RIE Technology: Principles, Equipment & Applications"
- Body: expanded 841 → ~1,950 words, 9 sections. Provenance HTML committed at scripts/articles/icp-rie-technology-advanced-etching.html

## reactive-ion-etching-guide (pillar) — unchanged (verify-only)
```

- [ ] **Step 4: Commit provenance + docs + change-log**

```bash
git add scripts/articles/icp-rie-technology-advanced-etching.html \
        docs/superpowers/plans/2026-06-02-rie-cluster-intent-deconfliction.md \
        docs/seo/rie-phase2-change-log.md
git commit -m "feat(seo): RIE Phase 2 deconfliction — ICP-RIE canonical expansion + plan + change-log

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Memory file is outside the repo — no `git add`. The 3 surgical edits live only in DDB by design; the change-log above is their committed audit trail.)

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin seo/rie-cluster-intent-deconfliction
gh pr create --title "SEO: RIE Cluster Intent Deconfliction (Phase 2)" --body "$(cat <<'EOF'
Repositions 5 RIE pages to one-URL-one-intent (GSC-grounded). Spec + plan in docs/superpowers.

**Live changes (DynamoDB — not in this diff, by the one-shot-not-committed convention):**
- ion-milling: contrast-frame opening + comparison-specific first H2 (top traffic leak: 19,161 impr @ 0.27% CTR)
- comparison: selection-intent title + ICP canonical link
- DRIE: "extension of RIE" opening reframe
- ICP-RIE: expanded 841 → ~1,950 words as the ICP-RIE canonical (title + 9 sections) — provenance HTML in this diff

**Governance:** 7 verifiable anti-cannibalization rules (R1–R7). Pillar verify-only.

**Measure in ~3–4 weeks:** (1) pillar lifts off page 5 for "reactive ion etching"; (2) ICP page overtakes comparison for "icp-rie"; (3) ion-milling impressions DOWN while CTR UP (junk-exposure removal = success).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created. Do NOT use `--no-verify` anywhere.

---

## Self-review notes

- **Spec coverage:** R1–R7 each have a grep in Task 2/3/5; priority order (ion-milling first) is the first EDIT and the first verify row; ICP 9-section outline + 1700–2200 (R4) in Task 3; titles (R5) in Task 1 (comparison) + Task 4 (ICP); no `update-insight-from-html` on the 3 metadata pages (only verbatim find/replace) ✓; pillar verify-only (Task 5) ✓; Success Metrics recorded (Task 5/6).
- **Idempotency:** every surgical edit has a `guard`; re-runs print `SKIP … guard present`.
- **Clobber safety:** the 3 metadata pages are touched only by scoped find/replace; ICP uses a full-content set because we authored the whole body.
- **Provenance vs live:** only the ICP page gets committed HTML (we authored it); the 3 surgical edits stay DDB-only (matches every prior content edit and avoids `update-insight-from-html` clobber) — with the committed `docs/seo/rie-phase2-change-log.md` as their audit trail.
- **v2 hardening (review feedback):** find/replace uses a whitespace/attribute-tolerant regex (`rx()`), not exact strings; RULE 3 is opening-scoped (Task 2 counts opening links, total ≥1 allowed); ICP draft passes a Technical Accuracy Review Gate (Task 3 Step 6) before going live; Success Metric #4 (query ownership, pillar share >90%) added; comparison title keeps PE/RIE/ICP-RIE in front; DRIE opening leads with "DRIE" in the first ~20 words.
