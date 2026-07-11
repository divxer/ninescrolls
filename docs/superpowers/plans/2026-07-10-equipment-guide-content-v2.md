# Equipment Guide Content Optimization v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Equipment Guide product page a benefit `lead`, a real `applications` strip, and a per-product CTA, rewrite the mechanical bullets into plain-English benefits, and rewrite the About page — all copy/data, no spec/evidence/layout change, hard 14 pages.

**Architecture:** Extend `GuideProduct` with a nested all-or-none `content` block; drive the CTA from the product's own `content.href` (validated against a canonical `PRODUCT_ROUTES` map) rendered as an absolute link; protect the untouched spec/evidence data with committed fixtures captured from a **detached** checkout of the immutable v1 baseline. Author copy pilot-first (RIE + E-Beam in an isolated worktree → review → batch all 11).

**Tech Stack:** TypeScript, Vitest, the existing Puppeteer generator + `pdftoppm`/`pypdf`.

**Spec:** `docs/superpowers/specs/2026-07-10-equipment-guide-content-v2-design.md`

## Blocking preflight (must pass before Task 1)

1. **#273 merged:** `gh pr view 273 --json state -q .state` must print `MERGED`. If not, STOP — v2 depends on v1's renderer/data being on `main`. (This is a hard gate, not a suggestion. ✅ #273 was squash-merged into `main` on 2026-07-11 as commit `9e8e4f3e`, and its head branch `feature/equipment-guide-logo` was deleted — this gate now passes.)
2. **Fresh main + rebase:** `git fetch origin --prune`; then `git rebase origin/main` this branch onto the merged v1.
3. **Pin the baseline to an immutable SHA immediately after the rebase** — do NOT keep using the moving `origin/main` ref (it can advance again before Task 1 runs). The merged-v1 tip is byte-identical to the old `f76765a8` but permanent and reachable in a fresh clone (the orphan is not):
```bash
git rev-parse --verify origin/main^{commit} >/dev/null || { echo "FAIL: origin/main not reachable"; exit 1; }
BASELINE_SHA=$(git rev-parse origin/main^{commit})   # capture ONCE, right after rebase
```
   Task 1 Step 0 persists `BASELINE_SHA` into the state dir; every fixture step checks out **that SHA**, never the live `origin/main`.

## Branch & rules
- Fixtures are generated from a **detached worktree of the pinned `BASELINE_SHA`** in Task 1 and **committed** — self-contained, no live ref dependency.
- The pilot (Task 3) is worktree-isolated and independent of sequencing.
- **One-complete-PR rule:** do not open a PR until the final state (Task 6) is complete — 11/11 required content, About, fixtures, traceability, tests, and the single regenerated PDF, in one branch.

## Ground data (used verbatim by the content tasks)

`PRODUCT_ROUTES` (guide `id` → route) and `applications = config.applications.items.slice(0, applicationCount)` (config order preserved):

| id | route | applications (first 4, verbatim, config order) | config slug |
|---|---|---|---|
| `rie` | `/products/rie-etcher` | Semiconductor R&D · Dielectric patterning · Polymer removal · Surface activation | rie-etcher |
| `icp-rie` | `/products/icp-etcher` | MEMS fabrication · Advanced packaging · Photonics · Power electronics | icp-etcher |
| `stripper` | `/products/striper` | Photoresist stripping · Plasma ashing · Post-etch residue cleaning · Organic contamination removal | striper |
| `ibe-ribe` | `/products/ibe-ribe` | Magnetic materials · Noble metal patterning · Optical device fabrication · MEMS / NEMS | ibe-ribe |
| `ald` | `/products/ald` | Gate dielectrics · Passivation layers · MEMS coatings · Energy storage materials | ald |
| `pecvd` | `/products/pecvd` | Passivation layers · Interlayer dielectrics · Optical coatings · MEMS membranes | pecvd |
| `hdp-cvd` | `/products/hdp-cvd` | STI gap-fill · IMD / PMD dielectrics · Advanced packaging dielectrics · TSV isolation workflows | hdp-cvd |
| `sputter` | `/products/sputter` | Metal contacts · Magnetic films · Optical coatings · Compound semiconductors | sputter |
| `coater-developer` | `/products/coater-developer` | Photoresist coating · HMDS priming · Developer processing · Lift-off preparation | coater-developer |
| `e-beam` | `/products/e-beam-evaporator` | Infrared image sensors · Ge/ZnS photonic crystals · UV down-conversion films · Optical AR coatings | e-beam-evaporator |
| `plasma-cleaner` | `/products/plasma-cleaner` | Surface activation · Surface cleaning · Failure analysis · Optical & biomedical device prep (pinned literals) | _(none)_ |

Each product's `lead` is rewritten from its config `hero.description` (listed in Task 4); `bullets` are rewritten from its existing guide bullets + `specs` rows. **No new performance numbers, no superlatives** — every value must already appear in the canonical `specs`.

> **PDF-commit boundary (contract):** Tasks 2/4/5 regenerate the PDF only to a **temporary** file for verification and do **NOT** stage `public/NineScrolls-Equipment-Guide.pdf`. The committed PDF is regenerated and staged **only in Task 6**, atomically with the final 11/11 state.
>
> **Pre-review note:** the 9 non-pilot products' final leads/bullets are authored during Task 4 *after* the pilot voice is locked, from the exact `hero.description` + `specs` cited inline — they are therefore not literally pre-written here (intentional, per pilot-first), while RIE + E-Beam are authored verbatim.

---

### Task 1: Baseline protection fixtures (from a detached, pinned-`BASELINE_SHA` worktree)

**Files:**
- Create: `src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json`
- Create: `src/data/equipmentGuide/__fixtures__/v1-evidence.json`
- Create: `src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html`

- [ ] **Step 0: Record the pre-existing state to a unique `mktemp` state dir (non-executable, atomic, NUL-hashed)**

