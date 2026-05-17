# Admin Analytics — Linked Inquiries Card & Org-Name Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface customer-submitted contact-form inquiry content directly in the admin analytics org detail view (`/admin/analytics/<org>`), and upgrade the Organization Ledger row label to use the customer-typed organization name — mirroring the existing RFQ pattern.

**Architecture:** Single-file change in `src/pages/admin/AdminAnalyticsPage.tsx`. Add a top-level `useState` for all contact leads (loaded once via `orderAdminService.listLeads('contact')`); backfill `contactOrganization` onto each `OrganizationRecord` inside the existing `organizations` `useMemo`; in the org-detail view, add a `linkedInquiries` state populated by a hybrid visitorId/timestamp match; render a `LINKED INQUIRIES` card in the right rail directly after `LINKED RFQS`.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind, AWS Amplify Data (GraphQL via `orderAdminService.listLeads`).

**Spec:** [`docs/superpowers/specs/2026-05-16-analytics-linked-inquiries-design.md`](../specs/2026-05-16-analytics-linked-inquiries-design.md)

---

## Pre-flight

- [ ] **Step 0a: Confirm clean working tree on the branch**

Run: `git status`
Expected: `nothing to commit, working tree clean` on branch `claude/ecstatic-burnell-135f10`.

- [ ] **Step 0b: Confirm dependencies install**

Run: `npm ci`
Expected: completes without errors. Skip if `node_modules` is already current — but `npm ci` is the safe choice in a fresh worktree.

- [ ] **Step 0c: Baseline type check + test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: type check passes, all existing tests green. Record the test count for comparison after Task 7. If the baseline already fails, stop and surface to the user — the plan assumes a green starting state.

---

## File Structure

**Modify (single file):**
- `src/pages/admin/AdminAnalyticsPage.tsx` — type extension, top-level lead fetch, backfill in `organizations` memo, list-row JSX, mobile-card JSX, detail-view effect, detail-view JSX card.

**Create (new helper + its test):**
- `src/pages/admin/linkedInquiriesMatch.ts` — pure helper that, given `org.events` and `allContactLeads`, returns the matched-and-sorted `LeadSubmission[]`. Extracting this lets us TDD the only piece of non-trivial logic without spinning up a full Testing Library harness for the 4400-line page.
- `src/pages/admin/linkedInquiriesMatch.test.ts` — vitest unit tests.

**No other files** are touched. No new routes, hooks, services, or backend changes.

---

## Task 1: Extract & TDD the lead-matching helper

**Files:**
- Create: `src/pages/admin/linkedInquiriesMatch.ts`
- Test: `src/pages/admin/linkedInquiriesMatch.test.ts`

### Step 1.1: Write the failing test

- [ ] Create `src/pages/admin/linkedInquiriesMatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchLinkedInquiries } from './linkedInquiriesMatch';
import type { LeadSubmission } from '../../types/admin';

// Minimal AnalyticsEvent shape — the helper only reads visitorId, eventType, timestamp.
type EventLike = { visitorId?: string | null; eventType: string; timestamp: string };

function lead(overrides: Partial<LeadSubmission>): LeadSubmission {
  return {
    leadId: 'lead-x',
    type: 'contact',
    email: 'x@example.com',
    submittedAt: '2026-05-16T10:00:00Z',
    ...overrides,
  };
}

describe('matchLinkedInquiries', () => {
  it('matches leads by visitorId (primary signal)', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'page_view', timestamp: '2026-05-16T09:00:00Z' },
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: 'v1', submittedAt: '2026-05-16T10:00:05Z' }),
      lead({ leadId: 'L2', visitorId: 'v2', submittedAt: '2026-05-16T10:00:00Z' }),
    ];
    const result = matchLinkedInquiries(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['L1']);
  });

  it('falls back to ±60s timestamp match when visitorId is missing', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: null, submittedAt: '2026-05-16T10:00:30Z' }),    // within 60s
      lead({ leadId: 'L2', visitorId: null, submittedAt: '2026-05-16T10:02:00Z' }),    // outside 60s
    ];
    const result = matchLinkedInquiries(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['L1']);
  });

  it('does not double-count when both visitorId and timestamp match', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: 'v1', submittedAt: '2026-05-16T10:00:10Z' }),
    ];
    const result = matchLinkedInquiries(events, leads);
    expect(result).toHaveLength(1);
  });

  it('sorts results by submittedAt descending (most recent first)', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-15T10:00:00Z' },
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'OLD', visitorId: 'v1', submittedAt: '2026-05-15T10:00:00Z' }),
      lead({ leadId: 'NEW', visitorId: 'v1', submittedAt: '2026-05-16T10:00:00Z' }),
    ];
    const result = matchLinkedInquiries(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['NEW', 'OLD']);
  });

  it('returns [] when no contact_form events present', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'page_view', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [lead({ leadId: 'L1', visitorId: 'v1' })];
    expect(matchLinkedInquiries(events, leads)).toEqual([]);
  });

  it('returns [] when leads array is empty', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    expect(matchLinkedInquiries(events, [])).toEqual([]);
  });
});
```

