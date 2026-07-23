# Corporate-Proxy (Security Proxy / Browser Isolation) Visitor Classification — Design

**Date:** 2026-07-23
**Status:** Approved

## Problem

Visitors browsing through enterprise browser-isolation / secure-web-gateway proxies
(Menlo Security, Zscaler, iboss, Cloudflare Gateway/WARP, Netskope, Forcepoint) egress
from the *vendor's* IP space. The analytics pipeline then attributes the visit to the
vendor:

1. `lookupIP()` in the `/d` (server-track) Lambda resolves `orgName` to e.g.
   "Menlo Security, Inc." with `organizationType: 'unknown'` (no IPinfo token →
   no `company.type`), which is in `AI_CLASSIFY_ORG_TYPES`.
2. The classify-org Lambda's AI prompt receives the vendor name and correctly-but-
   uselessly classifies it ("cybersecurity company, does not conduct R&D" →
   `enterprise`, not target). The real reader behind the proxy is hidden.
3. Admin aggregation (`orgAggregation.ts`) only splits visitors for
   `ISP_ORG_TYPES = {'telecom_isp','isp'}`, so all visitors behind one proxy vendor
   collapse into a single org record, and `aiIdentifiedRealOrg` blocks the
   anonymous-high-intent behavior flag.

Observed instance: a Taiwan semiconductor reader egressing from Menlo Security's
Taipei proxy range (57.140.x.x) surfaced as "Menlo Security, Inc." — a genuine ICP
visitor rendered invisible. The first live Stripe buyer similarly surfaced as
"Cloudflare, Inc. · Needham, Massachusetts" (PR #341).

## Design

### Shared vendor matcher — `amplify/lib/analytics/proxy-vendors.ts`

New shared module (frontend imports from `amplify/lib` are established precedent:
`amplify/lib/rfq/contract.ts`, `amplify/lib/evidence/status.ts`):

- `SECURITY_PROXY_PATTERNS`: case-insensitive regexes for `menlo security`,
  `zscaler`, `iboss`, `cloudflare`, `netskope`, `forcepoint`.
- `isSecurityProxyOrg(...names: Array<string | undefined>)` → true if any provided
  name (org / orgName / isp) matches.
- New `organizationType` value: **`corporate_proxy`**.

Deliberate trade-off: matching plain "Cloudflare" covers WARP/Gateway/Private-Relay-
style egress (how the PR #341 buyer surfaced) at the cost of treating actual
Cloudflare employees as proxy visitors — the same trade-off ISP handling already
makes for residential ISPs.

### 1. `/d` Lambda (`server-track/handler.ts`, `lookupIP`)

After org-type resolution, if `org`/`orgName`/`isp` matches the vendor list →
`organizationType = 'corporate_proxy'`. Consequences fall out of existing gates:

- Not in `AI_CLASSIFY_ORG_TYPES` → AI never sees the vendor name (also saves
  Bedrock/Anthropic calls).
- Not in `CATEGORICAL_TARGET_TYPES` → no target/tier derived from the vendor name.
- `orgName` is retained for display (per-visitor "Menlo Security, Inc. · Taipei",
  like ISP visitors today).
- Add `'corporate_proxy'` to `NEVER_TARGET_TYPES` (belt-and-braces: name-based
  targeting only; behavior-based scoring is independent and unaffected).

### 2. classify-org Lambda — deterministic short-circuit

Defense in depth for the legacy `/geo` path and admin "reclassify"/force flows: in
the classify flow, after the manual-override cache check but before any AI call, if
`orgName` matches the vendor list → return
`{ organizationType: 'corporate_proxy', isTargetCustomer: false, confidence: 1.0,
reason: 'Security proxy / browser-isolation vendor egress — real visitor org unknown' }`.
Manual overrides still win (checked first). The TS `ClassifyResult` union widens to
include `corporate_proxy`; the AI prompt/JSON enum is unchanged (the model never
sees these names).

### 3. Admin aggregation (`orgAggregation.ts`)

- Add `'corporate_proxy'` to `ISP_ORG_TYPES` → visitorId splitting, no merge-back,
  `isISPVisitor: true` → the PR #341 stable visitorId override key
  (`orgOverrideKey`) applies automatically.
- **Historical-data fallback:** `addIfISP` additionally matches org names via
  `isSecurityProxyOrg` regardless of stored classification. Stored events already
  carry `aiOrganizationType: 'enterprise'` and never re-classify; the DDB AI cache
  entry expires (≤7-day TTL) but events don't. Name matching retroactively splits
  existing proxy-vendor groups.
- `aiIdentifiedRealOrg` excludes `corporate_proxy` and proxy-matched org names →
  the behavior-based `isAnonymousHighIntent` flag can fire for these visitors.

### 4. behaviorAnalytics

Add `'corporate_proxy'` to `NON_KNOWN_ORG_TYPES` (UTM "known organizations"
counting must not count proxy vendors as identified orgs).

## Testing

- Matcher table test (vendor names as they appear in ipinfo/ipapi org strings,
  ASN-prefixed forms, negatives like "Menlo College", "Cloud Nine Fabrication").
- `orgAggregation.test.ts`: a historical group keyed "Menlo Security, Inc." with
  `aiOrganizationType: 'enterprise'` events and two visitorIds splits into two
  `isISPVisitor` records; behavior-based anonymous-high-intent still eligible;
  stable override key round-trip.
- classify-org handler test: short-circuit returns deterministic result, no
  Bedrock/Anthropic call, manual override still wins.
- server-track test: `lookupIP` org-type override for proxy vendor org strings.

## Out of scope

- No IP-range (57.140.x.x) matching — org-name matching is provider-stable and
  covers all egress cities; ranges churn.
- No admin UI label change for the raw `corporate_proxy` string (rendered as-is
  where org types are shown today).
- No reclassification backfill script for stored events — the admin-side name
  fallback makes history display correctly without rewriting DDB.
