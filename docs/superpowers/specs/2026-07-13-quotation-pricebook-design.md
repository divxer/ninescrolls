# Quotation & Price Book System — Design

Date: 2026-07-13
Status: Draft for review (brainstormed and section-approved in session)
Related: `docs/superpowers/specs/2026-07-04-evidence-framework-design.md` (authenticated-only isolation boundary precedent), Customer 360 Timeline spec (Scheme A materialized `TimelineEvent`), LogisticsCase spec (sequential case-number pattern, order-api Lambda pattern).

## Problem

Every customer RFQ currently triggers a fresh quote request to the upstream supplier (~10 RFQs/month at current stage, covering every product line except the plasma cleaner). Two root causes, confirmed in brainstorming:

1. **Too many configuration combinations** — chamber sizes, chucks, gas lines, options vary per customer; no standard configuration table exists on either side.
2. **No internal price accumulation** — previously obtained prices are scattered across WeChat/email; there is no queryable internal price book, so every RFQ restarts the supplier conversation.

Suppliers are willing to negotiate **annual framework price lists** (standard machine + common options, 6–12 month validity). That business action is the prerequisite for this system; the system's job is to digitize, maintain, and apply those framework prices so that only *expired or missing* items ever require a new supplier round-trip.

## End state (locked)

A full-loop quotation system inside the existing admin backend:

select configuration → validate → compute suggested price → manual adjust → generate quotation PDF → link to RFQ → accumulate quote & deal history.

P1/P2 below are **delivery order only**, not architecture. The P1 data model and API serve the end state directly; there is no interim export format, no Python bridge layer, and no one-off integration interface at any phase.

## Scope boundaries

- **Internal-only in P1 — no supplier login of any kind.** Evolution path (documented, deliberately not built now):
  1. P1: suppliers send framework price lists via Excel/email; owner imports/updates; system owns validity, change history, expiry reminders.
  2. Later: time-limited secure update links (supplier sees and updates only their assigned items; submissions land in a pending-review state; no account registration).
  3. Only with significant volume growth: full supplier portal with per-supplier accounts and internal approval of every change.
  - The data model reserves `supplierId`, `priceSource`, and `reviewStatus` from day one so stages 2–3 need no remodeling.
- **Compatibility rules are limited to four kinds**: required options, mutually exclusive options, dependency (A requires B), quantity limits. No general rule engine.
- **No email sending** in P1/P2. "Sent" is recorded manually (time, recipient, channel); an actual send capability can attach later.
- **Quotation is not an order.** `ACCEPTED` never auto-creates an Order; the owner clicks "Convert to Order" explicitly (P2). Existing RFQ/Order filtering and statistics are unaffected.
- Supplier identities remain confidential (standing OEM non-disclosure policy). The entire model is authenticated-only; no field is ever exposed through a public API. This follows the Evidence Framework's proven server-side isolation boundary.

## Core data model (five entities)

Governing principle: **the catalog stores the current standard; the quotation stores the point-in-time snapshot.** Deal history is derived exclusively from `ACCEPTED` quotations — there is no separate (and inevitably divergent) "deal price table."

### 1. Supplier
- Name, contact, currency, default price validity period.
- Suspended/active status, internal notes.
- Confidential, internal-only (see scope boundaries).

### 2. CatalogItem
- Standard machine, option/accessory, consumable, or service.
- Internal SKU, product series, spec attributes, compatibility relations (the four limited kinds only).
- Supplier cost, cost currency (RMB typical), validity period.
- **Cost versions are append-only**: a price update creates a new cost version; old versions are retained as history, never overwritten.
- Each cost version carries:
  - `priceSource`: `MANUAL_ENTRY` | `SUPPLIER_EXCEL` | (reserved) `SUPPLIER_LINK`
  - `reviewStatus`: present from day one; P1 writes `APPROVED` unconditionally — the field's review semantics activate with evolution stage 2.

### 3. PricingPolicy
- Default exchange rate (manually maintained, timestamped — deliberately **not** a live FX API: quotes must be reproducible and auditable).
- Target margin rate and minimum margin rate.
- Override rules at product-series and single-item level (most-specific wins: item → series → global).
- Surcharge rules: freight, tariff, installation, warranty.
- Every computed result may be manually overridden, but the override must record a reason.

