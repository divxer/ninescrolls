# Admin Analytics — Linked Downloads & Newsletter Cards + Org-Name Upgrade

**Status:** Approved
**Date:** 2026-05-19
**Scope:** `src/pages/admin/AdminAnalyticsPage.tsx` only (mirrors the LINKED INQUIRIES feature from PR #151)

## Problem

The admin analytics org detail view (`/admin/analytics/<org>`) now shows `LINKED RFQS` and (after PR #151) `LINKED INQUIRIES`, but two other customer-data-bearing event types are still invisible:

1. **Datasheet Downloaded / Lead Captured** — when a visitor passes the download gate to retrieve a gated PDF, they submit a richer profile than the contact form: `name`, `email`, `organization`, `researchAreas`, `jobTitle`, `intent`, `fileName`. Today the activity ledger shows the events but the admin has to navigate to `/admin/leads?type=download_gate` to see the captured profile.
2. **Newsletter Signup** — when a visitor subscribes, just `email` + `source` + timestamp. Lightweight but still useful for "who signed up from this org?"

Per the existing list-row pattern, when an org has a download_gate lead with a non-empty `organization` field, that organization should also upgrade the row main name (precedence: RFQ → contact → download_gate → IP).

## Goal

Mirror the LINKED INQUIRIES pattern from PR #151 for two more lead types, with zero changes outside `AdminAnalyticsPage.tsx`.

1. **LINKED DOWNLOADS card** in the right rail — full profile per download_gate lead (name, mailto email, organization, jobTitle, researchAreas, intent, fileName link)
2. **LINKED NEWSLETTER card** in the right rail — compact list (mailto email + source + timestamp per lead)
3. **List row label upgrade** — extend precedence to include `downloadGateOrganization` as fourth-tier source (after RFQ and contact)

## Non-Goals

- No changes to forms, leads API, segment tracking, analytics storage, or backend
- No new pages, routes, or hooks
- No clickable navigation from cards to detail pages — cards are self-contained
- Newsletter card does NOT contribute to row-name upgrade (only `email` is captured, no `organization` field)

## Design

### Data Source

`orderAdminService.listLeads()` accepts an optional `type` filter. Three options for fetching:

- **(a)** Three separate `useState`s + three `listLeads(<type>)` effects (mirror PR #151 exactly)
- **(b)** One `useState<LeadSubmission[]>` + one `listLeads()` (no type filter) call, then derive three lists via `useMemo`

**Choice: (b)** — saves two DDB queries per analytics page load, and the bandwidth cost is negligible (newsletter and download_gate volumes combined likely smaller than contact). We'll convert PR #151's `allContactLeads` into a unified `allLeads` and derive three filtered arrays.

This is the one deliberate deviation from "exactly mirror PR #151" — but it improves performance and is functionally equivalent.

### Match Strategy

Reuse the existing `matchLinkedInquiries` helper from PR #151 as-is. It takes any `LeadSubmission[]` and performs the visitorId-primary + ±60s timestamp-fallback match (with the cross-org guard). We rename it conceptually but keep the function name for backwards compatibility, OR rename to `matchLinkedLeadsByVisitor` and update both call sites.

**Choice: rename** to `matchLinkedLeadsByVisitor` since the function is no longer inquiry-specific. The existing 7 unit tests don't change (the lead type doesn't matter to the helper).

### Component 1: LINKED DOWNLOADS Card (Right Rail)

**Location:** Inside `OrgDetail` JSX, immediately after the `LINKED INQUIRIES` card. Renders only when `linkedDownloads.length > 0`.

**Card header:** material icon `download` + "Linked Downloads"

**Per-entry layout:**

```
┌──────────────────────────────────────┐
│ MEB-600_datasheet.pdf                 │  ← fileName (subject)
│ Dr. Jane Smith · jane@stanford.edu    │  ← name · mailto
│ Stanford University                   │  ← organization
│ Postdoctoral Researcher               │  ← jobTitle (italic)
│ ─────────────────────                  │
│ Research Areas: thin-film deposition  │  ← researchAreas (line-clamp-2)
│ Intent: evaluating for grant proposal │  ← intent (line-clamp-2)
│ May 19, 2026 11:52 AM                 │  ← submittedAt local time
└──────────────────────────────────────┘
```

**Subject resolution order:** `lead.fileName || lead.productName || 'Download'`.

If `fileName` is missing (e.g. legacy), fall through to `productName` then literal "Download".

### Component 2: LINKED NEWSLETTER Card (Right Rail)

**Location:** Inside `OrgDetail` JSX, immediately after the `LINKED DOWNLOADS` card.

**Card header:** material icon `newspaper` + "Newsletter Signups"

**Per-entry layout (compact, single line per signup):**

```
┌──────────────────────────────────────┐
│ jane@stanford.edu                     │  ← mailto email
│ from: /insights/post-slug             │  ← source (small, faded)
│ May 19, 2026                          │  ← date only (no time — less granularity needed)
└──────────────────────────────────────┘
```

Newsletter leads have only `email`, optional `source`, and timestamp. Three lines per entry, denser than DOWNLOADS or INQUIRIES.

### Component 3: List Row Label Precedence Update

Extend the precedence chain from PR #151:

```ts
const upgradedName = org.rfqInstitution
                  || org.contactOrganization
                  || org.downloadGateOrganization;
const displayMain = upgradedName || org.displayName || org.orgName;
```

The newsletter card does not contribute (no `organization` field captured).

`downloadGateOrganization` is backfilled from `allLeads.filter(type === 'download_gate')` using the same most-recent-non-empty rule as `contactOrganization`.

### Effect Table

| Org State | List Row Main | Cards in Right Rail |
|---|---|---|
| IP only | IP name | none |
| RFQ only | RFQ institution | LINKED RFQS |
| Contact only (org filled) | Contact organization | LINKED INQUIRIES |
| Download gate only (org filled) | Download org | LINKED DOWNLOADS |
| Newsletter only | IP name (no org captured) | LINKED NEWSLETTER |
| Combo: RFQ + contact + download | RFQ wins | LINKED RFQS + INQUIRIES + DOWNLOADS |
| Combo: download + contact (no RFQ) | Contact wins | INQUIRIES + DOWNLOADS |
| All four | RFQ wins | All four cards |

### Card Order in Right Rail

```
DETECTION DETAILS
LINKED RFQS         ← existing
LINKED INQUIRIES    ← PR #151
LINKED DOWNLOADS    ← this PR
LINKED NEWSLETTER   ← this PR
TRAFFIC SOURCES
TECHNICAL CONTEXT
PAGES VISITED
```

Rationale: high-intent first (RFQ → contact → download → newsletter) to match the lead-quality hierarchy already encoded in the page.

## Implementation Plan (single file)

All changes in `src/pages/admin/AdminAnalyticsPage.tsx`, plus a rename of the helper file.

1. **Rename helper** `src/pages/admin/linkedInquiriesMatch.ts` → `linkedLeadsMatch.ts`, export name → `matchLinkedLeadsByVisitor`. Test file renamed accordingly. Tests unchanged otherwise.
2. **Top-level state consolidation:** rename `allContactLeads` → `allLeads`, change fetch from `listLeads('contact')` to `listLeads()` (no filter). Derive three `useMemo`s: `allContactLeads`, `allDownloadGateLeads`, `allNewsletterLeads`.
3. **`OrganizationRecord` type:** add `downloadGateOrganization: string | null`.
4. **Aggregator default:** add `downloadGateOrganization: null` to `aggregateByOrg` records.push (mirror Task 2 of PR #151).
5. **`organizations` memo backfill:** after the existing `contactOrganization` backfill block, add a parallel block for `downloadGateOrganization` using `allDownloadGateLeads`. Same most-recent-non-empty rule.
6. **List row label (desktop + mobile):** extend the upgradedName precedence to include `org.downloadGateOrganization`.
7. **`OrgDetail` prop wiring:** rename `allContactLeads` prop to take `allContactLeads`, `allDownloadGateLeads`, `allNewsletterLeads` (three props). Effects:
   - `linkedInquiries` effect: use renamed helper + `allContactLeads`
   - `linkedDownloads` effect: use renamed helper + `allDownloadGateLeads`
   - `linkedNewsletters` effect: use renamed helper + `allNewsletterLeads`
8. **Render two new cards** in JSX after `LINKED INQUIRIES`.

Estimated diff: ~150 lines added, ~10 lines modified.

## Backward Compatibility

- Historic events without `visitorId` → not matched, cards hide. No errors.
- Orgs with no leads → row label unchanged, no cards.
- The `listLeads()` (no filter) call returns all lead types in one shot; the existing `useLeads('contact')` hook in `LeadsListPage` is untouched (different code path).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Single `listLeads()` call returns more rows than three filtered calls | Acceptable — newsletter and download_gate volumes are smaller than contact, total payload still under MB scale. If it grows, switch back to (a). |
| Newsletter card clutters detail view for orgs with many signups | `space-y-3` between entries, compact 3-line layout. If an org has 20+ signups, scroll within the right rail handles it. Optional future: `slice(0, 10)` with "+ N more" link. |
| Rename of `matchLinkedInquiries` may conflict with PR #151 if both PRs land out-of-order | This PR includes the rename; reviewer should rebase/merge with PR #151 first. Documented in PR description. |
| Download gate `name` field vs request shape `fullName` | Backend normalizes — confirmed `LeadSubmission.name` holds the value regardless of request schema |

## Testing

- **Helper unit tests:** all 7 existing tests in `linkedLeadsMatch.test.ts` continue to pass (just renamed, no logic change).
- **Manual:** open analytics → open an org with download_gate events (M247 Europe SRL per the screenshot that motivated this work) → confirm LINKED DOWNLOADS card with full profile fields; open an org with newsletter signups → confirm LINKED NEWSLETTER card.
- **Regression:** PR #151's LINKED INQUIRIES card still renders correctly with renamed helper + new prop name.
- **Type check:** `npx tsc --noEmit` (filter `main.tsx`) clean.
