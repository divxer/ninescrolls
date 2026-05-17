# Admin Analytics — Linked Inquiries Card & Org-Name Upgrade

**Status:** Approved
**Date:** 2026-05-16
**Scope:** `src/pages/admin/AdminAnalyticsPage.tsx` only

## Problem

When a customer submits the contact form (e.g. "Technical Feasibility Check" inquiry), the admin analytics detail page (`/admin/analytics/<org>`) only shows a generic "Contact Form Submitted" entry in the Activity Ledger. The actual submission content — name, email, phone, organization, message — is not visible anywhere on the analytics page. To see the inquiry content, the admin has to navigate to a separate `/admin/leads` page and find the matching record manually.

RFQ submissions already have a dedicated `LINKED RFQS` card in the right rail of the org detail view, plus an implicit "has RFQ" signal in the Organization Ledger row (the institution name from the RFQ replaces the IP-detected org name, and the IP-detected name becomes a small sub-line with a `dns` icon).

Contact form submissions need the same two affordances.

## Goal

Mirror the RFQ pattern exactly, with **zero changes outside `AdminAnalyticsPage.tsx`**.

1. **Detail view:** A `LINKED INQUIRIES` card in the right rail of the org detail view, listing every contact form submission that belongs to this org. Self-contained (shows full inquiry content inline — no navigation needed).
2. **List view:** When an org has a contact form submission with the `organization` field filled in, that organization name becomes the primary row label and the IP-detected org name drops to a small sub-line with a `dns` icon (matching the existing RFQ behavior). RFQ data still wins when both exist.

## Non-Goals

- No new pages, routes, or hooks.
- No changes to `LeadsListPage.tsx`, form components, segment tracking, analytics storage, or backend.
- No new "Has Inquiries" filter chip or new table column.
- No clickable navigation from the inquiries card to a detail page (the card is self-contained).

## Design

### Data Source

