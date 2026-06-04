# Gate-1 Citation Monitoring Automation v1 (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable `npx tsx scripts/citation-sweep.ts` that sweeps OpenAlex + Crossref for papers citing NineScrolls equipment, dedupes against a ledger, grades/scores them (A1-confirmed/probable/unverified), and writes a ranked `weekly-candidate-queue.md` — candidates only, no writing/publishing/outreach.

**Architecture:** Two layers. (1) A deterministic, unit-tested **script** — pure-TS modules under `scripts/citation-monitor/` orchestrated by a thin `scripts/citation-sweep.ts` entry (detect/classify/score/dedupe are pure and tested; API clients are thin with mocked `fetch`; persistence = plain repo files under `docs/seo/publication-spotlight/`, no DynamoDB/Lambda). (2) A **Claude Cowork scheduled task** (Task 9) that is the *weekly trigger* — it runs the script, commits the refreshed queue, and reports A1-confirmed candidates. The script is built/proven first; the schedule wires it last. Gmail Scholar-Alert ingestion and outreach are **out of scope (v1.1+)** — but the Cowork-task host is chosen precisely so those agentic steps can be added to the routine's prompt later.

**Tech Stack:** TypeScript, `tsx` (run), `vitest` (`npm test`, co-located `*.test.ts`, jsdom env), global `fetch` (Node 23). No new dependencies. No API keys (OpenAlex + Crossref are open; pass `mailto=info@ninescrolls.com` for the polite pool).

**Spec:** `docs/superpowers/specs/2026-06-04-publication-spotlight-engine-design.md` (Gate-1 section + build order 1–5).

**Branch:** `docs/publication-spotlight-engine` (current; spec already committed here).

---

## File structure (created by this plan)

```
scripts/
  citation-sweep.ts                     # entry/orchestrator (CLI: --dry-run, --since=YYYY-MM-DD)
  citation-monitor/
    types.ts                            # RawWork, Candidate, LedgerEntry, A1Grade
    config.ts                           # models, generic-model set, vendor, top journals, US hints, score weights
    classify.ts                         # detectMatches() + classify() (A1 grading + confidence)
    score.ts                            # scoreCandidate()
    dedupe.ts                           # normalizeDoi(), dedupe()
    ledger.ts                           # readLedger(), writeLedger(), toLedgerEntries()
    queue.ts                            # renderQueue(), renderRunLog()
    openalex.ts                         # searchOpenAlex(query, fetchFn) -> RawWork[]
    crossref.ts                         # searchCrossref(query, fetchFn) -> RawWork[]
    *.test.ts                           # unit/thin-integration tests
docs/seo/publication-spotlight/
  README.md                             # what this is, how to run, the candidates-only boundary
  citation-ledger.json                  # seeded from MEB-600 verified citations
  weekly-candidate-queue.md             # generated (committed so diffs are visible)
  runs/.gitkeep                         # per-run logs land here: runs/YYYY-MM-DD.md
```

Responsibilities: `classify`/`score`/`dedupe` = pure domain logic (the tested core); `openalex`/`crossref` = I/O adapters (thin, mocked tests); `ledger`/`queue` = file rendering; `citation-sweep` = wiring only.

---

## Task 0: Scaffold — dirs, types, config, seed ledger, README

**Files:**
- Create: `docs/seo/publication-spotlight/README.md`, `docs/seo/publication-spotlight/citation-ledger.json`, `docs/seo/publication-spotlight/runs/.gitkeep`
- Create: `scripts/citation-monitor/types.ts`, `scripts/citation-monitor/config.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p scripts/citation-monitor docs/seo/publication-spotlight/runs
touch docs/seo/publication-spotlight/runs/.gitkeep
```

- [ ] **Step 2: Write `scripts/citation-monitor/types.ts`**

```typescript
export type A1Grade = 'A1-confirmed' | 'A1-probable' | 'A1-unverified' | 'A2' | 'none';
export type Confidence = 'high' | 'medium' | 'low';

/** A work as parsed from an API, before classification. */
export interface RawWork {
  doi: string | null;            // normalized (lowercase, no doi.org prefix) or null
  title: string;
  authors: string[];
  affiliations: string[];
  journal: string | null;
  publicationDate: string | null; // YYYY-MM-DD or null
  abstract: string | null;
  source: 'openalex' | 'crossref';
}

/** A scored candidate ready for the queue. */
export interface Candidate {
  doi: string | null;
  title: string;
  equipmentMatch: string[];
  mentionsVendor: boolean;
  authors: string[];
  affiliation: string[];
  journal: string | null;
  publicationDate: string | null;
  grade: A1Grade;
  matchConfidence: Confidence;
  spotlightScore: number;
  source: 'openalex' | 'crossref';
}

export interface LedgerEntry {
  doi: string;        // dedupe key (normalized) OR "title:<lowercased>" when DOI missing
  title: string;
  firstSeen: string;  // YYYY-MM-DD
  grade: A1Grade;
}
```

- [ ] **Step 3: Write `scripts/citation-monitor/config.ts`**

```typescript
// NineScrolls equipment model strings to search for.
export const EQUIPMENT_MODELS = [
  'RIE-150', 'RIE-150A', 'ICP-100', 'ICP-200', 'ICP-S-150', 'PECVD-150LL', 'MEB-600',
];

// Models prone to collision with other vendors / generic usage → weaker signal on their own.
export const GENERIC_MODELS = ['ICP-100', 'ICP-200', 'RIE-150'];

export const VENDOR = 'NineScrolls';

// Lowercased journal-name substrings that count as "top journal" (+points).
export const TOP_JOURNALS = [
  'nature', 'science', 'advanced materials', 'advanced functional materials',
  'acs applied', 'acs nano', 'nano letters', 'applied surface science',
  'light: science', 'journal of the american chemical society', 'small',
];

// Lowercased affiliation substrings hinting at a US research university (+points).
export const US_UNIVERSITY_HINTS = [
  'university of california', 'ucla', 'uc berkeley', 'berkeley', 'ucsd', 'stanford',
  'massachusetts institute of technology', 'mit', 'caltech', 'california institute of technology',
  'georgia institute of technology', 'university of michigan', 'university of texas',
  'carnegie mellon', 'cornell', 'princeton', 'harvard', 'university of illinois',
  'purdue', 'university of washington', 'penn state', 'university of wisconsin',
];

export const SCORE_WEIGHTS = {
  gradeBase: { 'A1-confirmed': 100, 'A1-probable': 60, 'A2': 40, 'A1-unverified': 20, 'none': 0 },
  topJournal: 20,
  usUniversity: 15,
  multipleModelMentions: 10,
} as const;

export const OPENALEX_MAILTO = 'info@ninescrolls.com';
export const CROSSREF_MAILTO = 'info@ninescrolls.com';
```

