# Order Quote Expiration — Design

**Date:** 2026-05-09
**Scope:** `/admin/orders` — track quote validity period and surface expired quotes in the admin UI.

## Problem

Quotation PDFs sent to customers carry an explicit validity window (typically 30 days). The Order Tracker today has no field for this date, and no signal in the admin UI when a sent quote has lapsed. Admins must remember per-order which quotes are still actionable.

## Non-goals

- No automated state transitions (no `EXPIRED` status, no cron, no Lambda scheduling).
- No customer-facing expiration emails.
- No backfill of `quoteValidUntil` for existing orders.
- No OCR/LLM extraction from uploaded quotation PDFs.

## Design

### Data model

Add one field to the `Order` customType in `amplify/data/resource.ts`:

```ts
quoteValidUntil: a.date(),   // nullable
```

Placed adjacent to `quoteDate`. No changes to the `OrderStatus` enum.

Expiration is a **derived property**, not a stored status:

```ts
isQuoteExpired(order, today) =
  order.status === 'QUOTE_SENT'
  && order.quoteValidUntil != null
  && order.quoteValidUntil < today
```

Rationale: `QUOTE_SENT` is not a terminal state — orders progress to `PO_RECEIVED` or `DECLINED`. Encoding expiration as a separate enum value would either pollute the state machine or require synchronization logic. As a derived flag, expiration disappears automatically when an order advances past `QUOTE_SENT`, while `quoteValidUntil` is retained for history.

### Write path

**`src/pages/admin/CreateOrderPage.tsx`**
- Add a `quoteValidUntil` date input adjacent to the existing `quoteDate` input.
- Default value: `quoteDate + 30 days`.
- Linkage: while the user has not manually edited `quoteValidUntil`, changes to `quoteDate` recompute `quoteValidUntil = quoteDate + 30d`. Once the user edits `quoteValidUntil`, a `validUntilTouched` flag freezes it from further auto-recomputation.
- Field is optional. Empty value persists as `null` (no expiration tracked).
- Form validation: if both dates present, require `quoteValidUntil >= quoteDate`.

**`src/pages/admin/OrderDetailPage.tsx`**
- Edit mode exposes `quoteValidUntil` with the same rules. Field can be cleared.
- Mutation goes through the existing `updateOrder` resolver in the order-api Lambda.

**`amplify/functions/order-api/`**
- Create / update handlers accept `quoteValidUntil` and pass through to DynamoDB. No server-side defaulting (defaults live in the form).
- Server-side validation rejects `quoteValidUntil < quoteDate` as a defensive guard.
- When `quoteValidUntil` changes on update, append an `OrderLog` entry: `action: "Quote validity updated"`, with `detail` capturing old → new date.

### Display path

**`src/pages/admin/OrderListPage.tsx`**
- For each row whose status is `QUOTE_SENT`:
  - If expired (`quoteValidUntil < today`): red `Expired` badge next to the status badge.
  - If expiring within 7 days: amber `Expires in Nd` badge.
  - Otherwise: no extra badge.
- Add a "Show expired only" filter checkbox alongside existing status filters.
- Default sort order is unchanged.

**`src/pages/admin/OrderDetailPage.tsx`**
- Quote info section (alongside `quoteNumber`, `quoteAmount`) renders `Quote Valid Until: YYYY-MM-DD`.
- Expired: date in red with suffix `(expired N days ago)`.
- Within 7 days: date in amber with suffix `(expires in Nd)`.
- Healthy or null: neutral styling (or hidden if null).

**`OrderStats` ([amplify/data/resource.ts:293](../../../amplify/data/resource.ts))**
- Add `expiredQuotes: a.integer().required()` — count of orders with `status === 'QUOTE_SENT'` and `quoteValidUntil < today`.
- order-api `orderStats` handler computes this alongside existing aggregates.
- Admin list page renders an "Expired Quotes" stat card next to `overdueOrders` and `upcomingDeliveries`.

### Shared helper

A pure function `isQuoteExpired(order, today)` lives in `src/lib/orderHelpers.ts` (created if absent) and is reused by:
- List page badge logic
- Detail page badge logic
- A sibling `quoteExpiryStatus(order, today): 'expired' | 'soon' | 'ok' | 'none'` for the tri-state UI rendering

Server-side aggregation in the Lambda uses an equivalent inline check (Lambda runtime cannot import frontend modules).

### Edge cases

- `quoteValidUntil < quoteDate` — blocked at form level; defensively rejected by Lambda.
- Order advances past `QUOTE_SENT` — expiration UI disappears automatically (derived property short-circuits on status). `quoteValidUntil` is retained as historical metadata.
- A customer issues a PO after the quote expired — does not block status transition to `PO_RECEIVED`. Once status changes, no expired badge.
- Timezone: `a.date()` is a calendar date with no timezone. Comparisons use `new Date().toISOString().split('T')[0]` — same convention as existing `quoteDate` handling.
- Existing orders have `quoteValidUntil = null` — never display expired badge for them. No backfill.

### Testing

- Unit tests for `isQuoteExpired` and `quoteExpiryStatus` in `src/lib/orderHelpers.test.ts` covering: expired, expiring-within-7d, ok, non-`QUOTE_SENT` status, null-validUntil.
- Lambda unit test for `expiredQuotes` aggregation in `orderStats`.
- Component test for `CreateOrderPage` covering: default = quoteDate + 30d, linkage updates, `validUntilTouched` freezes auto-recompute, validation rejects validUntil < quoteDate.

## Out of scope (explicit)

- No `EXPIRED` enum value.
- No background job, cron, or Lambda schedule.
- No email or notification.
- No bulk-edit / bulk-extend tools.
- No PDF parsing of uploaded quotation files to extract validity.
