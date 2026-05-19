# Admin Analytics — Linked Downloads & Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `LINKED DOWNLOADS` and `LINKED NEWSLETTER` cards to the admin analytics org detail view, and extend the Organization Ledger list-row label precedence to include `downloadGateOrganization` — mirroring the LINKED INQUIRIES feature from PR #151.

**Architecture:** Single-file change in `src/pages/admin/AdminAnalyticsPage.tsx`. Consolidates PR #151's `allContactLeads` into a unified `allLeads` (one `listLeads()` call, three `useMemo` slices). Reuses the existing match helper after renaming it to `matchLinkedLeadsByVisitor` (the function is no longer inquiry-specific). Two new right-rail cards rendered after `LINKED INQUIRIES`.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind, AWS Amplify Data (GraphQL via `orderAdminService.listLeads`).

**Spec:** [`docs/superpowers/specs/2026-05-19-analytics-linked-downloads-newsletter-design.md`](../specs/2026-05-19-analytics-linked-downloads-newsletter-design.md)

**Branch base:** This branch is rebased onto `claude/ecstatic-burnell-135f10` (PR #151). All 7 PR #151 implementation commits + 1 regression-test commit are already present. New work layers on top.

---

## Pre-flight

- [ ] **Step 0a: Confirm clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` on branch `claude/silly-turing-beadf2`. The spec commit (`8bed532`) is already in place.

- [ ] **Step 0b: Baseline tests + type check**

Run: `npx vitest run src/`
Expected: `Test Files 10 passed (10) / Tests 94 passed (94)`. The 7 helper unit tests from PR #151 are included.

Run: `npx tsc --noEmit 2>&1 | grep -v "main.tsx"`
Expected: empty (only the pre-existing `main.tsx` missing-`amplify_outputs.json` error, filtered out).

If either fails, stop and report. The plan assumes a green starting state.

---

## File Structure

**Rename (one):**
- `src/pages/admin/linkedInquiriesMatch.ts` → `src/pages/admin/linkedLeadsMatch.ts` (helper)
- `src/pages/admin/linkedInquiriesMatch.test.ts` → `src/pages/admin/linkedLeadsMatch.test.ts` (tests)
- Exported function `matchLinkedInquiries` → `matchLinkedLeadsByVisitor`

**Modify (one):**
- `src/pages/admin/AdminAnalyticsPage.tsx` — all other changes (~150 lines added, ~10 lines modified across 8 anchor points).

**No other files** touched.

---

## Task 1: Rename helper to be lead-type-agnostic

**Files:**
- Rename: `src/pages/admin/linkedInquiriesMatch.ts` → `src/pages/admin/linkedLeadsMatch.ts`
- Rename: `src/pages/admin/linkedInquiriesMatch.test.ts` → `src/pages/admin/linkedLeadsMatch.test.ts`
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (line 3 import + line ~1428 call site)

### Step 1.1: Git-rename both files

- [ ] Run:

```bash
git mv src/pages/admin/linkedInquiriesMatch.ts src/pages/admin/linkedLeadsMatch.ts
git mv src/pages/admin/linkedInquiriesMatch.test.ts src/pages/admin/linkedLeadsMatch.test.ts
```

### Step 1.2: Rename the exported function inside the helper

- [ ] In `src/pages/admin/linkedLeadsMatch.ts`, find and replace the function name:

```bash
# Sanity: confirm the old name is exported there
grep -n "export function matchLinkedInquiries" src/pages/admin/linkedLeadsMatch.ts
```

Expected: line ~20.

Use the Edit tool to change:

```ts
export function matchLinkedInquiries(
```

to:

```ts
export function matchLinkedLeadsByVisitor(
```

### Step 1.3: Update the docstring above the function

- [ ] In the same file, the existing JSDoc says "Match contact-form leads to an organization's events". Generalize to "Match leads of any type to an organization's events". Use Edit:

Find:
```ts
/**
 * Match contact-form leads to an organization's events using a two-signal
 * hybrid strategy:
```

Replace with:
```ts
/**
 * Match leads (of any type) to an organization's events using a two-signal
 * hybrid strategy:
```

### Step 1.4: Update the test file's import + function name

- [ ] In `src/pages/admin/linkedLeadsMatch.test.ts`, two changes:

Use the Edit tool with `replace_all: true` to change every occurrence of `matchLinkedInquiries` to `matchLinkedLeadsByVisitor`:

Find:
```ts
matchLinkedInquiries
```

Replace with:
```ts
matchLinkedLeadsByVisitor
```

Then update the import path. Find:
```ts
import { matchLinkedLeadsByVisitor } from './linkedInquiriesMatch';
```

Replace with:
```ts
import { matchLinkedLeadsByVisitor } from './linkedLeadsMatch';
```

### Step 1.5: Update the call site in AdminAnalyticsPage.tsx

- [ ] In `src/pages/admin/AdminAnalyticsPage.tsx`, change the import at line 3:

Find:
```tsx
import { matchLinkedInquiries } from './linkedInquiriesMatch';
```

Replace with:
```tsx
import { matchLinkedLeadsByVisitor } from './linkedLeadsMatch';
```

Then find the single call site (around line 1428):

```tsx
    setLinkedInquiries(matchLinkedInquiries(eventsForMatcher, allContactLeads));
```

Replace with:
```tsx
    setLinkedInquiries(matchLinkedLeadsByVisitor(eventsForMatcher, allContactLeads));
```

Also update the comment on line 1414 referencing the old name. Find:
```tsx
  // so this is purely visitorId + timestamp join via matchLinkedInquiries.
```

Replace with:
```tsx
  // so this is purely visitorId + timestamp join via matchLinkedLeadsByVisitor.
```

### Step 1.6: Verify the rename compiles and tests still pass

- [ ] Run:
```bash
grep -rn "matchLinkedInquiries\|linkedInquiriesMatch" src/
```
Expected: empty (no leftover references).

```bash
npx vitest run src/pages/admin/linkedLeadsMatch.test.ts
```
Expected: 7 passed (7).

```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty.

### Step 1.7: Commit

- [ ] Run:

```bash
git add -A src/pages/admin/linkedLeadsMatch.ts src/pages/admin/linkedLeadsMatch.test.ts src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "refactor(analytics): rename matchLinkedInquiries to matchLinkedLeadsByVisitor

The helper is no longer inquiry-specific — downloads and newsletter cards
will reuse the same visitorId+timestamp match logic. File renamed too.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Consolidate `allContactLeads` into a unified `allLeads` fetch

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (the `allContactLeads` block around line 2783-2796, plus the prop signature + memo + render sites that consume it)

This replaces PR #151's `listLeads('contact')` single-type fetch with a no-filter `listLeads()` call, then derives three filtered slices.

### Step 2.1: Replace the `allContactLeads` state with `allLeads`

- [ ] Locate the block at around line 2783-2796:

```tsx
  // Load all contact leads for organization name backfill + LINKED INQUIRIES card.
  // Mirrors allRfqs above — single fetch on mount + refreshKey changes, errors are
  // swallowed (a failed fetch simply means inquiries don't surface; not a hard error).
  const [allContactLeads, setAllContactLeads] = useState<LeadSubmission[]>([]);
  useEffect(() => {
    let cancelled = false;
    orderAdminService.listLeads('contact')
      .then(data => {
        if (cancelled) return;
        setAllContactLeads((data?.items as LeadSubmission[]) || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);
```

Replace with:

```tsx
  // Load ALL leads (no type filter) for organization name backfill +
  // LINKED INQUIRIES / DOWNLOADS / NEWSLETTER cards. Mirrors allRfqs — single
  // fetch on mount + refreshKey changes, errors are swallowed (a failed fetch
  // simply means lead cards don't surface; not a hard error).
  const [allLeads, setAllLeads] = useState<LeadSubmission[]>([]);
  useEffect(() => {
    let cancelled = false;
    orderAdminService.listLeads()
      .then(data => {
        if (cancelled) return;
        setAllLeads((data?.items as LeadSubmission[]) || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Derive per-type slices (cheap — runs only when allLeads changes).
  const allContactLeads = useMemo(
    () => allLeads.filter(l => l.type === 'contact'),
    [allLeads],
  );
  const allDownloadGateLeads = useMemo(
    () => allLeads.filter(l => l.type === 'download_gate'),
    [allLeads],
  );
  const allNewsletterLeads = useMemo(
    () => allLeads.filter(l => l.type === 'newsletter'),
    [allLeads],
  );
```

### Step 2.2: Verify type check + tests

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty. `allContactLeads` is still defined (as a memoized derivation now), so downstream uses keep compiling. `allDownloadGateLeads` and `allNewsletterLeads` may show TS6133 "declared but never used" — that's expected and resolves in Tasks 4 and 7.

```bash
npx vitest run src/pages/admin/linkedLeadsMatch.test.ts
```
Expected: 7 passed.

### Step 2.3: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "refactor(analytics): one listLeads() call, three per-type useMemo slices

Replaces the type-filtered listLeads('contact') with an unfiltered fetch
plus three useMemo derivations: allContactLeads (existing behaviour),
allDownloadGateLeads (new), allNewsletterLeads (new). Saves two DDB
queries per analytics page load.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `downloadGateOrganization` field to `OrganizationRecord`

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (interface around line 58 + aggregator records.push around line 991)

### Step 3.1: Extend the interface

- [ ] Locate the `OrganizationRecord` interface (line ~30-60). Find the line:

```tsx
  contactOrganization: string | null;
```

Add a new line immediately after:

```tsx
  contactOrganization: string | null;
  downloadGateOrganization: string | null;
```

### Step 3.2: Default the field in the aggregator

- [ ] Locate `aggregateByOrg`'s `records.push({...})` (line ~991). Find:

```tsx
      contactOrganization: null,
```

Add immediately after:

```tsx
      downloadGateOrganization: null,
```

### Step 3.3: Verify type check

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty.

### Step 3.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "refactor(analytics): add downloadGateOrganization field to OrganizationRecord

Initialized to null in aggregateByOrg; backfilled in the next commit
once allDownloadGateLeads is consumed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backfill `downloadGateOrganization` in the `organizations` memo

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (organizations useMemo, after the existing contactOrganization backfill block around line 3081-3107)

### Step 4.1: Add the backfill block

- [ ] Locate the existing contact backfill block (lines ~3081-3107):

```tsx
    // Backfill contactOrganization from contact leads: most recent lead with a
    // non-empty organization, matched by visitorId set per org. Pure client-side
    // join — the org aggregator does not see leads.
    if (allContactLeads.length > 0) {
      for (const org of orgs) {
        ...
        if (bestLead?.organization) {
          org.contactOrganization = bestLead.organization.trim();
        }
      }
    }
```

Immediately AFTER the closing `}` of the `if (allContactLeads.length > 0)` block, add a parallel block for download_gate:

```tsx
    // Backfill downloadGateOrganization from download_gate leads: same
    // most-recent-non-empty-organization rule as contactOrganization.
    if (allDownloadGateLeads.length > 0) {
      for (const org of orgs) {
        const hasDownload = org.events.some(e =>
          e.eventType === 'lead_capture' || e.eventType === 'pdf_download'
        );
        if (!hasDownload) continue;

        const visitorIds = new Set<string>();
        for (const e of org.events) {
          const vid = (e as Record<string, unknown>).visitorId as string | undefined;
          if (vid) visitorIds.add(vid);
        }
        if (visitorIds.size === 0) continue;

        let bestLead: LeadSubmission | null = null;
        for (const lead of allDownloadGateLeads) {
          if (!lead.visitorId || !visitorIds.has(lead.visitorId)) continue;
          if (!lead.organization || !lead.organization.trim()) continue;
          if (!bestLead || +new Date(lead.submittedAt) > +new Date(bestLead.submittedAt)) {
            bestLead = lead;
          }
        }
        if (bestLead?.organization) {
          org.downloadGateOrganization = bestLead.organization.trim();
        }
      }
    }
```

### Step 4.2: Add `allDownloadGateLeads` to the `useMemo` dependency array

- [ ] Locate the closing line of the `organizations` `useMemo` (around line 3149):

```tsx
  }, [filteredEvents, orgOverrides, allRfqs, allContactLeads, overrideAiByOrg]);
```

Add `allDownloadGateLeads`:

```tsx
  }, [filteredEvents, orgOverrides, allRfqs, allContactLeads, allDownloadGateLeads, overrideAiByOrg]);
```

### Step 4.3: Verify type check + tests

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty (the TS6133 on `allDownloadGateLeads` from Task 2 is now gone).

```bash
npx vitest run src/pages/admin/linkedLeadsMatch.test.ts
```
Expected: 7 passed.

### Step 4.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): backfill downloadGateOrganization from download_gate leads

Mirrors the contactOrganization backfill from PR #151. Detects download
events via eventType 'lead_capture' (form submission) or 'pdf_download'
(actual file download — same flow, recorded as two events).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Extend list-row label precedence to include downloadGate

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (desktop row IIFE around line 3814 + mobile card destructure around line 3869)

### Step 5.1: Update the desktop row IIFE

- [ ] Locate the desktop row's IIFE (line ~3814). Find:

```tsx
                        const upgradedName = org.rfqInstitution || org.contactOrganization;
```

Replace with:

```tsx
                        const upgradedName = org.rfqInstitution || org.contactOrganization || org.downloadGateOrganization;
```

### Step 5.2: Update the mobile card destructure

- [ ] Locate the mobile card's matching line (around line 3869). Find:

```tsx
              const upgradedName = org.rfqInstitution || org.contactOrganization;
```

Replace with:

```tsx
              const upgradedName = org.rfqInstitution || org.contactOrganization || org.downloadGateOrganization;
```

### Step 5.3: Verify

- [ ] Run:
```bash
grep -c "rfqInstitution || org.contactOrganization || org.downloadGateOrganization" src/pages/admin/AdminAnalyticsPage.tsx
```
Expected: `2`.

```bash
grep -c "rfqInstitution || org.contactOrganization\b" src/pages/admin/AdminAnalyticsPage.tsx
```
Expected: `0` (no leftover two-tier precedences — only the new three-tier).

```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty.

### Step 5.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): extend list-row precedence with downloadGateOrganization

Now: rfqInstitution || contactOrganization || downloadGateOrganization
|| displayName || orgName. RFQ still wins; download_gate is the new
third tier (below contact, above IP-detected).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `allDownloadGateLeads` and `allNewsletterLeads` props to OrgDetail

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (OrgDetail signature line 1297 + render site line 3421)

### Step 6.1: Extend the OrgDetail signature

- [ ] Locate the signature at line ~1297. Find:

```tsx
function OrgDetail({ org, onBack, allContactLeads }: { org: OrganizationRecord; onBack: () => void; allContactLeads: LeadSubmission[] }) {
```

Replace with:

```tsx
function OrgDetail({ org, onBack, allContactLeads, allDownloadGateLeads, allNewsletterLeads }: { org: OrganizationRecord; onBack: () => void; allContactLeads: LeadSubmission[]; allDownloadGateLeads: LeadSubmission[]; allNewsletterLeads: LeadSubmission[] }) {
```

### Step 6.2: Pass the new props at the render site

- [ ] Locate the render site at line ~3421. Find:

```tsx
        <OrgDetail org={selectedOrg} onBack={() => history.back()} allContactLeads={allContactLeads} />
```

Replace with:

```tsx
        <OrgDetail org={selectedOrg} onBack={() => history.back()} allContactLeads={allContactLeads} allDownloadGateLeads={allDownloadGateLeads} allNewsletterLeads={allNewsletterLeads} />
```

### Step 6.3: Verify type check

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: TS6133 warnings on `allDownloadGateLeads` and `allNewsletterLeads` (declared in OrgDetail but not yet used). These resolve in Task 7.

### Step 6.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): thread allDownloadGateLeads + allNewsletterLeads to OrgDetail

Mirrors the prop-threading pattern from PR #151 (allContactLeads). The
new props are consumed by Task 7's effects.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add `linkedDownloads` and `linkedNewsletters` state + effects

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (inside OrgDetail, immediately after the `linkedInquiries` effect around line 1429)

### Step 7.1: Add both state + effect blocks

- [ ] Locate the end of the `linkedInquiries` `useEffect` at line ~1429. Find:

```tsx
    setLinkedInquiries(matchLinkedLeadsByVisitor(eventsForMatcher, allContactLeads));
  }, [hasContactForm, org.events, allContactLeads]);
```

Immediately after this block, add:

```tsx
  // ── Linked Downloads lookup ────────────────────────────────────────────
  // Same hybrid match as linkedInquiries, just against download_gate leads.
  const [linkedDownloads, setLinkedDownloads] = useState<LeadSubmission[]>([]);
  const hasDownload = org.events.some((e) =>
    e.eventType === 'lead_capture' || e.eventType === 'pdf_download'
  );

  useEffect(() => {
    if (!hasDownload) {
      setLinkedDownloads([]);
      return;
    }
    const eventsForMatcher = org.events.map((e) => ({
      visitorId: (e as Record<string, unknown>).visitorId as string | null | undefined,
      eventType: e.eventType,
      timestamp: e.timestamp,
    }));
    setLinkedDownloads(matchLinkedLeadsByVisitor(eventsForMatcher, allDownloadGateLeads));
  }, [hasDownload, org.events, allDownloadGateLeads]);

  // ── Linked Newsletter lookup ───────────────────────────────────────────
  // Newsletter signups have only email + source + timestamp. No event-type
  // gate — newsletter signups don't always fire a corresponding analytics
  // event (the form posts directly to the leads API). Match purely by
  // visitorId; if no visitorId matches, the card simply hides.
  const [linkedNewsletters, setLinkedNewsletters] = useState<LeadSubmission[]>([]);

  useEffect(() => {
    if (allNewsletterLeads.length === 0) {
      setLinkedNewsletters([]);
      return;
    }
    const visitorIds = new Set<string>();
    for (const e of org.events) {
      const vid = (e as Record<string, unknown>).visitorId as string | null | undefined;
      if (vid) visitorIds.add(vid);
    }
    if (visitorIds.size === 0) {
      setLinkedNewsletters([]);
      return;
    }
    const matched = allNewsletterLeads
      .filter(l => l.visitorId && visitorIds.has(l.visitorId))
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
    setLinkedNewsletters(matched);
  }, [org.events, allNewsletterLeads]);
```

(Note: newsletter signups don't have a corresponding event type to gate on — the form posts directly to the leads API without firing an analytics event — so we match purely on visitorId presence. Timestamp fallback would be ambiguous without an event anchor.)

### Step 7.2: Verify type check + tests

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: TS6133 warnings on `linkedDownloads` and `linkedNewsletters` (declared but not yet rendered). These resolve in Tasks 8 and 9.

```bash
npx vitest run src/pages/admin/linkedLeadsMatch.test.ts
```
Expected: 7 passed.

### Step 7.3: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): compute linkedDownloads + linkedNewsletters in OrgDetail

linkedDownloads uses the same hybrid matcher as linkedInquiries, gated
on download events. linkedNewsletters matches purely on visitorId
presence (no corresponding event type to anchor timestamp fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Render the LINKED DOWNLOADS card

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (right-rail JSX, immediately after the LINKED INQUIRIES card around line 2391+)

### Step 8.1: Insert the card JSX

- [ ] Locate the closing `)}` of the LINKED INQUIRIES card (use `grep -n "Linked Inquiries Card" src/pages/admin/AdminAnalyticsPage.tsx` to find the start; the closing `)}` is ~40 lines below).

Immediately after the closing `)}` of the LINKED INQUIRIES block (and BEFORE the `{/* Traffic Sources Card */}` comment), insert:

```tsx
          {/* Linked Downloads Card */}
          {linkedDownloads.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Linked Downloads
              </h3>
              <div className="space-y-3">
                {linkedDownloads.map(lead => {
                  const subject = lead.fileName || lead.productName || 'Download';
                  return (
                    <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                      <div className="text-sm font-bold text-primary mb-1 break-all" title={subject}>{subject}</div>
                      {lead.name && (
                        <p className="text-xs text-on-surface">
                          {lead.name}
                          {lead.email && (
                            <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                          )}
                        </p>
                      )}
                      {lead.organization && (
                        <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                      )}
                      {lead.jobTitle && (
                        <p className="text-[11px] text-on-surface-variant italic">{lead.jobTitle}</p>
                      )}
                      {(lead.researchAreas || lead.intent) && (
                        <div className="mt-2 pt-2 border-t border-outline-variant/20 space-y-1">
                          {lead.researchAreas && (
                            <p className="text-xs text-on-surface line-clamp-2" title={lead.researchAreas}>
                              <span className="font-semibold">Research Areas:</span> {lead.researchAreas}
                            </p>
                          )}
                          {lead.intent && (
                            <p className="text-xs text-on-surface line-clamp-2" title={lead.intent}>
                              <span className="font-semibold">Intent:</span> {lead.intent}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        {new Date(lead.submittedAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
```

### Step 8.2: Verify type check + tests

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: `linkedDownloads` TS6133 from Task 7 is now gone. `linkedNewsletters` still warns (resolved in Task 9).

```bash
npx vitest run src/pages/admin/linkedLeadsMatch.test.ts
```
Expected: 7 passed.

### Step 8.3: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): render LINKED DOWNLOADS card in org detail right rail

Shows per-lead: fileName, name + mailto email, organization, jobTitle,
researchAreas + intent (line-clamp-2 with hover title), submittedAt.
Self-contained — no navigation, the card is the destination.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Render the LINKED NEWSLETTER card

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` (immediately after the LINKED DOWNLOADS card, before `{/* Traffic Sources Card */}`)

### Step 9.1: Insert the card JSX

- [ ] Locate the closing `)}` of the LINKED DOWNLOADS block just added in Task 8 (use `grep -n "Linked Downloads Card" src/pages/admin/AdminAnalyticsPage.tsx`). Immediately after its closing `)}` (and BEFORE `{/* Traffic Sources Card */}`), insert:

```tsx
          {/* Linked Newsletter Card */}
          {linkedNewsletters.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">newspaper</span>
                Newsletter Signups
              </h3>
              <div className="space-y-3">
                {linkedNewsletters.map(lead => (
                  <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-sm font-medium text-primary hover:underline break-all"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {lead.email}
                    </a>
                    {lead.source && (
                      <p className="text-[11px] text-on-surface-variant mt-0.5 break-all" title={lead.source}>
                        from: {lead.source}
                      </p>
                    )}
                    <div className="mt-1 text-[10px] text-on-surface-variant">
                      {new Date(lead.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
```

### Step 9.2: Verify type check + tests

- [ ] Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "main.tsx"
```
Expected: empty (all TS6133 warnings now resolved).

```bash
npx vitest run src/
```
Expected: all 94 tests pass (87 baseline + 7 helper).

### Step 9.3: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): render LINKED NEWSLETTER card in org detail right rail

Compact 3-line layout per entry: mailto email + source path + date.
Renders only when at least one newsletter signup is matched by visitorId.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: End-to-end manual verification

**Files:** None modified — verification only.

### Step 10.1: Start the dev server

- [ ] If a Preview server is configured (see `.claude/launch.json` `vite-dev`), use `preview_start`. Otherwise run `npm run dev` in the background.

Open the analytics page in a browser. Sign in if needed.

### Step 10.2: Find an org with download events (M247 Europe SRL is the canonical example)

- [ ] In the Organization Ledger, locate M247 Europe SRL (the screenshot that motivated this work shows "Datasheet Downloaded" and "Lead Captured" events).

Click into the detail view. Confirm:

- `LINKED DOWNLOADS` card appears in the right rail, BELOW `LINKED INQUIRIES` (or directly below `DETECTION DETAILS` / `LINKED RFQS` if INQUIRIES is empty).
- Each entry shows: fileName as subject + name + mailto email + organization + jobTitle + researchAreas / intent block + timestamp.
- If the org's download lead has an `organization` value AND no RFQ AND no contact, the Organization Ledger row label is the typed organization with the IP name as `dns` sub-line.

### Step 10.3: Find an org with newsletter signups

- [ ] If a known newsletter signup exists in DDB, find the org. Otherwise sign up via the dev server's newsletter widget (footer or insights page) using your dev session.

Confirm:
- `LINKED NEWSLETTER` card appears in the right rail.
- Each entry shows: mailto email + source + date (no time).

### Step 10.4: Regression — PR #151 still works

- [ ] Open Deutsche Telekom (or any org that had a contact form submission).
Confirm `LINKED INQUIRIES` card still renders correctly. No content regression.

### Step 10.5: Regression — bare org

- [ ] Open AT&T or Comcast (no submissions at all).
Confirm: row main name is IP name, no sub-line, no `LINKED *` cards on detail page.

### Step 10.6: Final type check + test run

- [ ] Run: `npx tsc --noEmit 2>&1 | grep -v "main.tsx"`
Expected: empty.

```bash
npx vitest run src/
```
Expected: 94/94 pass.

### Step 10.7: No commit

Verification only. If any check failed, return to the appropriate earlier task to fix.

---

## Done

After Task 10, the worktree has 9 new commits ahead of PR #151's tip:

1. `refactor(analytics): rename matchLinkedInquiries to matchLinkedLeadsByVisitor`
2. `refactor(analytics): one listLeads() call, three per-type useMemo slices`
3. `refactor(analytics): add downloadGateOrganization field to OrganizationRecord`
4. `feat(analytics): backfill downloadGateOrganization from download_gate leads`
5. `feat(analytics): extend list-row precedence with downloadGateOrganization`
6. `feat(analytics): thread allDownloadGateLeads + allNewsletterLeads to OrgDetail`
7. `feat(analytics): compute linkedDownloads + linkedNewsletters in OrgDetail`
8. `feat(analytics): render LINKED DOWNLOADS card in org detail right rail`
9. `feat(analytics): render LINKED NEWSLETTER card in org detail right rail`

Plus the spec commit (`8bed532`) already on the branch.

Open a PR via `gh pr create` when ready. PR description should note this branch is built on top of `claude/ecstatic-burnell-135f10` (PR #151) and recommend merge order.