### 4. Quotation
- Quotation number (sequential, LogisticsCase pattern, e.g. `Q-2026-0001`), version, status, linked RFQ.
- Multiple named schemes per RFQ (e.g. Standard / Advanced), each scheme independently versioned (v1, v2, …). **Each scheme owns its own quotation number; versions of the same scheme share that number** (`Q-2026-0001` v1/v2). An RFQ aggregates its schemes via GSI.
- Customer, currency, validity period, trade terms (Incoterms), payment terms.
- Suggested total, actual quoted total, total cost, margin.
- PDF S3 location + generation timestamp (P2).
- Status machine: `DRAFT → GENERATED → SENT → ACCEPTED / REJECTED / EXPIRED`.
  - **`GENERATED` is produced only by a successful PDF write to S3.** In P1 (no PDF pipeline yet) the maximum reachable status is `DRAFT`.
  - Non-accepted sibling versions of an accepted quotation are flagged `superseded` — a boolean marker, not a sixth status value — and are never deleted.

### 5. QuotationLineSnapshot
- At quote time, copies product name, specs, cost, cost-version reference, exchange rate, and the resolved pricing rule into the line.
- Later catalog/policy changes never mutate historical quotations.
- Editing a generated quotation never modifies it in place — it copies the snapshot into the next version.
- Stores per line: suggested price, actual price (post-allocation, see pricing), cost, margin; line type distinguishes normal lines from surcharge lines.