- [ ] **Step 4: Seed `docs/seo/publication-spotlight/citation-ledger.json`**

Seeded from the verified MEB-600 citations in `memory/project_meb600_oem.md` (DOIs normalized; entry #3 has no DOI so it uses the `title:` key form).

```json
[
  {
    "doi": "10.1021/acsami.4c01807",
    "title": "Wan et al. 2024, ACS Appl. Mater. Interfaces — PbS IR sensor, MgO sacrificial layer (MEB-600)",
    "firstSeen": "2026-06-04",
    "grade": "A1-confirmed"
  },
  {
    "doi": "10.11972/j.issn.1001-9014.2023.06.027",
    "title": "Luo et al. 2023, J. Infrared Millim. Waves — coronene UV down-conversion on CMOS (MEB-600)",
    "firstSeen": "2026-06-04",
    "grade": "A1-confirmed"
  },
  {
    "doi": "title:su et al. 2025, basic sciences j. textile universities — ge/zns ir-stealth photonic crystal (meb-600)",
    "title": "Su et al. 2025, Basic Sciences J. Textile Universities — Ge/ZnS IR-stealth photonic crystal (MEB-600)",
    "firstSeen": "2026-06-04",
    "grade": "A1-confirmed"
  }
]
```

- [ ] **Step 5: Write `docs/seo/publication-spotlight/README.md`**

```markdown
# Publication Spotlight — Gate-1 Citation Monitoring (v1)

Weekly automation that finds papers citing NineScrolls equipment and produces a **ranked candidate queue** for a human to turn into A1 Spotlights. **Candidates only — it never writes, publishes, or sends outreach.**

## Run
```
npx tsx scripts/citation-sweep.ts            # live sweep, updates queue + ledger + run log
npx tsx scripts/citation-sweep.ts --dry-run  # no file writes; prints what it would do
```

## Files
- `citation-ledger.json` — known citations (dedupe key). Seeded from verified MEB-600 citations.
- `weekly-candidate-queue.md` — current ranked queue (read this each week).
- `runs/YYYY-MM-DD.md` — per-run log (sources hit, new vs duplicate, any degrade).

## Sources (v1)
OpenAlex + Crossref (open APIs, no key). Google Scholar Alerts ingestion = v1.1. No Google Scholar scraping (no API, bot-blocked).

## Grading
- **A1-confirmed** (model + "NineScrolls") → writing queue.
- **A1-probable** (vendor-only, or distinctive model only) → manual verification first.
- **A1-unverified** (generic model only, e.g. ICP-100) → flagged, low score.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/citation-monitor/types.ts scripts/citation-monitor/config.ts docs/seo/publication-spotlight/
git commit -m "feat(citation-monitor): scaffold types, config, seeded ledger, README"
```

---

## Task 1: Dedupe + DOI normalization (pure, TDD)

**Files:**
- Create: `scripts/citation-monitor/dedupe.ts`, `scripts/citation-monitor/dedupe.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/dedupe.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeDoi, dedupeKey, dedupe } from './dedupe';
import type { RawWork, LedgerEntry } from './types';

const work = (over: Partial<RawWork>): RawWork => ({
  doi: null, title: 'T', authors: [], affiliations: [], journal: null,
  publicationDate: null, abstract: null, source: 'openalex', ...over,
});

describe('normalizeDoi', () => {
  it('strips https://doi.org/ and lowercases', () => {
    expect(normalizeDoi('https://doi.org/10.1021/ACSAMI.4c01807')).toBe('10.1021/acsami.4c01807');
  });
  it('strips dx.doi.org and trims', () => {
    expect(normalizeDoi('  http://dx.doi.org/10.1/AB ')).toBe('10.1/ab');
  });
  it('returns null for null', () => { expect(normalizeDoi(null)).toBeNull(); });
});

describe('dedupeKey', () => {
  it('uses normalized DOI when present', () => {
    expect(dedupeKey(work({ doi: '10.1/AB' }))).toBe('10.1/ab');
  });
  it('falls back to title: key when DOI missing', () => {
    expect(dedupeKey(work({ doi: null, title: '  Hello World ' }))).toBe('title:hello world');
  });
});

describe('dedupe', () => {
  it('removes works already in the ledger and intra-batch duplicates', () => {
    const ledger: LedgerEntry[] = [{ doi: '10.1/seen', title: 'x', firstSeen: '2026-01-01', grade: 'A1-confirmed' }];
    const works = [
      work({ doi: '10.1/SEEN' }),          // in ledger -> dropped
      work({ doi: '10.1/new', title: 'A' }),
      work({ doi: '10.1/new', title: 'A dup' }), // intra-batch dup -> dropped
      work({ doi: null, title: 'No DOI' }),
    ];
    const out = dedupe(works, ledger);
    expect(out.map(w => w.title)).toEqual(['A', 'No DOI']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/dedupe.test.ts`
Expected: FAIL — `dedupe.ts` does not exist / exports undefined.

- [ ] **Step 3: Write `scripts/citation-monitor/dedupe.ts`**

```typescript
import type { RawWork, LedgerEntry } from './types';

export function normalizeDoi(doi: string | null): string | null {
  if (!doi) return null;
  return doi.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

export function dedupeKey(work: RawWork): string {
  const d = normalizeDoi(work.doi);
  return d ?? `title:${work.title.trim().toLowerCase()}`;
}

export function dedupe(works: RawWork[], ledger: LedgerEntry[]): RawWork[] {
  const seen = new Set(ledger.map((e) => e.doi));
  const batch = new Set<string>();
  const out: RawWork[] = [];
  for (const w of works) {
    const key = dedupeKey(w);
    if (seen.has(key) || batch.has(key)) continue;
    batch.add(key);
    out.push(w);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/dedupe.test.ts`
Expected: PASS (all 3 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/dedupe.ts scripts/citation-monitor/dedupe.test.ts
git commit -m "feat(citation-monitor): dedupe + DOI normalization (TDD)"
```

---

## Task 2: detectMatches + A1 classifier (pure, TDD — the core logic)

**Files:**
- Create: `scripts/citation-monitor/classify.ts`, `scripts/citation-monitor/classify.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/classify.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { detectMatches, classify } from './classify';

describe('detectMatches', () => {
  it('finds model strings case-insensitively and the vendor', () => {
    const r = detectMatches('We used a NineScrolls RIE-150A and an ICP-100 etcher.');
    expect(r.matchedModels.sort()).toEqual(['ICP-100', 'RIE-150A']);
    expect(r.mentionsVendor).toBe(true);
  });
  it('does not match a model substring inside an unrelated token', () => {
    // "RIE-1500" must NOT match "RIE-150" (word-boundary guard)
    expect(detectMatches('model RIE-1500 only').matchedModels).toEqual([]);
  });
  it('reports no vendor when absent', () => {
    expect(detectMatches('a PECVD-150LL deposition').mentionsVendor).toBe(false);
  });
});

describe('classify', () => {
  it('model + vendor => A1-confirmed/high', () => {
    expect(classify({ matchedModels: ['ICP-100'], mentionsVendor: true }))
      .toEqual({ grade: 'A1-confirmed', matchConfidence: 'high' });
  });
  it('vendor only (no model parsed) => A1-probable/medium', () => {
    expect(classify({ matchedModels: [], mentionsVendor: true }))
      .toEqual({ grade: 'A1-probable', matchConfidence: 'medium' });
  });
  it('distinctive model, no vendor => A1-probable/medium', () => {
    expect(classify({ matchedModels: ['PECVD-150LL'], mentionsVendor: false }))
      .toEqual({ grade: 'A1-probable', matchConfidence: 'medium' });
  });
  it('generic model only, no vendor => A1-unverified/low', () => {
    expect(classify({ matchedModels: ['ICP-100'], mentionsVendor: false }))
      .toEqual({ grade: 'A1-unverified', matchConfidence: 'low' });
  });
  it('nothing => none/low', () => {
    expect(classify({ matchedModels: [], mentionsVendor: false }))
      .toEqual({ grade: 'none', matchConfidence: 'low' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/classify.test.ts`
Expected: FAIL — `classify.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/classify.ts`**

```typescript
import { EQUIPMENT_MODELS, GENERIC_MODELS, VENDOR } from './config';
import type { A1Grade, Confidence } from './types';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Scan text for equipment models (word-boundary) and the vendor name. */
export function detectMatches(text: string): { matchedModels: string[]; mentionsVendor: boolean } {
  const hay = text || '';
  const matchedModels = EQUIPMENT_MODELS.filter((m) => {
    // (?!-?\w) prevents "RIE-150" from matching inside "RIE-1500"
    const re = new RegExp(`(?<![\\w-])${escapeRegex(m)}(?![\\w-])`, 'i');
    return re.test(hay);
  });
  const mentionsVendor = new RegExp(`(?<![\\w])${escapeRegex(VENDOR)}(?![\\w])`, 'i').test(hay);
  return { matchedModels, mentionsVendor };
}

export function classify(input: { matchedModels: string[]; mentionsVendor: boolean }):
  { grade: A1Grade; matchConfidence: Confidence } {
  const { matchedModels, mentionsVendor } = input;
  const hasModel = matchedModels.length > 0;
  if (hasModel && mentionsVendor) return { grade: 'A1-confirmed', matchConfidence: 'high' };
  if (mentionsVendor && !hasModel) return { grade: 'A1-probable', matchConfidence: 'medium' };
  if (hasModel) {
    const distinctive = matchedModels.some((m) => !GENERIC_MODELS.includes(m));
    return distinctive
      ? { grade: 'A1-probable', matchConfidence: 'medium' }
      : { grade: 'A1-unverified', matchConfidence: 'low' };
  }
  return { grade: 'none', matchConfidence: 'low' };
}
```

Note: the lookbehind `(?<![\w-])` requires Node 23 (supported). Keeps `ICP-100` from matching inside hyphenated/word runs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/classify.ts scripts/citation-monitor/classify.test.ts
git commit -m "feat(citation-monitor): detectMatches + A1 confidence classifier (TDD)"
```

---

## Task 3: Scoring (pure, TDD)

**Files:**
- Create: `scripts/citation-monitor/score.ts`, `scripts/citation-monitor/score.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/score.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { scoreCandidate } from './score';

describe('scoreCandidate', () => {
  it('A1-confirmed + top journal + US university + multi-model = 100+20+15+10', () => {
    expect(scoreCandidate({
      grade: 'A1-confirmed',
      journal: 'ACS Applied Materials & Interfaces',
      affiliation: ['University of California, Los Angeles'],
      equipmentMatch: ['ICP-100', 'RIE-150A'],
    })).toBe(145);
  });
  it('A1-unverified, unknown journal, no US affil, single model = 20', () => {
    expect(scoreCandidate({
      grade: 'A1-unverified', journal: 'Some Local Journal', affiliation: ['Tsinghua University'], equipmentMatch: ['ICP-100'],
    })).toBe(20);
  });
  it('A1-probable + top journal only = 60+20', () => {
    expect(scoreCandidate({
      grade: 'A1-probable', journal: 'Nature Communications', affiliation: [], equipmentMatch: ['PECVD-150LL'],
    })).toBe(80);
  });
  it('null journal/affiliation handled', () => {
    expect(scoreCandidate({ grade: 'none', journal: null, affiliation: [], equipmentMatch: [] })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/score.test.ts`
Expected: FAIL — `score.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/score.ts`**

```typescript
import { SCORE_WEIGHTS, TOP_JOURNALS, US_UNIVERSITY_HINTS } from './config';
import type { A1Grade } from './types';

export function scoreCandidate(input: {
  grade: A1Grade;
  journal: string | null;
  affiliation: string[];
  equipmentMatch: string[];
}): number {
  let score = SCORE_WEIGHTS.gradeBase[input.grade] ?? 0;

  const journal = (input.journal ?? '').toLowerCase();
  if (journal && TOP_JOURNALS.some((j) => journal.includes(j))) score += SCORE_WEIGHTS.topJournal;

  const affil = input.affiliation.join(' ').toLowerCase();
  if (affil && US_UNIVERSITY_HINTS.some((u) => affil.includes(u))) score += SCORE_WEIGHTS.usUniversity;

  if (input.equipmentMatch.length >= 2) score += SCORE_WEIGHTS.multipleModelMentions;

  return score;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/score.ts scripts/citation-monitor/score.test.ts
git commit -m "feat(citation-monitor): spotlight scoring (TDD)"
```

---

## Task 4: Ledger read/write (TDD)

**Files:**
- Create: `scripts/citation-monitor/ledger.ts`, `scripts/citation-monitor/ledger.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/ledger.test.ts`

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { readLedger, writeLedger, toLedgerEntries } from './ledger';
import type { Candidate } from './types';

const TMP = '/tmp/test-ledger.json';
afterEach(() => { if (existsSync(TMP)) rmSync(TMP); });

const cand = (over: Partial<Candidate>): Candidate => ({
  doi: '10.1/x', title: 'T', equipmentMatch: [], mentionsVendor: false, authors: [], affiliation: [],
  journal: null, publicationDate: null, grade: 'A1-confirmed', matchConfidence: 'high',
  spotlightScore: 100, source: 'openalex', ...over,
});

describe('ledger', () => {
  it('readLedger returns [] when file missing', () => {
    expect(readLedger('/tmp/does-not-exist-xyz.json')).toEqual([]);
  });
  it('writeLedger then readLedger round-trips', () => {
    writeLedger(TMP, [{ doi: '10.1/a', title: 'A', firstSeen: '2026-06-04', grade: 'A1-probable' }]);
    expect(readLedger(TMP)).toEqual([{ doi: '10.1/a', title: 'A', firstSeen: '2026-06-04', grade: 'A1-probable' }]);
  });
  it('toLedgerEntries maps candidates with key + date', () => {
    const entries = toLedgerEntries([cand({ doi: '10.1/A' }), cand({ doi: null, title: 'No DOI' })], '2026-06-07');
    expect(entries).toEqual([
      { doi: '10.1/a', title: 'T', firstSeen: '2026-06-07', grade: 'A1-confirmed' },
      { doi: 'title:no doi', title: 'No DOI', firstSeen: '2026-06-07', grade: 'A1-confirmed' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/ledger.test.ts`
Expected: FAIL — `ledger.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/ledger.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dedupeKey } from './dedupe';
import type { Candidate, LedgerEntry } from './types';

export function readLedger(path: string): LedgerEntry[] {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8')) as LedgerEntry[];
}

export function writeLedger(path: string, entries: LedgerEntry[]): void {
  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n');
}

export function toLedgerEntries(candidates: Candidate[], today: string): LedgerEntry[] {
  return candidates.map((c) => ({
    doi: dedupeKey(c),               // same key form used by dedupe()
    title: c.title,
    firstSeen: today,
    grade: c.grade,
  }));
}
```

Note: `dedupeKey` accepts `RawWork`; `Candidate` is structurally compatible for the fields it reads (`doi`, `title`), so passing a `Candidate` is safe. If the type-checker complains, change `dedupeKey(work: RawWork)` to `dedupeKey(work: { doi: string | null; title: string })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Widen `dedupeKey` signature for reuse** (in `scripts/citation-monitor/dedupe.ts`)

```typescript
export function dedupeKey(work: { doi: string | null; title: string }): string {
  const d = normalizeDoi(work.doi);
  return d ?? `title:${work.title.trim().toLowerCase()}`;
}
```

Run: `npx vitest run scripts/citation-monitor/dedupe.test.ts scripts/citation-monitor/ledger.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Commit**

```bash
git add scripts/citation-monitor/ledger.ts scripts/citation-monitor/ledger.test.ts scripts/citation-monitor/dedupe.ts
git commit -m "feat(citation-monitor): citation ledger read/write + entry mapping (TDD)"
```

---

## Task 5: Queue + run-log rendering (TDD)

**Files:**
- Create: `scripts/citation-monitor/queue.ts`, `scripts/citation-monitor/queue.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/queue.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { renderQueue, renderRunLog } from './queue';
import type { Candidate } from './types';

const cand = (over: Partial<Candidate>): Candidate => ({
  doi: '10.1/x', title: 'A paper', equipmentMatch: ['ICP-100'], mentionsVendor: true,
  authors: ['Jane Doe'], affiliation: ['UCLA'], journal: 'ACS Nano', publicationDate: '2026-05-01',
  grade: 'A1-confirmed', matchConfidence: 'high', spotlightScore: 135, source: 'openalex', ...over,
});

describe('renderQueue', () => {
  it('sorts by score desc and includes all required columns + grade sections', () => {
    const md = renderQueue([
      cand({ title: 'Low', spotlightScore: 20, grade: 'A1-unverified', matchConfidence: 'low' }),
      cand({ title: 'High', spotlightScore: 135 }),
    ], '2026-06-07');
    expect(md).toContain('# Publication Spotlight — Candidate Queue (2026-06-07)');
    // High score appears before Low score
    expect(md.indexOf('High')).toBeLessThan(md.indexOf('Low'));
    // required columns present
    for (const col of ['DOI', 'Title', 'Equipment', 'Authors', 'Affiliation', 'Journal', 'Date', 'Confidence', 'Score']) {
      expect(md).toContain(col);
    }
    // grade buckets surfaced
    expect(md).toContain('A1-confirmed');
    expect(md).toContain('A1-unverified');
  });
  it('handles empty queue', () => {
    expect(renderQueue([], '2026-06-07')).toContain('No new candidates');
  });
});

describe('renderRunLog', () => {
  it('summarizes sources, counts, and degrade notes', () => {
    const log = renderRunLog({
      date: '2026-06-07', sources: ['openalex', 'crossref'], fetched: 40, afterDedupe: 7,
      byGrade: { 'A1-confirmed': 2, 'A1-probable': 3, 'A1-unverified': 2 }, notes: ['gmail skipped (v1.1)'],
    });
    expect(log).toContain('2026-06-07');
    expect(log).toContain('fetched: 40');
    expect(log).toContain('after dedupe: 7');
    expect(log).toContain('gmail skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/queue.test.ts`
Expected: FAIL — `queue.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/queue.ts`**

```typescript
import type { A1Grade, Candidate } from './types';

function row(c: Candidate): string {
  const doi = c.doi ? `[${c.doi}](https://doi.org/${c.doi})` : '—';
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  return `| ${c.spotlightScore} | ${cell(c.title)} | ${cell(c.equipmentMatch.join(', ') || '—')} | ${c.grade} | ${c.matchConfidence} | ${cell(c.journal ?? '—')} | ${c.publicationDate ?? '—'} | ${cell(c.affiliation.join('; ') || '—')} | ${cell(c.authors.join(', ') || '—')} | ${doi} |`;
}

export function renderQueue(candidates: Candidate[], today: string): string {
  const head = `# Publication Spotlight — Candidate Queue (${today})\n\n> Candidates only. A1-confirmed → writing queue; A1-probable → verify first; A1-unverified → flagged.\n`;
  if (candidates.length === 0) return `${head}\n_No new candidates this run._\n`;

  const sorted = [...candidates].sort((a, b) => b.spotlightScore - a.spotlightScore);
  const header =
    '| Score | Title | Equipment | Grade | Confidence | Journal | Date | Affiliation | Authors | DOI |\n' +
    '|---|---|---|---|---|---|---|---|---|---|';

  const order: A1Grade[] = ['A1-confirmed', 'A1-probable', 'A1-unverified', 'A2', 'none'];
  const sections = order
    .map((g) => {
      const rows = sorted.filter((c) => c.grade === g);
      if (rows.length === 0) return '';
      return `\n## ${g} (${rows.length})\n\n${header}\n${rows.map(row).join('\n')}\n`;
    })
    .join('');

  return head + sections;
}

export function renderRunLog(r: {
  date: string; sources: string[]; fetched: number; afterDedupe: number;
  byGrade: Partial<Record<A1Grade, number>>; notes: string[];
}): string {
  const grades = Object.entries(r.byGrade).map(([g, n]) => `  - ${g}: ${n}`).join('\n');
  const notes = r.notes.length ? r.notes.map((n) => `- ${n}`).join('\n') : '- (none)';
  return `# Citation sweep run — ${r.date}\n\n- sources: ${r.sources.join(', ')}\n- fetched: ${r.fetched}\n- after dedupe: ${r.afterDedupe}\n- by grade:\n${grades}\n\n## Notes\n${notes}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/queue.ts scripts/citation-monitor/queue.test.ts
git commit -m "feat(citation-monitor): queue + run-log markdown rendering (TDD)"
```

---

## Task 6: OpenAlex client (thin, mocked-fetch test)

**Files:**
- Create: `scripts/citation-monitor/openalex.ts`, `scripts/citation-monitor/openalex.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/openalex.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { reconstructAbstract, parseOpenAlexWork, searchOpenAlex } from './openalex';

describe('reconstructAbstract', () => {
  it('rebuilds text from an inverted index', () => {
    expect(reconstructAbstract({ 'Hello': [0], 'world': [1] })).toBe('Hello world');
  });
  it('returns null for null index', () => { expect(reconstructAbstract(null)).toBeNull(); });
});

describe('parseOpenAlexWork', () => {
  it('maps an OpenAlex work to RawWork', () => {
    const raw = {
      doi: 'https://doi.org/10.1/AB', title: 'A Title',
      publication_date: '2026-05-01',
      primary_location: { source: { display_name: 'ACS Nano' } },
      authorships: [{ author: { display_name: 'Jane Doe' }, institutions: [{ display_name: 'UCLA', country_code: 'US' }] }],
      abstract_inverted_index: { 'Etched': [0], 'silicon': [1] },
    };
    const w = parseOpenAlexWork(raw);
    expect(w.doi).toBe('10.1/ab');
    expect(w.title).toBe('A Title');
    expect(w.journal).toBe('ACS Nano');
    expect(w.authors).toEqual(['Jane Doe']);
    expect(w.affiliations).toEqual(['UCLA']);
    expect(w.abstract).toBe('Etched silicon');
    expect(w.source).toBe('openalex');
  });
});

describe('searchOpenAlex', () => {
  it('calls the API and parses results (injected fetch)', async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ results: [{ doi: '10.1/x', title: 'T', authorships: [], abstract_inverted_index: null }] }),
    }) as any;
    const out = await searchOpenAlex('RIE-150A', fakeFetch);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('T');
  });
  it('returns [] on non-ok response', async () => {
    const fakeFetch = async () => ({ ok: false, status: 429 }) as any;
    expect(await searchOpenAlex('x', fakeFetch)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/openalex.test.ts`
Expected: FAIL — `openalex.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/openalex.ts`**

```typescript
import { normalizeDoi } from './dedupe';
import { OPENALEX_MAILTO } from './config';
import type { RawWork } from './types';

type FetchFn = typeof fetch;

export function reconstructAbstract(index: Record<string, number[]> | null): string | null {
  if (!index) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const p of positions) slots[p] = word;
  }
  return slots.filter(Boolean).join(' ') || null;
}

export function parseOpenAlexWork(raw: any): RawWork {
  const authorships = Array.isArray(raw.authorships) ? raw.authorships : [];
  const affiliations = authorships.flatMap((a: any) =>
    (a.institutions ?? []).map((i: any) => i.display_name).filter(Boolean),
  );
  return {
    doi: normalizeDoi(raw.doi ?? null),
    title: raw.title ?? raw.display_name ?? '(untitled)',
    authors: authorships.map((a: any) => a.author?.display_name).filter(Boolean),
    affiliations: [...new Set(affiliations)] as string[],
    journal: raw.primary_location?.source?.display_name ?? null,
    publicationDate: raw.publication_date ?? null,
    abstract: reconstructAbstract(raw.abstract_inverted_index ?? null),
    source: 'openalex',
  };
}

export async function searchOpenAlex(query: string, fetchFn: FetchFn = fetch): Promise<RawWork[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=25&mailto=${OPENALEX_MAILTO}`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.results ?? []).map(parseOpenAlexWork);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/openalex.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/openalex.ts scripts/citation-monitor/openalex.test.ts
git commit -m "feat(citation-monitor): OpenAlex client + abstract reconstruction (TDD)"
```

---

## Task 7: Crossref client (thin, mocked-fetch test)

**Files:**
- Create: `scripts/citation-monitor/crossref.ts`, `scripts/citation-monitor/crossref.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/citation-monitor/crossref.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseCrossrefItem, searchCrossref } from './crossref';

describe('parseCrossrefItem', () => {
  it('maps a Crossref item to RawWork', () => {
    const item = {
      DOI: '10.1/AB', title: ['A Title'], 'container-title': ['Applied Surface Science'],
      published: { 'date-parts': [[2026, 5, 1]] },
      author: [{ given: 'Jane', family: 'Doe', affiliation: [{ name: 'Stanford University' }] }],
      abstract: '<jats:p>Etched silicon</jats:p>',
    };
    const w = parseCrossrefItem(item);
    expect(w.doi).toBe('10.1/ab');
    expect(w.title).toBe('A Title');
    expect(w.journal).toBe('Applied Surface Science');
    expect(w.publicationDate).toBe('2026-05-01');
    expect(w.authors).toEqual(['Jane Doe']);
    expect(w.affiliations).toEqual(['Stanford University']);
    expect(w.abstract).toBe('Etched silicon');           // JATS tags stripped
    expect(w.source).toBe('crossref');
  });
  it('handles missing fields', () => {
    const w = parseCrossrefItem({ DOI: '10.1/x' });
    expect(w.title).toBe('(untitled)');
    expect(w.publicationDate).toBeNull();
    expect(w.authors).toEqual([]);
  });
});

describe('searchCrossref', () => {
  it('parses items (injected fetch)', async () => {
    const fakeFetch = async () => ({
      ok: true, json: async () => ({ message: { items: [{ DOI: '10.1/x', title: ['T'] }] } }),
    }) as any;
    const out = await searchCrossref('RIE-150A', fakeFetch);
    expect(out[0].title).toBe('T');
  });
  it('returns [] on error', async () => {
    const fakeFetch = async () => { throw new Error('network'); };
    expect(await searchCrossref('x', fakeFetch as any)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/citation-monitor/crossref.test.ts`
Expected: FAIL — `crossref.ts` missing.

- [ ] **Step 3: Write `scripts/citation-monitor/crossref.ts`**

```typescript
import { normalizeDoi } from './dedupe';
import { CROSSREF_MAILTO } from './config';
import type { RawWork } from './types';

type FetchFn = typeof fetch;

function dateFromParts(published: any): string | null {
  const parts = published?.['date-parts']?.[0];
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const [y, m = 1, d = 1] = parts;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseCrossrefItem(item: any): RawWork {
  const authors = Array.isArray(item.author) ? item.author : [];
  const affiliations = authors.flatMap((a: any) =>
    (a.affiliation ?? []).map((af: any) => af.name).filter(Boolean),
  );
  return {
    doi: normalizeDoi(item.DOI ?? null),
    title: Array.isArray(item.title) && item.title[0] ? item.title[0] : '(untitled)',
    authors: authors.map((a: any) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
    affiliations: [...new Set(affiliations)] as string[],
    journal: Array.isArray(item['container-title']) ? item['container-title'][0] ?? null : null,
    publicationDate: dateFromParts(item.published ?? item['published-online'] ?? item['published-print']),
    abstract: item.abstract ? String(item.abstract).replace(/<[^>]+>/g, '').trim() : null,
    source: 'crossref',
  };
}

export async function searchCrossref(query: string, fetchFn: FetchFn = fetch): Promise<RawWork[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=25&mailto=${CROSSREF_MAILTO}`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.message?.items ?? []).map(parseCrossrefItem);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/citation-monitor/crossref.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/citation-monitor/crossref.ts scripts/citation-monitor/crossref.test.ts
git commit -m "feat(citation-monitor): Crossref client (TDD)"
```

---

## Task 8: Orchestrator `citation-sweep.ts` + full-suite + run

**Files:**
- Create: `scripts/citation-sweep.ts`

- [ ] **Step 1: Write `scripts/citation-sweep.ts`**

```typescript
/**
 * Gate-1 Citation Monitoring v1 — sweep OpenAlex + Crossref for papers citing
 * NineScrolls equipment, dedupe vs ledger, grade/score, write ranked queue.
 * Candidates only — never writes/publishes/outreaches.
 *
 * Usage:
 *   npx tsx scripts/citation-sweep.ts            # live: updates queue + ledger + run log
 *   npx tsx scripts/citation-sweep.ts --dry-run  # no file writes
 *   npx tsx scripts/citation-sweep.ts --date=2026-06-07   # override run date (else today UTC)
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { EQUIPMENT_MODELS, VENDOR } from './citation-monitor/config';
import { searchOpenAlex } from './citation-monitor/openalex';
import { searchCrossref } from './citation-monitor/crossref';
import { detectMatches, classify } from './citation-monitor/classify';
import { scoreCandidate } from './citation-monitor/score';
import { dedupe } from './citation-monitor/dedupe';
import { readLedger, writeLedger, toLedgerEntries } from './citation-monitor/ledger';
import { renderQueue, renderRunLog } from './citation-monitor/queue';
import type { A1Grade, Candidate, RawWork } from './citation-monitor/types';

const DIR = 'docs/seo/publication-spotlight';
const LEDGER = join(DIR, 'citation-ledger.json');
const QUEUE = join(DIR, 'weekly-candidate-queue.md');

async function main() {
  const dry = process.argv.includes('--dry-run');
  const dateArg = process.argv.find((a) => a.startsWith('--date='))?.split('=')[1];
  const today = dateArg ?? new Date().toISOString().slice(0, 10);

  const queries = [...EQUIPMENT_MODELS.map((m) => `${m} ${VENDOR}`), VENDOR];
  const notes: string[] = ['gmail Scholar-Alert ingestion: not in v1 (deferred to v1.1)'];

  // 1. Sweep (core, auth-free). Each source failure degrades to [] (logged), never throws.
  const all: RawWork[] = [];
  for (const q of queries) {
    const [oa, cr] = await Promise.all([searchOpenAlex(q), searchCrossref(q)]);
    if (oa.length === 0) notes.push(`openalex returned 0 for "${q}"`);
    if (cr.length === 0) notes.push(`crossref returned 0 for "${q}"`);
    all.push(...oa, ...cr);
  }

  // 2. Dedupe vs ledger (+ intra-batch).
  const ledger = readLedger(LEDGER);
  const fresh = dedupe(all, ledger);

  // 3. Classify + score. Drop grade 'none' (no model AND no vendor — pure search noise).
  const candidates: Candidate[] = fresh
    .map((w): Candidate => {
      const text = `${w.title} ${w.abstract ?? ''}`;
      const { matchedModels, mentionsVendor } = detectMatches(text);
      const { grade, matchConfidence } = classify({ matchedModels, mentionsVendor });
      return {
        doi: w.doi, title: w.title, equipmentMatch: matchedModels, mentionsVendor,
        authors: w.authors, affiliation: w.affiliations, journal: w.journal,
        publicationDate: w.publicationDate, grade, matchConfidence,
        spotlightScore: scoreCandidate({ grade, journal: w.journal, affiliation: w.affiliations, equipmentMatch: matchedModels }),
        source: w.source,
      };
    })
    .filter((c) => c.grade !== 'none')
    .sort((a, b) => b.spotlightScore - a.spotlightScore);

  // 4. Render outputs.
  const byGrade = candidates.reduce<Partial<Record<A1Grade, number>>>((acc, c) => {
    acc[c.grade] = (acc[c.grade] ?? 0) + 1; return acc;
  }, {});
  const queueMd = renderQueue(candidates, today);
  const runMd = renderRunLog({
    date: today, sources: ['openalex', 'crossref'], fetched: all.length,
    afterDedupe: candidates.length, byGrade, notes,
  });

  if (dry) {
    console.log(`[dry-run] fetched=${all.length} fresh-candidates=${candidates.length}`);
    console.log(queueMd.split('\n').slice(0, 20).join('\n'));
    return;
  }

  writeFileSync(QUEUE, queueMd);
  writeFileSync(join(DIR, 'runs', `${today}.md`), runMd);
  // Ledger grows by everything we surfaced (so next week they're "seen", not re-queued).
  writeLedger(LEDGER, [...ledger, ...toLedgerEntries(candidates, today)]);
  console.log(`Wrote queue (${candidates.length} candidates) + run log + updated ledger.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the full unit suite**

Run: `npx vitest run scripts/citation-monitor/`
Expected: PASS — all of dedupe/classify/score/ledger/queue/openalex/crossref test files green.

- [ ] **Step 3: Type-check the new code**

Run: `npx tsc --noEmit`
Expected: no errors in `scripts/citation-monitor/` or `scripts/citation-sweep.ts`. (Fix any `any`-related strictness issues inline; the API parsers intentionally use `any` at the boundary.)

- [ ] **Step 4: Smoke-test against live APIs in dry-run**

Run: `npx tsx scripts/citation-sweep.ts --dry-run`
Expected: prints `[dry-run] fetched=<N> fresh-candidates=<M>` and the top of a queue. N should be > 0 (live OpenAlex/Crossref reachable). If both sources return 0 for every query, check network — but the run must still complete without throwing (graceful degrade).

- [ ] **Step 5: Real run (writes files), then inspect**

Run:
```bash
npx tsx scripts/citation-sweep.ts
git status --short docs/seo/publication-spotlight/
```
Expected: `weekly-candidate-queue.md` updated, a new `runs/<today>.md`, and `citation-ledger.json` grown. Open the queue and sanity-check that the MEB-600 seeded DOIs did NOT reappear (dedupe works) and any `A1-unverified` rows are genuinely generic-model-only hits.

- [ ] **Step 6: Commit**

```bash
git add scripts/citation-sweep.ts docs/seo/publication-spotlight/weekly-candidate-queue.md docs/seo/publication-spotlight/runs/ docs/seo/publication-spotlight/citation-ledger.json
git commit -m "feat(citation-monitor): orchestrator sweep->dedupe->score->queue + first run"
```

---

## Task 9: Create the Cowork scheduled task + PR

The script is the *what-runs*; this task creates the **Claude Cowork scheduled task** that is the *weekly trigger*. The routine's action is to run the script, commit the refreshed queue/ledger/run-log, and report the top A1-confirmed candidates. (v1.1 will extend the routine's prompt to also read Gmail Scholar Alerts before the script runs.)

**Files:** `docs/seo/publication-spotlight/README.md` (+ the scheduled task, created via the schedule feature — not a repo file)

- [ ] **Step 1: Create the scheduled task via the `schedule` skill**

Invoke the **`schedule`** skill (Claude Code routines / `scheduled-tasks`) to create a recurring task:
- **Cadence:** weekly, **Sunday 09:00 UTC** (cron `0 9 * * 0`).
- **Name:** `citation-sweep-weekly`.
- **Prompt the routine runs (verbatim):**
  > Run `npx tsx scripts/citation-sweep.ts` in the ninescrolls repo. It sweeps OpenAlex + Crossref for papers citing NineScrolls equipment and rewrites `docs/seo/publication-spotlight/weekly-candidate-queue.md`, the run log, and the ledger. Then: (1) `git add docs/seo/publication-spotlight/ && git commit -m "chore(citation-monitor): weekly sweep <date>"` on a branch `citation-sweep/<date>` and open a PR; (2) reply with the count of new candidates and the **A1-confirmed** rows (title · journal · score) so I can decide which to write. Do NOT write, publish, or send any outreach — candidates only. If OpenAlex/Crossref are unreachable, report that and still commit whatever the run produced.

  If the `schedule` skill is unavailable in this environment, fall back to the `scheduled-tasks` MCP (`create_scheduled_task`) or `CronCreate` with the same cadence, name, and prompt.

- [ ] **Step 2: Verify the task was registered**

List scheduled tasks (`scheduled-tasks` `list_scheduled_tasks`, or the `schedule` skill's list view) and confirm `citation-sweep-weekly` appears with cadence `Sunday 09:00 UTC`. Record its task id in the README.

- [ ] **Step 3: Document the schedule in the README**

Append to `docs/seo/publication-spotlight/README.md`:

```markdown
## Schedule (v1)
A Claude Cowork scheduled task **`citation-sweep-weekly`** runs **Sunday 09:00 UTC** (cron `0 9 * * 0`).
Its action: run `npx tsx scripts/citation-sweep.ts`, commit the refreshed queue/ledger/run-log on a
`citation-sweep/<date>` branch + open a PR, and report the new A1-confirmed candidates. Candidates only.
v1.1 will extend the routine to read Gmail Scholar Alerts before the sweep.
Task id: <fill in from Step 2>.
```

- [ ] **Step 4: Commit the README update**

```bash
git add docs/seo/publication-spotlight/README.md
git commit -m "docs(citation-monitor): wire + document weekly Cowork scheduled task"
```

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin docs/publication-spotlight-engine
gh pr create --title "feat(seo): Publication Spotlight Engine spec + Gate-1 Citation Monitoring v1 (MVP)" --body "$(cat <<'EOF'
Adds the Publication Spotlight Engine design spec and the buildable Gate-1 Citation Monitoring v1 (MVP).

**Engine spec** (`docs/superpowers/specs/2026-06-04-publication-spotlight-engine-design.md`): A1/A2/B1/B2 taxonomy, 50/30/20 (A1-first), 5 gates, linkable-asset levels, measurement (authority not CTR).

**Gate-1 Automation v1 (this PR's code)** — `npx tsx scripts/citation-sweep.ts`:
- OpenAlex + Crossref sweep (open APIs, no key) for equipment models + "NineScrolls"
- dedupe vs `citation-ledger.json` (seeded from verified MEB-600 citations)
- A1 confidence grading (confirmed/probable/unverified) + false-positive guard for generic strings (ICP-100/RIE-150)
- ranked `weekly-candidate-queue.md` + per-run log
- **candidates only — no writing/publishing/outreach**

Deferred to v1.1: Gmail Scholar-Alert ingestion; outreach templates. v2: port to Amplify if it proves out over 6–8 weeks.

Unit-tested: dedupe, classifier, scoring, ledger, queue rendering; thin mocked-fetch tests for both API clients.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Do NOT use `--no-verify`.

---

## Self-review notes

- **Spec coverage (MVP steps 1–5):** (1) repo structure = Task 0; (2) seed ledger = Task 0 Step 4; (3) OpenAlex+Crossref sweep = Tasks 6,7 + orchestrator Task 8; (4) dedupe + scoring + A1 grading + false-positive guard = Tasks 1,2,3 (+ generic-model guard in `classify`); (5) queue + run log = Task 5, written by Task 8. Schedule = Task 9. Gmail + outreach correctly **excluded** (v1.1+).
- **Scoring vs spec:** spec gave explicit weights for A1(+100)/A2(+40)/journal(+20)/US-univ(+15)/multi-mention(+10); this plan adds A1-probable(+60)/A1-unverified(+20) base points (the grading the spec introduced but didn't number) — a faithful extension, documented in `config.ts`.
- **A2 note:** the v1 sweep searches model+vendor strings, so it surfaces A1-flavored hits by construction; A2 (relevant-but-not-customer) is rarely produced by this query design. The A2 weight is retained for completeness but won't typically fire until broader topical queries are added (out of scope v1).
- **Type consistency:** `RawWork`/`Candidate`/`LedgerEntry`/`A1Grade`/`Confidence` defined once in `types.ts`; `dedupeKey` widened in Task 4 Step 5 so both `RawWork` and `Candidate` pass; `classify` input shape `{matchedModels, mentionsVendor}` identical in test, impl, and orchestrator; `scoreCandidate` input shape identical across Task 3 and Task 8.
- **No placeholders:** every code step is complete and runnable; every run step has an exact command + expected output.
- **Graceful degrade:** every API call is wrapped (returns `[]` on error); the orchestrator never throws on source failure, it logs to run-notes — satisfies the spec's reliability tiering.