Persist state as **plain, non-executable** files (never a sourced shell file) in a **unique `mktemp -d`** dir (0700 by default), written **atomically** (temp file + `mv`), and record a **NUL-delimited manifest** of the pre-existing untracked files as `hash \0 mode \0 path` — so a content change, a mode/type flip, or a path with newlines is all caught. Exclude **only** the generator's own image cache (`tmp/equipment-guide-images/`), not the rest of `tmp/`:
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
S=$(mktemp -d)                                        # unique per-run state dir (not a fixed /tmp path)
w(){ local d; d=$(mktemp "$S/.wXXXXXX"); cat > "$d"; mv -f "$d" "$S/$1"; }   # atomic write helper
git rev-parse HEAD                    | w base_sha        # IMPLEMENTATION_BASE_SHA (post-rebase HEAD)
git rev-parse origin/main^{commit}    | w baseline_sha    # pinned v1 fixture baseline (immutable SHA)
git hash-object package-lock.json     | w lockfile_hash
# NUL manifest (hash, mode, path) of pre-existing untracked files, EXCLUDING only tmp/equipment-guide-images/
# (filter in-loop with `case`, not `grep -z` — macOS BSD grep has no -z)
git ls-files --others --exclude-standard -z | sort -z \
  | while IFS= read -r -d '' f; do
      case "$f" in tmp/equipment-guide-images/*) continue;; esac
      printf '%s\0%s\0%s\0' "$(git hash-object "$f")" "$(stat -f '%p' "$f")" "$f"
    done | w untracked-manifest
# full untracked path set (incl the excluded cache dir) for a no-new-paths check
git ls-files --others --exclude-standard -z | sort -z | w untracked-paths
echo "STATE_DIR=$S"; echo "BASELINE_SHA=$(cat "$S/baseline_sha")"; echo "BASE=$(cat "$S/base_sha")"
```
Print `STATE_DIR=$S` so the executor/controller passes it to later tasks as `$STATE_DIR` (each is read + strictly validated, never executed). `baseline_sha` pins the fixture worktree; `base_sha` bounds the Task-6 allowlist diff; the manifest content-protects **all** untracked WIP (the two `research-validation-claim-reframe*` docs, plus any screenshots/audit files elsewhere under `tmp/`) except the deterministic image cache. Handles the empty set (the `while` loop yields an empty manifest, which diffs clean).

- [ ] **Step 1: Generate all three fixtures from a `mktemp -d` detached worktree of the pinned `BASELINE_SHA` (fail-fast)**

Check out the **immutable `BASELINE_SHA`** recorded in Step 0 (not the moving `origin/main`). Use a **unique `mktemp -d`** worktree path and the **locked local** `./node_modules/.bin/tsx` (never `npx`):
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
S="${STATE_DIR:?set STATE_DIR to Task 1 Step 0's printed state dir}"
BASELINE_SHA=$(cat "$S/baseline_sha")   # $(cat) drops trailing newline; embedded newline/extra bytes fail the regex
[[ "$BASELINE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "FAIL: baseline_sha not a single 40-hex line"; exit 1; }
git cat-file -e "${BASELINE_SHA}^{commit}" 2>/dev/null || { echo "FAIL: BASELINE_SHA not a reachable commit"; exit 1; }
test -x ./node_modules/.bin/tsx || { echo "FAIL: ./node_modules/.bin/tsx missing — run npm ci first"; exit 1; }
mkdir -p src/data/equipmentGuide/__fixtures__
rm -f src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json \
      src/data/equipmentGuide/__fixtures__/v1-evidence.json \
      src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html   # delete targets FIRST so a failed run can't pass on stale files
git worktree prune
WT=$(mktemp -d); rmdir "$WT"                                        # unique empty path; git worktree add creates the dir itself
trap 'git worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"' EXIT
git worktree add --detach "$WT" "$BASELINE_SHA"
OUT="$PWD/src/data/equipmentGuide/__fixtures__" BASE="$WT" ./node_modules/.bin/tsx -e '
  (async () => {
    const { writeFileSync } = await import("node:fs");
    const OUT = process.env.OUT, BASE = process.env.BASE;
    const { equipmentGuideData: d } = await import(BASE + "/src/data/equipmentGuide/index.ts");
    const { renderEquipmentGuideHtml } = await import(BASE + "/src/templates/equipmentGuide/renderEquipmentGuideHtml.ts");
    const specs = d.products.map((p) => ({ id: p.id, specs: p.specs, subTable: p.subTable ?? null }));
    writeFileSync(OUT + "/v1-specs-subtable.json", JSON.stringify(specs, null, 2) + "\n");
    writeFileSync(OUT + "/v1-evidence.json", JSON.stringify(d.evidence, null, 2) + "\n");
    const html = renderEquipmentGuideHtml(d);
    const parts = html.split("<section class=\"page");
    const ev = parts.map((c, i) => (i === 0 ? c : "<section class=\"page" + c)).find((c) => c.includes("Peer-Reviewed Validation"));
    if (!ev) throw new Error("evidence chunk not found in baseline render");
    writeFileSync(OUT + "/v1-evidence-chunk.html", ev.trim() + "\n");
  })();
'
git worktree remove --force "$WT"; trap - EXIT
for f in v1-specs-subtable.json v1-evidence.json v1-evidence-chunk.html; do
  test -s "src/data/equipmentGuide/__fixtures__/$f" || { echo "FAIL: fixture $f missing/empty"; exit 1; }
done
echo "fixtures OK"
```

- [ ] **Step 2: Sanity-check the fixtures are non-trivial**

```bash
python3 -c "import json;d=json.load(open('src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json'));print('products',len(d));assert len(d)==11"
grep -c "Peer-Reviewed Validation" src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html
grep -c "Near-ideal van der Waals" src/data/equipmentGuide/__fixtures__/v1-evidence.json
```
Expected: `products 11`, and the two greps ≥ 1.

- [ ] **Step 3: Commit the fixtures**

```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage your work before this commit"; exit 1; }
git add src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json \
        src/data/equipmentGuide/__fixtures__/v1-evidence.json \
        src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html
diff <(git diff --cached --name-only | sort) <(printf '%s\n' \
  src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html \
  src/data/equipmentGuide/__fixtures__/v1-evidence.json \
  src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json | sort) \
  || { echo "FAIL: staged set != the 3 fixtures (extra or missing)"; exit 1; }
git commit -m "test(guide): capture v1 baseline protection fixtures from detached origin/main"
```

---

### Task 2: Scaffolding — `content` type, `PRODUCT_ROUTES`, renderer, CSS (TDD red→green)

**Files:** `types.ts`, `products.ts`, `renderEquipmentGuideHtml.ts`, `equipmentGuide.css.ts`, `equipmentGuide.data.test.ts`, `renderEquipmentGuideHtml.test.ts`

- [ ] **Step 1: Write the failing scaffolding tests FIRST**

Append to `equipmentGuide.data.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCT_ROUTES } from './products';

const FIX = (f: string) => readFileSync(resolve(process.cwd(), 'src/data/equipmentGuide/__fixtures__', f), 'utf8');

describe('content-v2 scaffolding', () => {
  it('PRODUCT_ROUTES covers every product id with a /products/<slug> route', () => {
    expect(Object.keys(PRODUCT_ROUTES).sort()).toEqual(equipmentGuideData.products.map(p => p.id).sort());
    for (const p of equipmentGuideData.products) {
      expect(PRODUCT_ROUTES[p.id], p.id).toMatch(/^\/products\/[a-z0-9-]+$/);
    }
  });
  it('protects v1 specs + subTable (deep-equal committed fixture)', () => {
    const expected = JSON.parse(FIX('v1-specs-subtable.json'));
    const actual = equipmentGuideData.products.map(p => ({ id: p.id, specs: p.specs, subTable: p.subTable ?? null }));
    expect(actual).toEqual(expected);
  });
  it('protects the v1 evidence object (deep-equal committed fixture)', () => {
    expect(equipmentGuideData.evidence).toEqual(JSON.parse(FIX('v1-evidence.json')));
  });
});
```
Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: **FAIL** — `PRODUCT_ROUTES` import can't resolve (not exported yet). (Protection tests would pass, but the file won't load until the export exists — this is the red.)

- [ ] **Step 2: Add the type + `PRODUCT_ROUTES` (→ green for data tests)**

In `types.ts` add:
```ts
export interface GuideProductContent {
  lead: string;
  applications: string[];
  applicationCount: 3 | 4;
  href: string; // site-relative, e.g. '/products/rie-etcher'
}
```
and `content?: GuideProductContent;` on `GuideProduct` (optional for the pilot/batch; required in Task 6).
In `products.ts`, above the `products` array:
```ts
export const PRODUCT_ROUTES: Record<string, string> = {
  rie: '/products/rie-etcher', 'icp-rie': '/products/icp-etcher', stripper: '/products/striper',
  'ibe-ribe': '/products/ibe-ribe', ald: '/products/ald', pecvd: '/products/pecvd',
  'hdp-cvd': '/products/hdp-cvd', sputter: '/products/sputter', 'coater-developer': '/products/coater-developer',
  'plasma-cleaner': '/products/plasma-cleaner', 'e-beam': '/products/e-beam-evaporator',
};
```
Run the data test → **PASS** (route + both protection tests).

- [ ] **Step 3: Write the failing render tests FIRST**

Append to `renderEquipmentGuideHtml.test.ts` (add a `fixTrim` helper that reads `src/data/equipmentGuide/__fixtures__/<f>` and `.trim()`s it):
```ts
import { PRODUCT_ROUTES } from '../../data/equipmentGuide/products';

describe('content-v2 render', () => {
  const chunks = html.split('<section class="page').slice(1);
  it('stamps data-product-id on every product section', () => {
    for (const p of equipmentGuideData.products) {
      expect(chunks.some(c => c.includes(`data-product-id="${p.id}"`)), p.id).toBe(true);
    }
  });
  const CTA_ANCHOR = /<a class="btn" href="([^"]+)">([\s\S]*?)<\/a>/g;
  const CTA_TEXT = 'Explore configurations &amp; request a quote <span class="arr">→</span>';

  it('CTA path (synthetic, reds first): a product WITH content renders exactly one correct anchor', () => {
    const first = equipmentGuideData.products[0];
    const withContent = {
      ...equipmentGuideData,
      products: equipmentGuideData.products.map((p, i) => i === 0
        ? { ...p, content: { lead: 'L', applications: ['A', 'B', 'C'], applicationCount: 3 as const, href: PRODUCT_ROUTES[p.id] } }
        : p),
    };
    const chunk = renderEquipmentGuideHtml(withContent).split('<section class="page').find(c => c.includes(`data-product-id="${first.id}"`))!;
    const anchors = [...chunk.matchAll(CTA_ANCHOR)];
    expect(anchors).toHaveLength(1);
    expect(anchors[0][1]).toBe(`https://ninescrolls.com${PRODUCT_ROUTES[first.id]}`); // canonical route, not any /products/…
    expect(anchors[0][2]).toBe(CTA_TEXT);                                            // exact text, not toContain
  });

  it('real products: exactly one CTA per content product, canonical route + exact text', () => {
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
      const anchors = [...chunk.matchAll(CTA_ANCHOR)];
      if (p.content) {
        expect(anchors.length, p.id).toBe(1);
        expect(anchors[0][1], p.id).toBe(`https://ninescrolls.com${PRODUCT_ROUTES[p.id]}`);
        expect(anchors[0][2], p.id).toBe(CTA_TEXT);
      } else {
        expect(anchors.length, p.id).toBe(0);
      }
    }
  });
  it('keeps the Evidence page string-identical to the v1 fixture', () => {
    const ev = chunks.map(c => '<section class="page' + c).find(c => c.includes('Peer-Reviewed Validation'))!.trim();
    // note: split() dropped the delimiter; re-prepend it, then compare to the committed chunk
    expect(ev).toBe(fixTrim('v1-evidence-chunk.html'));
  });
});
```
Run: expect **FAIL** — no `data-product-id`, no CTA markup. (The Evidence-fixture test should already pass; the split re-prepend must reproduce the exact stored chunk — adjust the split/prepend so it matches the fixture exactly.)

- [ ] **Step 4: Implement the renderer changes (→ green)**

In `renderEquipmentGuideHtml.ts`: add `const SITE_ORIGIN = 'https://ninescrolls.com';`. In `productPage(p, imageDataUri)`:
- Change the section open tag to `<section class="page page--product" data-product-id="${p.id}">`.
- After the `.section-accent` / title, insert the lead when present: `${p.content ? `<p class="lead">${esc(p.content.lead)}</p>` : ''}`.
- Build apps + cta (the anchor uses the product's OWN `content.href`, not the map — the data test proves they're equal):
```ts
const apps = p.content ? `<div class="apps"><p class="lab">Typical applications</p><div class="chips">${p.content.applications.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>` : '';
const cta = p.content ? `<div class="cta"><a class="btn" href="${SITE_ORIGIN}${p.content.href}">Explore configurations &amp; request a quote <span class="arr">→</span></a></div>` : '';
```
Place `${apps}${cta}` before the `.page-foot`. Do not touch `evidencePage`/`aboutPage`/`contactPage`. Run tests → **PASS**.

- [ ] **Step 5: CSS — `.lead`, `.apps`/`.chip`, `.cta`/`.btn` (body ≥ 12.5px)**

Append to `equipmentGuide.css.ts` (chips are new **body content** → ≥12.5px per the min-font contract; `.lab` is a label like the existing `.eyebrow`, kept small):
```css
.lead { font-size: 13px; color: #334155; margin: 0 0 12px; max-width: 52ch; }
.apps { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #f7f9fc; border: 1px solid #eef2f7; }
.apps .lab { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8a97a6; margin: 0 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12.5px; font-weight: 600; color: #1e3a5f; background: #fff; border: 1px solid #e6ebf1; border-radius: 999px; padding: 3px 10px; }
.cta { margin-top: 12px; }
.cta .btn { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; background: #0284c7; color: #fff; font-weight: 700; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; }
```

- [ ] **Step 6: Run + commit scaffolding (NO PDF)**

Run: `npx vitest run src/data/equipmentGuide src/templates/equipmentGuide --exclude '**/.claude/**'` → all green (CTA tests pass because no product has `content` yet → 0 CTAs everywhere).
```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage your work before this commit"; exit 1; }
git add src/data/equipmentGuide/types.ts src/data/equipmentGuide/products.ts \
        src/data/equipmentGuide/equipmentGuide.data.test.ts \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.ts \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
        src/templates/equipmentGuide/equipmentGuide.css.ts
diff <(git diff --cached --name-only | sort) <(printf '%s\n' \
  src/data/equipmentGuide/equipmentGuide.data.test.ts \
  src/data/equipmentGuide/products.ts \
  src/data/equipmentGuide/types.ts \
  src/templates/equipmentGuide/equipmentGuide.css.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.ts | sort) \
  || { echo "FAIL: staged set != scaffolding files (extra or missing)"; exit 1; }
git commit -m "feat(guide): content-v2 scaffolding — content type, PRODUCT_ROUTES, data-product-id + lead/apps/cta renderer, protection guards"
```

---

### Task 3: Pilot (RIE + E-Beam) — ISOLATED worktree, review-only, never pushed

**Files (throwaway worktree only):** `products.ts`.

- [ ] **Step 1: Isolated pilot worktree**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
git worktree add .claude/worktrees/eqg-v2-pilot -b eqg-v2-pilot-throwaway HEAD
cd .claude/worktrees/eqg-v2-pilot
```

- [ ] **Step 2: Author RIE + E-Beam `content` + rewritten bullets (final wording)**

RIE (`id: 'rie'`):
```ts
content: {
  lead: 'Reliable anisotropic plasma etching for university and R&D labs — dielectric patterning, polymer removal, surface activation, and device prototyping across silicon, compound, and 2D materials.',
  applications: ['Semiconductor R&D', 'Dielectric patterning', 'Polymer removal', 'Surface activation'],
  applicationCount: 4,
  href: '/products/rie-etcher',
},
bullets: [
  { heading: 'Broad material range.', body: 'Si-based films, compounds (InP/GaN/GaAs), 2D materials, and metals — plus failure-analysis work — in one chamber.' },
  { heading: 'Wide, repeatable process window.', body: '300–1000 W RF, 4 gas lines, and a −70 to 200 °C stage; non-uniformity under ±5% (edge exclusion).' },
  { heading: 'Low-damage by design.', body: 'Showerhead gas feed and a configurable discharge gap give gentle, tunable etch profiles.' },
  { heading: 'Lab-ready and configurable.', body: '1.0 × 1.0 m footprint; open-load or load-lock; cost- or performance-optimized builds.' },
],
```
E-Beam (`id: 'e-beam'`) — **uniformity is `≤±5% within Φ6 in` (canonical, post-audit); do NOT write ±3–5%:**
```ts
content: {
  lead: 'Multi-source e-beam and thermal evaporation for optical and IR research — photonic crystals, optical multilayers, IR sensors, and lift-off metallization at research-grade purity.',
  applications: ['Infrared image sensors', 'Ge/ZnS photonic crystals', 'UV down-conversion films', 'Optical AR coatings'],
  applicationCount: 4,
  href: '/products/e-beam-evaporator',
},
bullets: [
  { heading: 'Two evaporation sources.', body: 'E-beam plus thermal resistance for metals, oxides, fluorides, and IR films.' },
  { heading: 'Precise thickness control.', body: 'In-situ QCM endpoint monitoring; uniformity ≤±5% within Φ6 in.' },
  { heading: 'Optical and IR stacks ready.', body: 'High-purity films for photonic crystals, optical multilayers, and IR sensors.' },
  { heading: 'Flexible operation.', body: 'Manual, semi-automatic, or full-automatic; suited to lift-off metallization and patterning.' },
],
```

- [ ] **Step 3: Regenerate + screenshot the two pilot pages**

This runs inside the throwaway pilot worktree (Step 1), so regenerating its `public/…pdf` is safe — the whole worktree is discarded in Step 4:
```bash
SHOT=$(mktemp -d)
npm run generate-equipment-guide
python3 -c "from pypdf import PdfReader; print('pages', len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages))"
pdftoppm -jpeg -r 100 public/NineScrolls-Equipment-Guide.pdf "$SHOT/p"; echo "page images in $SHOT"
```
Read the RIE page (p3) and E-Beam page (p13) images. **Pilot acceptance:** both single-page, guide == 14 pages, no crowding, no table compressed illegibly, no body text < 12.5px.

- [ ] **Step 4: Review checkpoint (STOP), then discard the worktree**

Present the two pilot pages to the user; get voice/format sign-off. **Nothing here is committed/pushed/merged.** After approval:
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
git worktree remove --force .claude/worktrees/eqg-v2-pilot
git branch -D eqg-v2-pilot-throwaway
```

---

### Task 4: Batch — all 11 products' content + rewritten bullets (real branch, TDD)

**Files:** `products.ts`, `equipmentGuide.data.test.ts`, `docs/equipment-guide/content-v2-traceability.md`

- [ ] **Step 1: Write the failing content-integrity tests FIRST**

Append to `equipmentGuide.data.test.ts`:
```ts
const PLASMA_CLEANER_APPS = ['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep'];

describe('content-v2 content integrity', () => {
  it('all 11 products have a content block — no product may be skipped', () => {
    expect(equipmentGuideData.products).toHaveLength(11);
    for (const p of equipmentGuideData.products) expect(p.content, p.id).toBeTruthy();
  });
  it('applications = config.applications.items.slice(0, applicationCount), verbatim & ordered', () => {
    for (const p of equipmentGuideData.products) {
      const c = p.content!; // guaranteed present by the completeness test above
      expect([3, 4]).toContain(c.applicationCount);
      expect(c.applications).toHaveLength(c.applicationCount);
      if (p.id === 'plasma-cleaner') {
        expect(c.applicationCount).toBe(4);            // pinned family list is exactly 4, never 3
        expect(c.applications).toEqual(PLASMA_CLEANER_APPS);
        continue;
      }
      const cfg = WEBSITE_CONFIGS[p.websiteSpecParity!.productSlug as keyof typeof WEBSITE_CONFIGS];
      expect(c.applications).toEqual(cfg.applications.items.slice(0, c.applicationCount));
    }
  });
  it('content.href equals the canonical route and is site-relative', () => {
    for (const p of equipmentGuideData.products) {
      expect(p.content!.href).toBe(PRODUCT_ROUTES[p.id]);
      expect(p.content!.href).toMatch(/^\/products\/[a-z0-9-]+$/);
    }
  });
  it('every product has 3–4 bullets', () => {
    for (const p of equipmentGuideData.products) {
      expect(p.bullets.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.bullets.length, p.id).toBeLessThanOrEqual(4);
    }
  });
});
```
Run → **FAIL** — the completeness test reds until all 11 have `content`; parity/bullets red for any not-yet-authored product. (This is the real red that drives the whole batch, including the optional→required tightening in Step 5.)

- [ ] **Step 2: Author `content` + rewritten bullets for all 11 (→ green)**

Add the voice-locked RIE + E-Beam content from Task 3, and author the other 9 the same way: `content.lead` rewritten from the `hero.description` below (≤2 lines, no new numbers/superlatives), `content.applications` = the first-4 list from the Ground-data table (verbatim, config order), `content.applicationCount` = 4 (only drop to 3 if Step 4 shows overflow), `content.href = PRODUCT_ROUTES[id]`; `bullets` = 3–4 benefits rewritten from that product's existing guide bullets + `specs` rows (every number must already be in `specs`).

Source `hero.description` for the 9:
- **icp-rie:** "High-density plasma etching for silicon, MEMS, diamond, compound semiconductors, and process development where independent plasma density and ion energy control are critical."
- **stripper:** "Dedicated plasma stripping and ashing for photoresist removal, post-etch residue cleaning, organic contamination removal, and damage-sensitive semiconductor process flows."
- **ibe-ribe:** "Directional ion beam etching and reactive ion beam etching for magnetic films, noble metals, optical materials, multilayer stacks, and difficult-to-etch research materials."
- **ald:** "Atomic-level thin film deposition for conformal coatings, high-k dielectrics, passivation layers, 3D structures, and research material stacks."
- **pecvd:** "Low-temperature plasma-enhanced CVD for dielectric films, passivation layers, optical coatings, MEMS stacks, and research thin-film process development."
- **hdp-cvd:** "High-density plasma CVD for dense dielectric films, void-free trench fill, STI, IMD, PMD, and advanced packaging process development."
- **sputter:** "Physical vapor deposition for metal, dielectric, nitride, oxide, magnetic, optical, and compound thin films using configurable DC/RF magnetron sputtering sources."
- **coater-developer:** "Modular spin coating, development, hotplate, HMDS, and EBR process control for repeatable photolithography workflows from research wafers to pilot-line substrates."
- **plasma-cleaner:** author `lead`/`bullets` from the guide's own `plasma-cleaner` Main Functions / Typical Applications rows (no config); `content.applications` = the pinned literals `['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep']`.

Run the data test → **PASS**.

- [ ] **Step 3: Fill the traceability record**

Create `docs/equipment-guide/content-v2-traceability.md`; one row per `lead` and per `bullet` per product, citing its source (config `hero.description`, an original guide bullet, or a `specs`/`subTable` row). Example (RIE):
```
## rie
- lead ← rieEtcherConfig.hero.description
- bullet "Broad material range" ← specs row "Etching Materials"
- bullet "Wide, repeatable process window" ← specs rows RF Power / Gas System / Wafer Stage Temp / Non-Uniformity
- bullet "Low-damage by design" ← original bullets "Showerhead Gas Feed-in" + "Configurable Plasma Discharge Gap"
- bullet "Lab-ready and configurable" ← original bullets "Uni-body … footprint" + "Sample Handling" + "Cost or Performance"
## e-beam
- lead ← eBeamEvaporatorConfig.hero.description
- bullet "Precise thickness control" ← specs rows "Thickness Control" + "Uniformity" (≤±5% within Φ6 in)
- …
```

- [ ] **Step 4: BLOCKING traceability review (STOP — do not proceed until it passes)**

Before committing, go through `content-v2-traceability.md` **line by line** and verify each `lead` and `bullet` against the source it cites — confirm the claim actually appears in that config `hero.description` / original guide bullet / `specs` row, that **no performance number was introduced that isn't already in `specs`**, and that there are **no superlatives**. (Cross-check `e-beam` bullet 2 against the `Uniformity` spec row: it must read `≤±5% within Φ6 in`, never `±3–5%`.) If executing via subagents, this is a human/controller checkpoint, not an automated test — the traceability file is the artifact reviewed. Fix any drift in `products.ts` + the traceability file before continuing.

- [ ] **Step 5: Tighten `content` to required + remove ALL optional-content branches**

In `types.ts` change `content?: GuideProductContent;` → `content: GuideProductContent;`.
In `renderEquipmentGuideHtml.ts`, `content` is now guaranteed — drop the `p.content ? … : ''` guards; render lead/apps/cta unconditionally:
```ts
const lead = `<p class="lead">${esc(p.content.lead)}</p>`;
const apps = `<div class="apps"><p class="lab">Typical applications</p><div class="chips">${p.content.applications.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>`;
const cta = `<div class="cta"><a class="btn" href="${SITE_ORIGIN}${p.content.href}">Explore configurations &amp; request a quote <span class="arr">→</span></a></div>`;
```
In `renderEquipmentGuideHtml.test.ts`, **delete** the `real products: … else expect 0` CTA test (its zero-branch is now unreachable) and replace it with a required-content assertion — exactly one CTA for every product (keep the synthetic red-first test):
```ts
it('renders exactly one CTA per product (content required), canonical route + exact text', () => {
  for (const p of equipmentGuideData.products) {
    const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
    const anchors = [...chunk.matchAll(CTA_ANCHOR)];
    expect(anchors.length, p.id).toBe(1);
    expect(anchors[0][1], p.id).toBe(`https://ninescrolls.com${PRODUCT_ROUTES[p.id]}`);
    expect(anchors[0][2], p.id).toBe(CTA_TEXT);
  }
});
```
Run `tsc` + the suite → green with all 11 authored; a product missing `content` now fails to compile. (Task 6 does not touch the type or these branches.)

- [ ] **Step 6: Regenerate to a temp check (do NOT stage the PDF), then commit data + types + tests + traceability**

Verify to a **temporary** PDF. The generator always overwrites `public/…pdf`, so back up the **exact working-tree bytes** to a private temp and restore by `cp` (never `git checkout --`, which would silently destroy any uncommitted PDF edit). Refuse to run if the PDF is already dirty, and install an `EXIT` trap so a mid-run failure still restores:
```bash
set -euo pipefail
PROD=public/NineScrolls-Equipment-Guide.pdf
git diff --quiet -- "$PROD" && git diff --cached --quiet -- "$PROD" \
  || { echo "FAIL: $PROD has uncommitted changes — resolve before regenerating"; exit 1; }
ORIG=$(git hash-object "$PROD")                      # committed bytes we must restore to
SHOT=$(mktemp -d)                                   # persists after this block for image inspection
BK=$(mktemp -d)/before.pdf; cp "$PROD" "$BK"        # exact pre-gen bytes
trap 'cp "$BK" "'"$PROD"'" 2>/dev/null' EXIT        # backstop restore on any failure below
npm run generate-equipment-guide                    # overwrites $PROD
GEN=$(git hash-object "$PROD")
cp "$PROD" "$SHOT/check.pdf"                         # snapshot the v2-content render for verification
[ "$(git hash-object "$PROD")" = "$GEN" ] || { echo "FAIL: $PROD changed under us mid-verify"; exit 1; }
cp "$BK" "$PROD"                                     # restore exact pre-gen bytes
[ "$(git hash-object "$PROD")" = "$ORIG" ] || { echo "FAIL: tracked PDF not restored to committed bytes"; exit 1; }
git diff --quiet -- "$PROD" || { echo "FAIL: tracked PDF still shows as modified"; exit 1; }
trap - EXIT                                          # success: release trap so shell-exit won't re-copy over a later change
PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('$SHOT/check.pdf').pages))")
[ "$PAGES" = "14" ] || { echo "FAIL: $PAGES pages (want 14)"; exit 1; }
pdftoppm -jpeg -r 100 "$SHOT/check.pdf" "$SHOT/p"    # inspect ALL 14 for clipping/overflow
echo "page images in $SHOT"
```
If any product overflows, apply the spec's reduction order (compress bullets → shorten lead → `applicationCount` 4→3 for a **config-backed** product only, never plasma-cleaner → tighten spacing; never <12.5px body, never spill). Then commit **without the PDF** (it lands in Task 6). The overflow flow may edit CSS spacing, so include the CSS **only if it actually changed**; stage the explicit set and verify it exactly, so nothing pre-staged (or the PDF/lockfile) rides along:
```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage before this commit"; exit 1; }   # never silently reset user staging
FILES="src/data/equipmentGuide/products.ts src/data/equipmentGuide/types.ts \
src/data/equipmentGuide/equipmentGuide.data.test.ts docs/equipment-guide/content-v2-traceability.md \
src/templates/equipmentGuide/renderEquipmentGuideHtml.ts src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts"
CSS=src/templates/equipmentGuide/equipmentGuide.css.ts
git diff --quiet -- "$CSS" || FILES="$FILES $CSS"   # a spacing tweak from the overflow flow is allowed here
git add $FILES
diff <(git diff --cached --name-only | sort) <(printf '%s\n' $FILES | sort) \
  || { echo "FAIL: staged set != intended files (extra or missing)"; exit 1; }
git commit -m "feat(guide): content-v2 — leads, applications, CTAs, rewritten bullets for all 11 products; content required"
```

---

### Task 5: About page rewrite (TDD, no PDF commit)

**Files:** `guideMeta.ts`, `equipmentGuide.data.test.ts`

- [ ] **Step 1: Write the failing About test FIRST**

Append to `equipmentGuide.data.test.ts`:
```ts
describe('content-v2 about', () => {
  it('keeps exactly 2 paragraphs + 4 fixed pillars', () => {
    expect(about.paragraphs).toHaveLength(2);
    expect(about.pillars).toHaveLength(4);
    expect(about.pillars.map(p => p.heading)).toEqual([
      'Process-first platform selection',
      'Configured around your lab',
      'U.S.-based project coordination and support',
      'Peer-reviewed validation for represented platforms',
    ]);
  });
  it('states the exact represented-platform attribution boundary in pillar 4', () => {
    expect(about.pillars[3].body).toBe('The corresponding platform classes appear in real peer-reviewed research — validating the process capability, not NineScrolls-owned equipment or NineScrolls-authored papers.');
  });
  it('has no forbidden claims or OEM names', () => {
    const t = JSON.stringify(about);
    expect(t).not.toMatch(/\d+\+\s*years|years of experience|installations|research institutions served|\bcustomers\b/i);
    expect(t).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
  });
});
```
Run → **FAIL** (current About still has the old boilerplate + pillars).

- [ ] **Step 2: Rewrite `about` (→ green)**

```ts
export const about: EquipmentGuideData['about'] = {
  title: 'About NineScrolls LLC',
  subtitle: 'U.S.-based process-equipment selection, configuration, and support',
  paragraphs: [
    'NineScrolls LLC helps universities, national laboratories, and R&D and advanced-manufacturing teams across the United States select, configure, and support semiconductor process equipment. We start from the work — your materials, target process window, sample size, and facility conditions — and match the platform to it, rather than starting from a catalog.',
    'As a U.S.-based partner, we coordinate selection, configuration, quoting, delivery, and after-sales support so a research team gets a process-ready platform and a local point of contact.',
  ],
  pillars: [
    { heading: 'Process-first platform selection', body: 'We confirm materials, process window, sample size, and facility conditions first, then match the platform — not the other way around.' },
    { heading: 'Configured around your lab', body: 'Platforms are specified to your throughput, wafer sizes, gases, and space, rather than sold as a fixed SKU.' },
    { heading: 'U.S.-based project coordination and support', body: 'Selection, configuration, quoting, delivery, and after-sales support are coordinated locally.' },
    { heading: 'Peer-reviewed validation for represented platforms', body: 'The corresponding platform classes appear in real peer-reviewed research — validating the process capability, not NineScrolls-owned equipment or NineScrolls-authored papers.' },
  ],
};
```
Run tests → **PASS**. Verify to a temp PDF using the **same safe backup/restore pattern as Task 4 Step 6** (refuse-dirty → `mktemp` byte backup → `EXIT` trap → `cp` restore, never `git checkout --`), confirming the About page still fits one page and the guide == 14:
```bash
set -euo pipefail
PROD=public/NineScrolls-Equipment-Guide.pdf
git diff --quiet -- "$PROD" && git diff --cached --quiet -- "$PROD" \
  || { echo "FAIL: $PROD has uncommitted changes — resolve before regenerating"; exit 1; }
ORIG=$(git hash-object "$PROD")
SHOT=$(mktemp -d); BK=$(mktemp -d)/before.pdf; cp "$PROD" "$BK"
trap 'cp "$BK" "'"$PROD"'" 2>/dev/null' EXIT
npm run generate-equipment-guide
GEN=$(git hash-object "$PROD"); cp "$PROD" "$SHOT/check.pdf"
[ "$(git hash-object "$PROD")" = "$GEN" ] || { echo "FAIL: $PROD changed under us mid-verify"; exit 1; }
cp "$BK" "$PROD"
[ "$(git hash-object "$PROD")" = "$ORIG" ] || { echo "FAIL: tracked PDF not restored to committed bytes"; exit 1; }
git diff --quiet -- "$PROD" || { echo "FAIL: tracked PDF still shows as modified"; exit 1; }
trap - EXIT                                          # success: release trap
PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('$SHOT/check.pdf').pages))")
[ "$PAGES" = "14" ] || { echo "FAIL: $PAGES pages"; exit 1; }
pdftoppm -jpeg -r 100 "$SHOT/check.pdf" "$SHOT/p"   # confirm About page (p1) fits one page
echo "page images in $SHOT"
```
Commit **without the PDF**, staging only the two intended files and verifying the staged set:
```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage your work before this commit"; exit 1; }
git add src/data/equipmentGuide/guideMeta.ts src/data/equipmentGuide/equipmentGuide.data.test.ts
diff <(git diff --cached --name-only | sort) <(printf '%s\n' \
  src/data/equipmentGuide/equipmentGuide.data.test.ts \
  src/data/equipmentGuide/guideMeta.ts | sort) \
  || { echo "FAIL: staged set != intended files (extra or missing)"; exit 1; }
git commit -m "feat(guide): rewrite About page to NineScrolls' real value (process-first, U.S. support)"
```

---

### Task 6: Finalize — full verification + atomic PDF commit

**Files:** `public/NineScrolls-Equipment-Guide.pdf` (the only new committed file; `content` is already required after Task 4).

- [ ] **Step 1: Tests + build (fail hard)**

```bash
npx vitest run --exclude '**/.claude/**' || { echo "FAIL: tests"; exit 1; }
npm run build || { echo "FAIL: build"; exit 1; }
```

- [ ] **Step 2: Regenerate + hard PDF asserts (each exits 1 on breach)**

```bash
set -euo pipefail
PROD=public/NineScrolls-Equipment-Guide.pdf
git diff --quiet -- "$PROD" && git diff --cached --quiet -- "$PROD" \
  || { echo "FAIL: $PROD dirty/staged before final regen — resolve first"; exit 1; }   # same refuse-dirty guard as Tasks 4/5
SHOT=$(mktemp -d)
npm run generate-equipment-guide || { echo "FAIL: generate"; exit 1; }
PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages))")
[ "$PAGES" = "14" ] || { echo "FAIL: $PAGES pages (want 14)"; exit 1; }
BYTES=$(python3 -c "import os; print(os.path.getsize('public/NineScrolls-Equipment-Guide.pdf'))")
[ "$BYTES" -lt 2000000 ] || { echo "FAIL: $BYTES bytes >= 2000000"; exit 1; }
pdftoppm -jpeg -r 100 public/NineScrolls-Equipment-Guide.pdf "$SHOT/p"; echo "page images in $SHOT"
```
Then read all 14 page images: every product page single, no clipping/overflow, no body text < 12.5px, Evidence + Contact + all spec tables visually unchanged. (Task 6 intentionally writes the real production PDF — it is committed next.)

- [ ] **Step 3: Commit the final PDF (stage only the PDF; verify the staged set)**

```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage before this commit"; exit 1; }   # never silently reset user staging
git add public/NineScrolls-Equipment-Guide.pdf
STAGED=$(git diff --cached --name-only)
[ "$STAGED" = "public/NineScrolls-Equipment-Guide.pdf" ] || { echo "FAIL: unexpected staged files: $STAGED"; exit 1; }
git commit -m "feat(guide): regenerate final Equipment Guide PDF with content-v2"
```

- [ ] **Step 4: Hygiene audit (post-commit; every breach exits 1)**

Read the Task 1 Step 0 state from **plain, non-executable** files (never `source`), strictly validate them (exact single-line 40-hex — a valid SHA plus an extra line must NOT pass), then audit committed + working-tree + untracked with a **two-way** allowlist compare and a **NUL content+mode** untracked check:
```bash
set -euo pipefail
S="${STATE_DIR:?set STATE_DIR to Task 1 Step 0's printed state dir}"
test -d "$S" || { echo "FAIL: state dir $S missing (re-run Task 1 Step 0)"; exit 1; }
# rdsha: strict — $(cat) drops the trailing newline; any embedded newline/extra bytes fail the whole-string regex
rdsha(){ local v; v=$(cat "$1"); [[ "$v" =~ ^[0-9a-f]{40}$ ]] && printf '%s' "$v"; }
BASE=$(rdsha "$S/base_sha")     || { echo "FAIL: base_sha not a single 40-hex line"; exit 1; }
LOCK=$(rdsha "$S/lockfile_hash") || { echo "FAIL: lockfile_hash not a single 40-hex line"; exit 1; }
git cat-file -e "${BASE}^{commit}" 2>/dev/null || { echo "FAIL: base_sha not a reachable commit"; exit 1; }
# (a) lockfile unchanged
[ "$(git hash-object package-lock.json)" = "$LOCK" ] || { echo "FAIL: package-lock.json changed"; exit 1; }
# (b) NO uncommitted tracked drift (staged or unstaged) — everything is committed
test -z "$(git status --porcelain --untracked-files=no)" || { echo "FAIL: uncommitted tracked changes:"; git status --porcelain --untracked-files=no; exit 1; }
# (c) protected untracked WIP byte+mode-unchanged — recompute the SAME NUL manifest (excludes ONLY tmp/equipment-guide-images/)
git ls-files --others --exclude-standard -z | sort -z \
  | while IFS= read -r -d '' f; do
      case "$f" in tmp/equipment-guide-images/*) continue;; esac
      printf '%s\0%s\0%s\0' "$(git hash-object "$f")" "$(stat -f '%p' "$f")" "$f"
    done > "$S/untracked-now"
cmp -s "$S/untracked-manifest" "$S/untracked-now" || { echo "FAIL: a protected untracked file changed/added/removed"; exit 1; }
# (c2) no NEW untracked paths anywhere (incl the excluded cache dir)
git ls-files --others --exclude-standard -z | sort -z > "$S/untracked-paths-now"
cmp -s "$S/untracked-paths" "$S/untracked-paths-now" || { echo "FAIL: untracked path set changed"; exit 1; }
# (d) committed change set BASE..HEAD == EXACTLY the allowlist (two-way diff: extra OR missing both fail)
git diff --name-only "${BASE}..HEAD" | sort -u > "$S/changed"
printf '%s\n' \
  docs/equipment-guide/content-v2-traceability.md \
  public/NineScrolls-Equipment-Guide.pdf \
  src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html \
  src/data/equipmentGuide/__fixtures__/v1-evidence.json \
  src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json \
  src/data/equipmentGuide/equipmentGuide.data.test.ts \
  src/data/equipmentGuide/guideMeta.ts \
  src/data/equipmentGuide/products.ts \
  src/data/equipmentGuide/types.ts \
  src/templates/equipmentGuide/equipmentGuide.css.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.ts | sort -u > "$S/allow"
diff "$S/allow" "$S/changed" || { echo "FAIL: committed file set != allowlist (extra or MISSING files)"; exit 1; }
echo "hygiene OK — ready for PR"
```
(`BASE` is the HEAD recorded at Task 1 Step 0 — after the spec/plan commits — so `BASE..HEAD` is exactly the Task 1–6 implementation files; the two-way `diff` fails on any missing OR extra file. If it fails, fix + amend before opening the PR.)

---

## Self-Review

**1. Spec coverage:** data model incl. optional→required (Task 2 + Task 4 Step 5) ✓; copy rules + applications ordered-parity + plasma-cleaner **exactly 4** literals + completeness-first no-skip (Task 4 Step 1) ✓; CTA absolute + **canonical `PRODUCT_ROUTES[id]`** + `data-product-id` + same-anchor **exact-text** binding + synthetic red-first (Task 2 Step 3) ✓; all-or-none nested content + pilot isolation + one-complete-PR (Task 2/3/6) ✓; blocking preflight (#273 merged → rebase → **pin `BASELINE_SHA` once**, immutable) ✓; protection fixtures from a **`mktemp -d` detached `BASELINE_SHA`** worktree, committed, no auto-snapshot, fail-fast one-block command (Task 1) ✓; About rewrite + exact evidence-pillar body + 2-para/4-pillar lock (Task 5) ✓; traceability doc + **blocking line-by-line review** (Task 4 Steps 3–4) ✓; page policy hard-14/≥12.5px/all-14 screenshots (Task 3/4/6) ✓; PDF committed only in Task 6 — Tasks 4/5/6 refuse-dirty + `mktemp` byte-backup + hash-verified restore + **`trap - EXIT` release**, verify to a temp copy, don't stage (4/5) ✓; every commit **fails on a non-empty index** (never `git reset`) + explicit `git add` + staged-set `diff` guard (CSS included in Task 4 only if it actually changed) ✓; **exit-1** page/size asserts + hygiene from a **unique `mktemp` state dir** (atomic writes; strict single-line-40-hex `[[ =~ ]]` + `git cat-file -e`), **NUL content+mode** untracked manifest excluding only `tmp/equipment-guide-images/`, no staged/unstaged drift, two-way `diff` allowlist (Task 6 Steps 2–4) ✓.

**2. Placeholder scan:** RIE + E-Beam pilot copy is authored verbatim (with the corrected E-Beam uniformity). The 9 batch leads/bullets are authored in Task 4 from the exact `hero.description` + `specs` cited inline — intentional per pilot-first, not a vague TODO. No "TBD".

**3. Type/name consistency:** `GuideProductContent` (lead/applications/applicationCount/href), `PRODUCT_ROUTES`, `SITE_ORIGIN`, `data-product-id`, `content?`→`content`, `WEBSITE_CONFIGS` (v1), `fixTrim`, the `<section class="page` split, and `esc()` are consistent across tasks. TDD is red→green in every task (test appended and run-to-fail before the implementing edit).