- `orderAdminService.listLeads('contact')` already exists and returns `LeadSubmission[]` with all fields needed (`name`, `email`, `phone`, `organization`, `message`, `inquiryType`, `topic`, `productName`, `submittedAt`, `visitorId`).
- `LeadSubmission.visitorId` is the linkage key (the visitor's stable browser ID, set on submit via `getVisitorId()`).
- `AnalyticsEvent.visitorId` is the same key, present on every event.

### Matching Strategy (mirrors `linkedRfqs` hybrid)

For an org's contact_form events, find matching leads using **two signals**:

1. **Primary — visitor ID match:** `lead.visitorId ∈ Set(org.events[*].visitorId)`. This is the strong, deterministic match.
2. **Fallback — timestamp proximity:** `|lead.submittedAt − contactFormEvent.timestamp| < 60_000ms`. Catches legacy leads where `visitorId` was missing or cleared.

Union both sets, deduplicate by `leadId`, sort by `submittedAt` descending.

### Component 1: `LINKED INQUIRIES` Card (Right Rail)

**Location:** Inside the org detail view JSX, immediately after the `LINKED RFQS` card (~line 2365). Renders only when `linkedInquiries.length > 0`.

**Card styling:** Identical to LINKED RFQS — `bg-surface-container-lowest rounded-xl p-6 shadow-elevated` with the same outline-variant border. Header uses material icon `contact_mail` (RFQ uses `request_quote`).

**Per-entry layout:**

```
┌──────────────────────────────────────┐
│ Technical Feasibility Check           │  ← subject (no badge — see note)
│ Bernd Schmidt · bernd@telekom.de      │  ← name · mailto email
│ +49 175 1234567                       │  ← phone (optional)
│ Deutsche Telekom AG                   │  ← organization (optional)
│ ─────────────────────────             │
│ "Looking for PECVD specs for our…"   │  ← message preview (line-clamp-3, hover for full)
│ May 16, 2026 02:14 PM                 │  ← submittedAt local time
└──────────────────────────────────────┘
```

**No type badge** on the entry. The card only ever holds `type === 'contact'` leads, so a per-entry "contact" badge would be uninformative noise. (RFQ's badge is informative because it shows pending/converted/declined status; contact leads have no comparable status field.)

**Subject resolution order:** `lead.productName || lead.topic || lead.inquiryType || 'General Inquiry'`.

Rationale: `ContactFormInline` writes the human-readable label (e.g. "Technical Feasibility Check") into `productName`, while `ContactFormModal` writes raw enums (`'budgetary'` / `'general'`) into `inquiryType`. Putting `productName` first yields friendly labels for the inline form; `inquiryType` is the last resort and only shows raw enums if no other field is populated. If the implementing agent finds raw enums still leak through, map them to labels at render time using the same mapping in `ContactFormInline.tsx:166-174`.

**Email:** Rendered as `<a href="mailto:...">` for one-click reply.

**Message:** `whitespace-pre-wrap line-clamp-3`, with the full message as the `title` attribute for hover preview.

**Not clickable as a whole** — no `<a>` wrapper around the entry, because the user requested no navigation to other pages. The card is the destination.

### Component 2: Org-Name Upgrade in List Row

**Aggregation change** (~line 955 area, where org grouping happens): when building each `org` aggregate, attach a new field:

```ts
org.contactOrganization = mostRecentContactLead?.organization || undefined;
```

Where `mostRecentContactLead` is the most recent (by `submittedAt`) contact lead with a non-empty `organization` field, matched to that org by the same visitorId/timestamp strategy used in Component 1. To avoid recomputing the match in two places, the org aggregator can either:

- (a) Reuse the same `listLeads('contact')` Promise (cache at the top-level component scope), or
- (b) Compute `contactOrganization` lazily inside the org detail effect and lift it up via a separate state map.

**Recommendation:** option (a) — load `listLeads('contact')` once at the top of `AdminAnalyticsPage`, expose as `contactLeadsByVisitorId: Map<string, LeadSubmission>` (storing the most recent lead per visitor), and use that map both in the org aggregator (for `contactOrganization`) and in the detail effect (for `linkedInquiries`).

**Render-order consequence:** the org aggregator (a `useMemo`) must list `contactLeadsByVisitorId` in its dependency array. First render runs the aggregator with an empty map → orgs have `contactOrganization === undefined` and rows show the IP name; once `listLeads` resolves, state update triggers a second render that recomputes the aggregator with leads applied. This re-render is one-shot per page load.

**Multi-visitor tie-break:** an org may aggregate events from multiple visitors who each submitted with a different `organization` string ("Telekom AG" vs "DT"). The rule is "most recent contact lead with non-empty `organization`, across all matching visitors" — sort by `submittedAt` descending and take the first. Acceptable inconsistency: the row label will flip if a newer lead with a different org string arrives later.

**Row rendering change** (line 3704-3709):

Before:
```tsx
<span ...>{org.rfqInstitution || org.displayName || org.orgName}</span>
{org.rfqInstitution && org.rfqInstitution.toLowerCase() !== org.orgName.toLowerCase() && (
  <span ...><span ...>dns</span>{org.orgName}</span>
)}
```

After:
```tsx
const upgradedName = org.rfqInstitution || org.contactOrganization;
const displayMain = upgradedName || org.displayName || org.orgName;
const showSubLine = !!upgradedName && upgradedName.toLowerCase() !== org.orgName.toLowerCase();
...
<span ...>{displayMain}</span>
{showSubLine && (
  <span ...><span ...>dns</span>{org.orgName}</span>
)}
```

Same precedence rule: **RFQ institution wins when both are present.** Sub-line continues to use the `dns` icon (no differentiation by source) to match the existing visual language.

The mobile org card block (line 3747-3771) gets the same treatment with the same helper.

### Effect Table

| Org State | List Row Main | List Row Sub | Detail Right Rail |
|---|---|---|---|
| IP only (no submissions) | IP name | — | No INQUIRIES / RFQS cards |
| RFQ only | RFQ institution | 🗄 IP name | LINKED RFQS card |
| Contact form only (with org field) | Contact organization | 🗄 IP name | LINKED INQUIRIES card |
| Contact form only (org field blank) | IP name | — | LINKED INQUIRIES card |
| Both RFQ + contact form | RFQ institution | 🗄 IP name | LINKED RFQS + LINKED INQUIRIES cards |

## Implementation Plan (single file)

All changes in `src/pages/admin/AdminAnalyticsPage.tsx`:

1. **Imports:** Add `LeadSubmission` type to existing admin types import.
2. **Top-level state:** `useState<Map<string, LeadSubmission>>` for `contactLeadsByVisitorId`. Load via `listLeads('contact')` in a `useEffect` running once on mount, keyed by `lead.visitorId` for O(1) lookup. Also keep the raw `LeadSubmission[]` array for timestamp-fallback matching.
3. **Org aggregator** (~line 955): for each org, look up the most recent contact lead whose `visitorId` matches any of the org's events; attach `org.contactOrganization`.
4. **Org type definition:** add optional `contactOrganization?: string | null` to `interface OrganizationRecord` ([AdminAnalyticsPage.tsx:30](src/pages/admin/AdminAnalyticsPage.tsx:30)), alongside the existing `rfqInstitution: string | null` field.
5. **Detail-view effect** (~line 1405, after `linkedRfqs` effect): mirror the `linkedRfqs` hybrid matching but for leads. Set `linkedInquiries` state.
6. **JSX** (~line 2365, after LINKED RFQS card): render the LINKED INQUIRIES card (conditional on `linkedInquiries.length > 0`).
7. **List row** (line 3704-3709): apply the `upgradedName / displayMain / showSubLine` helper.
8. **Mobile card** (line 3747-3771): apply the same helper.

Estimated diff: ~90 lines added, ~6 lines modified.

## Backward Compatibility

- Historic `contact_form` events without `visitorId` or without nearby leads in time → simply not matched, card hides. No errors.
- Orgs with no contact form → `org.contactOrganization` is `undefined`, list row falls through to existing precedence. No visual change.
- `LINKED RFQS` card behavior is untouched.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `listLeads('contact')` returns a large dataset and slows initial load | Currently RFQ list does the same pattern (`listRfqs()` for legacy match) and is acceptable. If volume grows, add server-side filter by visitorId set. |
| Timestamp fallback creates false positives across orgs | The fallback only fires when an org has a `contact_form` event; the ±60s window is narrow enough that cross-org collisions in the same minute are negligible at current scale. |
| Lead `organization` field is the customer-typed string and may be misspelled / inconsistent with RFQ institution | Acceptable — RFQ institution wins, and contact organization is only used when RFQ is absent. |
| `listLeads('contact')` runs on every analytics page load (not lazily on detail-view click like RFQ) | Deliberate — `contactOrganization` is needed at aggregation time for the list view. Cost is one DDB query per admin page open, comparable to the existing `listRfqs()` call. Re-evaluate if leads volume exceeds ~5k. |
| Contact form messages contain customer PII (project descriptions, names, contact details) and are now surfaced inside the analytics page | Confirmed acceptable — both `/admin/analytics` and `/admin/leads` route through the same `AdminRoute` auth boundary ([src/components/admin/AdminRoute.tsx](src/components/admin/AdminRoute.tsx)), so this does not broaden access. |

## Testing

- **Manual:** Submit a contact form from an org with a known `visitorId`, verify (a) the LINKED INQUIRIES card appears on that org's detail page with full content, (b) the list row shows the typed organization as the main name and IP name as sub-line.
- **Regression:** Open an org that has an RFQ → RFQ wins, list row unchanged. Open an org with neither → no card, no sub-line.
- **Type check:** `npx tsc --noEmit` passes.