### Implementation constraints (from codebase history)
- **List resolvers use GSI partition-merge from day one, never table Scan** — the Scan anti-pattern silently dropped fresh records twice before (fixed in PR #268 listLeads, PR #269 listOrders); price-api list resolvers follow the corrected listRfqs pattern.
- New backend follows the order-api / logistics-api Lambda + DynamoDB single-table pattern.
- Expiry-reminder cron guards with `if (!isSandbox)` (sandbox crons fire live; PR #218 precedent).

## Pricing calculation

Pipeline (runs at quote time; every input and output lands in the snapshot):

1. **Cost aggregation** — each line takes the CatalogItem's currently effective cost version. An expired cost **flags the line but does not block quoting**; the UI states "reconfirm with supplier." This is the core cost-saving mechanism: only expired/missing items trigger supplier contact.
2. **Currency conversion** — manually maintained rate from PricingPolicy; the rate value is written into the snapshot.
3. **Margin** — margin is **on selling price**: `margin = (price − cost) / price`, hence `price = cost / (1 − margin)`. One canonical definition; cost-markup is not used anywhere. Override precedence: item → series → global.
4. **Surcharges** — freight, tariff, installation, warranty are independent lines with their own line type; default cost pass-through (no margin), overridable per rule; can be shown itemized or folded into the total on the PDF.
5. **Rounding** — suggested price rounds at a configurable granularity (e.g. $100); both pre- and post-rounding values are stored.

Manual overrides:

- Allowed at line level and total level; a reason is **required** and the operator is recorded (audit completeness, not an approval workflow — single-operator business).
- Actual margin is recomputed live and compared against target; **below minimum margin warns but never blocks.**
- **Total-level price changes are allocated proportionally** across eligible normal lines by their suggested prices, producing a per-line "actual price." Surcharge/tax/freight lines are explicitly marked non-allocatable and excluded. Cent-level residue from allocation is assigned to the largest line (largest-remainder method) so line totals always sum exactly to the quoted total — line margins, historical configuration prices, and PDF line items stay mutually consistent.
- Suggested price, actual price, cost, and actual margin all enter the snapshot; after acceptance this is the deal-history record.

## Quotation workflow & RFQ linkage

`RFQ → create quotation draft → select standard configuration → validate → compute suggested price → manual adjust → generate PDF → send → accept/reject/expire`

- "Create quotation" on the RFQ detail page pre-fills customer, product, application requirements, and RFQ number.
- One RFQ ⇒ multiple schemes ⇒ multiple versions each; versions are immutable snapshots (editing copies to the next version).
- PDF generation is gated on passing the four compatibility validations.
- Missing/expired cost allows generation only after an explicit second confirmation; the internal warning **never appears on the customer PDF**.
- PDF success ⇒ upload to S3 ⇒ immutable document record. Regeneration of the same version is idempotent: deterministic S3 key `quotations/{quotationNumber}/v{version}.pdf`, same object overwritten, no new document record.
- "Generate PDF" and "Mark as sent" are separate actions — a preview download is not a send.
- `SENT` updates the linked RFQ's quote status and emits a Customer 360 `TimelineEvent` (Scheme A materialized event + shared resolver), as do subsequent status changes — the customer timeline shows when what was quoted.
- `ACCEPTED` becomes the sole source of deal history; sibling versions become `superseded`.
- P1/P2 record send metadata only (time, recipient, channel); no email integration.

## Admin UI

Four pages, all following existing admin patterns (lazy-loaded admin routes, OrderListPage list conventions):

1. **Price Book** — CatalogItem list grouped by product series; validity badges (active / expiring ≤30d / expired); expandable per-item cost-version history; an "expired items" count card at top — this is the owner's literal "what to ask suppliers" list.
2. **Suppliers** — non-paginated card list with status and internal notes. Non-pagination is a deliberate product constraint: **P1 supports at most 10 suppliers.** Scaling beyond that is a future design task covering API cursor pagination and UI together — it is not a one-line change and is not promised as such.
3. **Quotation Workbench** — the core page. Left: select machine + options with live validation of the four rule kinds. Right: live cost, suggested price, adjusted actual price, margin (red warning below minimum). Bottom: generate PDF / mark sent / status actions (P2).
4. **RFQ detail enhancement** — a "Quotations" section listing all schemes/versions for the RFQ, plus the "Create quotation" entry button.

Excel import of supplier price lists is a **script** (`scripts/import-supplier-prices.ts`, same pattern as existing admin scripts), not an upload UI — monthly update frequency does not justify a UI.

## PDF generation (P2)

- TypeScript pipeline reusing the equipment-guide PDF infrastructure (embedded fonts, page-order-driven), porting the current Python quotation template to a TS template.
- Acceptance: same real quotation data rendered by old and new templates side by side; layout, fonts, tables, and terms text verified item by item.
- Until P2 acceptance, the existing local Python script continues to be used **independently and unchanged** — P1 does not claim PDF integration and builds no bridge to it. The P2 TS PDF service reads the same `Quotation + QuotationLineSnapshot` records directly, so no intermediate format ever exists.
- The Python template is archived only after the TS PDF passes visual side-by-side acceptance.

## Delivery phases (order only; end state fixed)

- **P1**: data model, price-api, Price Book page, Suppliers page, Excel import script, configuration validation, pricing calculation, quotation snapshot. P1 ends at "generate and persist a complete quotation snapshot"; maximum quotation status is `DRAFT`.
- **P2**: TS PDF generation, idempotent S3 storage, full status machine, RFQ / Customer 360 timeline integration, version comparison, manual Convert to Order.

## Explicitly not doing (P1, some P1+P2)

- Supplier portal or any supplier login (P1) — see evolution path.
- Email sending (P1+P2).
- General compatibility rule engine (beyond the four kinds).
- Live FX rate API.
- Auto-creating Orders from accepted quotations.
- Excel upload UI (script only).
- Python bridge layer or interim export interfaces (never, any phase).

## Testing

- TDD per repo convention (Vitest; exclude `**/.claude/**` worktree globs).
- Pricing pipeline is pure-function testable: margin math, override precedence, proportional allocation + largest-remainder rounding (line sums must equal total exactly), rounding granularity, expired-cost flagging.
- Compatibility validation: table-driven tests over the four rule kinds.
- price-api resolvers: unit tests per logistics-api precedent (35-test suite pattern); list resolvers asserted to use Query on GSI partitions, never Scan.
- Snapshot immutability: editing a quotation produces a new version; the prior version's stored values are bit-identical afterward.
- P2 PDF: golden-file comparison against accepted reference renders.