### Step 1.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/pages/admin/linkedInquiriesMatch.test.ts`

Expected: FAIL with `Failed to load url ./linkedInquiriesMatch` (the helper file does not exist yet).

### Step 1.3: Implement the helper

- [ ] Create `src/pages/admin/linkedInquiriesMatch.ts`:

```ts
import type { LeadSubmission } from '../../types/admin';

interface EventLike {
  visitorId?: string | null;
  eventType: string;
  timestamp: string;
}

const TIMESTAMP_WINDOW_MS = 60_000;

/**
 * Match contact-form leads to an organization's events using a two-signal
 * hybrid strategy:
 *   1. Primary — lead.visitorId is in the org's visitorId set.
 *   2. Fallback — lead.submittedAt is within ±60s of any contact_form event.
 *
 * The result is deduplicated by leadId and sorted by submittedAt descending.
 * Returns [] early when the org has no contact_form events.
 */
export function matchLinkedInquiries(
  events: EventLike[],
  leads: LeadSubmission[],
): LeadSubmission[] {
  const contactFormTimestamps = events
    .filter(e => e.eventType === 'contact_form')
    .map(e => new Date(e.timestamp).getTime());

  if (contactFormTimestamps.length === 0) return [];
  if (leads.length === 0) return [];

  const visitorIds = new Set<string>();
  for (const e of events) {
    if (e.visitorId) visitorIds.add(e.visitorId);
  }

  const matched = new Map<string, LeadSubmission>();
  for (const lead of leads) {
    if (lead.visitorId && visitorIds.has(lead.visitorId)) {
      matched.set(lead.leadId, lead);
      continue;
    }
    const leadTime = new Date(lead.submittedAt).getTime();
    const hasNearbyEvent = contactFormTimestamps.some(
      t => Math.abs(leadTime - t) < TIMESTAMP_WINDOW_MS,
    );
    if (hasNearbyEvent) matched.set(lead.leadId, lead);
  }

  return Array.from(matched.values()).sort(
    (a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt),
  );
}
```

### Step 1.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/pages/admin/linkedInquiriesMatch.test.ts`

Expected: PASS — 6 passed.

### Step 1.5: Commit

- [ ] Run:

```bash
git add src/pages/admin/linkedInquiriesMatch.ts src/pages/admin/linkedInquiriesMatch.test.ts
git commit -m "feat(analytics): add matchLinkedInquiries helper for contact lead<->org matching

Pure helper extracted from AdminAnalyticsPage so the visitorId/timestamp
hybrid match logic can be unit-tested without rendering the 4400-line page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extend `OrganizationRecord` type with `contactOrganization`

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx:30-60` (interface block)

### Step 2.1: Add the field to the type

- [ ] In `src/pages/admin/AdminAnalyticsPage.tsx`, locate the existing `rfqInstitution` line:

```tsx
  rfqInstitution: string | null;
```

Add a new line immediately after it:

```tsx
  rfqInstitution: string | null;
  contactOrganization: string | null;
```

### Step 2.2: Default the field to `null` in the aggregator

- [ ] In the same file, inside `aggregateByOrg` (around line 963 where `records.push({...})` happens), add `contactOrganization: null,` to the object literal — placed directly after the existing `rfqInstitution,` line for adjacency.

Locate:

```tsx
    const rfqInstitution = (rfqProps?.rfqInstitution as string) || null;

    records.push({
      key,
      orgName: displayName,
      organizationType: effectiveOrgType,
      ...
```

Inside the `records.push({...})` object literal, find the line that sets `rfqInstitution`. Add right after it:

```tsx
      contactOrganization: null,
```

(Note: `aggregateByOrg` does not have access to leads — backfill happens in Task 4 inside the `organizations` `useMemo`, mirroring how `rfqInstitution` is also backfilled there. Initializing to `null` keeps the type honest.)

### Step 2.3: Verify type check

- [ ] Run: `npx tsc --noEmit`

Expected: PASS. If TypeScript flags missing `contactOrganization` in other places (it shouldn't, since the field is required on the interface but new code paths set it), fix only by adding `contactOrganization: null` to those literals.

### Step 2.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "refactor(analytics): add contactOrganization field to OrganizationRecord

Initialized to null in aggregateByOrg; backfilled in a follow-up commit
once allContactLeads is wired up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Top-level `allContactLeads` fetch

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` — imports (lines 1-10) and the existing `allRfqs` block (around line 2700-2712).

### Step 3.1: Extend the type import

- [ ] Locate the existing import at line 6:

```tsx
import type { RfqSubmission } from '../../types/admin';
```

Replace with:

```tsx
import type { RfqSubmission, LeadSubmission } from '../../types/admin';
```

### Step 3.2: Add the state + effect, mirroring `allRfqs`

- [ ] Locate the existing block (around line 2700-2712):

```tsx
  // Load all RFQs for institution name backfill
  const [allRfqs, setAllRfqs] = useState<RfqSubmission[]>([]);
  useEffect(() => {
    let cancelled = false;
    orderAdminService.listRfqs()
      .then(data => {
        if (cancelled) return;
        setAllRfqs((data?.items as RfqSubmission[]) || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);
```

Immediately after this block, add:

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

### Step 3.3: Verify type check

- [ ] Run: `npx tsc --noEmit`

Expected: PASS.

### Step 3.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): fetch all contact leads at top level

Mirrors the existing allRfqs pattern. Used by the organizations memo
(Task 4) and the LINKED INQUIRIES card effect (Task 6).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backfill `contactOrganization` in the `organizations` memo

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` — inside the existing `organizations` `useMemo` (around line 2961-3035).

### Step 4.1: Add the backfill block

- [ ] Locate the existing RFQ backfill block inside the `organizations` `useMemo` (around line 2965-2995):

```tsx
    // Backfill rfqInstitution from RFQ table for orgs missing it in event properties
    if (allRfqs.length > 0) {
      ...
    }
```

Immediately **after** the closing `}` of the RFQ-backfill block (and before the `if (orgOverrides.length === 0) return orgs;` line), add:

```tsx
    // Backfill contactOrganization from contact leads: most recent lead with a
    // non-empty organization, matched by visitorId set per org. Pure client-side
    // join — the org aggregator does not see leads.
    if (allContactLeads.length > 0) {
      for (const org of orgs) {
        const hasContactForm = org.events.some(e => e.eventType === 'contact_form');
        if (!hasContactForm) continue;

        const visitorIds = new Set<string>();
        for (const e of org.events) {
          const vid = (e as Record<string, unknown>).visitorId as string | undefined;
          if (vid) visitorIds.add(vid);
        }
        if (visitorIds.size === 0) continue;

        // Find most-recent matching lead with a non-empty organization string.
        let bestLead: LeadSubmission | null = null;
        for (const lead of allContactLeads) {
          if (!lead.visitorId || !visitorIds.has(lead.visitorId)) continue;
          if (!lead.organization || !lead.organization.trim()) continue;
          if (!bestLead || +new Date(lead.submittedAt) > +new Date(bestLead.submittedAt)) {
            bestLead = lead;
          }
        }
        if (bestLead?.organization) {
          org.contactOrganization = bestLead.organization.trim();
        }
      }
    }
```

### Step 4.2: Add `allContactLeads` to the `useMemo` dependency array

- [ ] Locate the closing line of the `organizations` `useMemo` (around line 3035):

```tsx
  }, [filteredEvents, orgOverrides, allRfqs, overrideAiByOrg]);
```

Add `allContactLeads`:

```tsx
  }, [filteredEvents, orgOverrides, allRfqs, allContactLeads, overrideAiByOrg]);
```

### Step 4.3: Verify type check + existing tests

- [ ] Run: `npx tsc --noEmit && npx vitest run`

Expected: PASS — type check clean, all tests still green (test count unchanged from baseline + 6 from Task 1).

### Step 4.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): backfill contactOrganization from contact leads

Joins each org's visitorId set against allContactLeads and picks the most
recent lead with a non-empty organization string. Mirrors the structure
of the existing rfqInstitution backfill block.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Upgrade list-row label (desktop table + mobile card)

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx:3698-3712` (desktop row), `:3747-3771` (mobile card).

### Step 5.1: Update desktop row name + sub-line

- [ ] Locate the desktop table row at line 3698-3712. Find this block:

```tsx
                    <td className="pl-5 pr-2 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {(org.rfqInstitution || org.displayName || org.orgName).split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold truncate max-w-[150px] block" title={org.rfqInstitution || org.displayName || org.orgName}>{org.rfqInstitution || org.displayName || org.orgName}</span>
                          {org.rfqInstitution && org.rfqInstitution.toLowerCase() !== org.orgName.toLowerCase() && (
                            <span className="text-[10px] text-on-surface-variant truncate block max-w-[150px]" title={org.orgName}>
                              <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
```

Replace with:

```tsx
                    <td className="pl-5 pr-2 py-4">
                      {(() => {
                        const upgradedName = org.rfqInstitution || org.contactOrganization;
                        const displayMain = upgradedName || org.displayName || org.orgName;
                        const showSubLine = !!upgradedName && upgradedName.toLowerCase() !== org.orgName.toLowerCase();
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                              {displayMain.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold truncate max-w-[150px] block" title={displayMain}>{displayMain}</span>
                              {showSubLine && (
                                <span className="text-[10px] text-on-surface-variant truncate block max-w-[150px]" title={org.orgName}>
                                  <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
```

### Step 5.2: Apply the same logic to the mobile card

- [ ] Locate the mobile card block at line 3747-3771. Find:

```tsx
            {(showAllOrgs ? sortedOrgs : sortedOrgs.slice(0, 10)).map((org) => (
              <div key={org.key} className="bg-surface-container-low rounded-xl p-4 cursor-pointer" onClick={() => selectOrg(org)}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center font-headline font-bold text-primary text-xs shrink-0">
                    {(org.rfqInstitution || org.displayName || org.orgName).split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-on-surface truncate" title={org.rfqInstitution || org.displayName || org.orgName}>{org.rfqInstitution || org.displayName || org.orgName}</div>
                    {org.rfqInstitution && org.rfqInstitution.toLowerCase() !== org.orgName.toLowerCase() ? (
                      <div className="text-xs text-on-surface-variant truncate"><span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}</div>
                    ) : (
                      <div className="text-xs text-on-surface-variant">{org.country || 'Unknown'}</div>
                    )}
                  </div>
                  {org.isTargetCustomer && (
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                  )}
                </div>
```

Replace **only the inner header block** (the avatar + name + sub-line; leave the metric grid below untouched) with:

```tsx
            {(showAllOrgs ? sortedOrgs : sortedOrgs.slice(0, 10)).map((org) => {
              const upgradedName = org.rfqInstitution || org.contactOrganization;
              const displayMain = upgradedName || org.displayName || org.orgName;
              const showSubLine = !!upgradedName && upgradedName.toLowerCase() !== org.orgName.toLowerCase();
              return (
              <div key={org.key} className="bg-surface-container-low rounded-xl p-4 cursor-pointer" onClick={() => selectOrg(org)}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center font-headline font-bold text-primary text-xs shrink-0">
                    {displayMain.split(/[\s,]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-on-surface truncate" title={displayMain}>{displayMain}</div>
                    {showSubLine ? (
                      <div className="text-xs text-on-surface-variant truncate"><span className="material-symbols-outlined text-[10px] align-middle mr-0.5">dns</span>{org.orgName}</div>
                    ) : (
                      <div className="text-xs text-on-surface-variant">{org.country || 'Unknown'}</div>
                    )}
                  </div>
                  {org.isTargetCustomer && (
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                  )}
                </div>
```

And add the matching closing brace + paren at the **end of this map's JSX block** (before the closing `))}` of the map). Look for:

```tsx
              </div>
            ))}
```

at the end of the map body and change it to:

```tsx
              </div>
              );
            })}
```

(The `(org)` arrow now has a function body, so it needs `return (...)` and `})` instead of `(...)` and `))`.)

### Step 5.3: Type-check + visual smoke test

- [ ] Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] Run: `npm run dev` and open `http://localhost:5173/admin/analytics` in a browser. Verify:
  - Orgs with no contact-form submissions look unchanged (IP name as primary, no sub-line).
  - Orgs that previously showed an RFQ-upgraded name still show it identically.
  - If any org has a `contact_form` event and a matched lead with a non-empty `organization`, the row main name is the typed organization and a `dns` sub-line shows the IP name. (If no test data exists, skip this leg — Task 8's manual test will create one.)

Stop the dev server with Ctrl+C.

### Step 5.4: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): upgrade list-row label with contactOrganization

Same precedence rule as RFQ — rfqInstitution wins on tie. Applied to both
the desktop table row and the mobile card header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Detail-view `linkedInquiries` state + effect (with prop wiring)

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx`
  - Imports (lines 1-10)
  - `OrgDetail` props signature (line 1294)
  - Just after the existing `linkedRfqs` effect (around line 1405)
  - `<OrgDetail ...>` render site (line 3307)

`OrgDetail` is a separate top-level component (`function OrgDetail({ org, onBack })` at line 1294), called once at line 3307 inside `AdminAnalyticsPage`. It does NOT close over `allContactLeads`. To share the already-fetched lead data (spec recommendation: avoid double-fetching), thread `allContactLeads` through as a new prop.

### Step 6.1: Add the helper import

- [ ] Near the existing local-module imports at the top of the file (around line 2-10), add:

```tsx
import { matchLinkedInquiries } from './linkedInquiriesMatch';
```

### Step 6.2: Extend `OrgDetail` props

- [ ] Locate the existing signature at line 1294:

```tsx
function OrgDetail({ org, onBack }: { org: OrganizationRecord; onBack: () => void }) {
```

Replace with:

```tsx
function OrgDetail({ org, onBack, allContactLeads }: { org: OrganizationRecord; onBack: () => void; allContactLeads: LeadSubmission[] }) {
```

### Step 6.3: Pass the prop at the call site

- [ ] Locate the render site at line 3307:

```tsx
        <OrgDetail org={selectedOrg} onBack={() => history.back()} />
```

Replace with:

```tsx
        <OrgDetail org={selectedOrg} onBack={() => history.back()} allContactLeads={allContactLeads} />
```

### Step 6.4: Add the `linkedInquiries` state + effect

- [ ] Inside `OrgDetail`, locate the closing of the `linkedRfqs` `useEffect` (around line 1405):

```tsx
    return () => { cancelled = true; };
  }, [rfqSubmitted, org.events]);
```

Immediately after this block, add:

```tsx
  // ── Linked Inquiries lookup ────────────────────────────────────────────
  // Mirrors linkedRfqs but joins against the leads already fetched at the
  // top level (no duplicate listLeads call). No leadId is stored in
  // contact_form event properties (we did not change form/segment/storage),
  // so this is purely visitorId + timestamp join via matchLinkedInquiries.
  const [linkedInquiries, setLinkedInquiries] = useState<LeadSubmission[]>([]);
  const contactFormSubmitted = org.events.some((e) => e.eventType === 'contact_form');

  useEffect(() => {
    if (!contactFormSubmitted) {
      setLinkedInquiries([]);
      return;
    }
    const eventsForMatcher = org.events.map((e) => ({
      visitorId: (e as Record<string, unknown>).visitorId as string | null | undefined,
      eventType: e.eventType,
      timestamp: e.timestamp,
    }));
    setLinkedInquiries(matchLinkedInquiries(eventsForMatcher, allContactLeads));
  }, [contactFormSubmitted, org.events, allContactLeads]);
```

(The explicit `eventsForMatcher` shape avoids an `as unknown as` cast and keeps the helper's `EventLike` type clean.)

### Step 6.5: Verify type check + tests

- [ ] Run: `npx tsc --noEmit && npx vitest run`

Expected: PASS. Test count = baseline + 6.

### Step 6.6: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): compute linkedInquiries for org detail view

Uses the matchLinkedInquiries helper to join the org's visitorId set against
allContactLeads. Renders next in the JSX wired up by the following commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Render the LINKED INQUIRIES card

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx` — inside the org-detail right-rail JSX, immediately after the `LINKED RFQS` card (around line 2365).

### Step 7.1: Insert the card JSX

- [ ] Locate the closing of the LINKED RFQS card (line ~2365):

```tsx
          {/* Linked RFQs Card */}
          {linkedRfqs.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">request_quote</span>
                Linked RFQs
              </h3>
              <div className="space-y-3">
                {linkedRfqs.map(rfq => (
                  ...
                ))}
              </div>
            </div>
          )}
```

Immediately after the closing `)}` of this block (and before the `{/* Traffic Sources Card */}` comment), insert:

```tsx
          {/* Linked Inquiries Card */}
          {linkedInquiries.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">contact_mail</span>
                Linked Inquiries
              </h3>
              <div className="space-y-3">
                {linkedInquiries.map(lead => {
                  const subject = lead.productName || lead.topic || lead.inquiryType || 'General Inquiry';
                  return (
                    <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                      <div className="text-sm font-bold text-primary mb-1">{subject}</div>
                      {lead.name && (
                        <p className="text-xs text-on-surface">
                          {lead.name}
                          {lead.email && (
                            <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                          )}
                        </p>
                      )}
                      {lead.phone && (
                        <p className="text-[11px] text-on-surface-variant">{lead.phone}</p>
                      )}
                      {lead.organization && (
                        <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                      )}
                      {lead.message && (
                        <p
                          className="mt-2 pt-2 border-t border-outline-variant/20 text-xs text-on-surface whitespace-pre-wrap line-clamp-3"
                          title={lead.message}
                        >
                          {lead.message}
                        </p>
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

### Step 7.2: Type-check + test run

- [ ] Run: `npx tsc --noEmit && npx vitest run`

Expected: PASS — type-clean, no test regressions.

### Step 7.3: Commit

- [ ] Run:

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(analytics): render LINKED INQUIRIES card in org detail right rail

Self-contained: shows subject, name, email (mailto), phone, organization,
message preview (line-clamp-3 with full title on hover), and submission
timestamp. No navigation — the card is the destination.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: End-to-end manual verification

**Files:** None modified — verification only.

### Step 8.1: Start the dev server

- [ ] Run: `npm run dev`

Open `http://localhost:5173/admin/analytics` in a browser. Sign in if needed.

### Step 8.2: Find a real org with `contact_form` events

- [ ] In the Organization Ledger, search or scroll for an org that previously showed "Contact Form Submitted" in its detail Activity Ledger (Deutsche Telekom from the original screenshot is the canonical example). If no such org exists in the current dataset, proceed to Step 8.3 to create one.

For an existing match, click into the org and confirm:
- A `LINKED INQUIRIES` card appears in the right rail, below `DETECTION DETAILS` / `LINKED RFQS` (whichever cards exist for this org).
- Each entry shows: subject + name + email (clickable `mailto:`) + phone (if present) + organization (if present) + message preview (3-line clamp, hover shows full) + timestamp.
- If the org's contact lead has an `organization` value and **no RFQ**, the Organization Ledger row label is the typed organization; if the org has an RFQ, the RFQ institution wins.

### Step 8.3: (If no existing data) submit a fresh contact form

- [ ] In another browser tab (still on `localhost:5173`), navigate to `/contact`. Fill in:
  - Name: "Test User"
  - Email: a real address you control (so you can see the mailto link work)
  - Phone: "+1 555-0100"
  - Organization: "QA Test Org"
  - Message: a multi-line message (use Shift+Enter for line breaks) so you can verify `whitespace-pre-wrap`.
  - Pick any inquiry type that maps to a labeled productName (e.g. "Technical Feasibility Check").

Submit. Wait a few seconds. Return to the analytics tab, click Refresh.

- [ ] Find your visitor's org in the ledger. Confirm:
  - Row main label is "QA Test Org"; sub-line shows the IP-detected org with the `dns` icon.
  - Click in. Right rail shows a `LINKED INQUIRIES` card with the entry. Subject = "Technical Feasibility Check" (or whatever you picked). Message preserves line breaks. Clicking the email opens your mail client.

### Step 8.4: Regression — RFQ-only org

- [ ] Find a known RFQ-only org (e.g. Georgia Tech). Confirm:
  - Row main label is unchanged (RFQ institution).
  - Detail view: `LINKED RFQS` card unchanged. No `LINKED INQUIRIES` card if no contact form events.

### Step 8.5: Regression — bare org with no submissions

- [ ] Find an org with neither RFQ nor contact form (e.g. AT&T Enterprises from the screenshot). Confirm:
  - Row main label = IP name. No sub-line.
  - Detail view: no `LINKED RFQS` or `LINKED INQUIRIES` cards.

### Step 8.6: Stop the dev server

- [ ] Press Ctrl+C in the terminal running `npm run dev`.

### Step 8.7: Final type check + test run (full sweep)

- [ ] Run: `npx tsc --noEmit && npx vitest run`

Expected: PASS. Test count = baseline + 6 (the Task 1 helper tests).

### Step 8.8: No commit

This task is verification only — no code change to commit. If any check failed, return to the appropriate earlier task to fix.

---

## Done

After Task 8, the worktree has 7 new commits ahead of `main`:

1. `feat(analytics): add matchLinkedInquiries helper for contact lead<->org matching`
2. `refactor(analytics): add contactOrganization field to OrganizationRecord`
3. `feat(analytics): fetch all contact leads at top level`
4. `feat(analytics): backfill contactOrganization from contact leads`
5. `feat(analytics): upgrade list-row label with contactOrganization`
6. `feat(analytics): compute linkedInquiries for org detail view`
7. `feat(analytics): render LINKED INQUIRIES card in org detail right rail`

Plus the two spec commits already on the branch (`282ee00`, `55c744b`).

Open a PR via `gh pr create` when ready. Recommend a single PR for the whole feature — the commits are independently safe to revert, but the user-visible value lands only with all seven applied.
