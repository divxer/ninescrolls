# Corporate-Proxy Visitor Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat security-proxy / browser-isolation vendors (Menlo Security, Zscaler, iboss, Cloudflare, Netskope, Forcepoint) like ISPs: split visitors by visitorId, never feed the vendor name to AI classification, tag them `corporate_proxy`, and keep behavior-based scoring alive.

**Architecture:** A shared name matcher in `amplify/lib/analytics/proxy-vendors.ts` (imported by both Lambdas and the frontend, following the `amplify/lib/rfq` precedent). The `/d` Lambda tags matching lookups `organizationType: 'corporate_proxy'` (outside `AI_CLASSIFY_ORG_TYPES` → AI skipped). classify-org short-circuits matching org names to a deterministic result before any AI call (defense in depth + kills stale AI cache). Admin aggregation adds `corporate_proxy` to `ISP_ORG_TYPES` plus a name-based fallback so *historical* events (stored with `aiOrganizationType: 'enterprise'`) also split per visitor.

**Tech Stack:** TypeScript, Vitest, AWS Lambda (amplify), React admin (no UI changes).

**Spec:** `docs/superpowers/specs/2026-07-23-corporate-proxy-classification-design.md`

---

### Task 1: Shared vendor matcher `amplify/lib/analytics/proxy-vendors.ts`

**Files:**
- Create: `amplify/lib/analytics/proxy-vendors.ts`
- Test: `amplify/lib/analytics/proxy-vendors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// amplify/lib/analytics/proxy-vendors.test.ts
import { describe, it, expect } from 'vitest';
import { isSecurityProxyOrg } from './proxy-vendors';

describe('isSecurityProxyOrg', () => {
  it('matches known security-proxy / browser-isolation vendors', () => {
    // Names as they appear in ipinfo/ipapi org strings (with and without ASN prefix)
    expect(isSecurityProxyOrg('Menlo Security, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('AS399629 Menlo Security, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('MENLO-SECURITY')).toBe(true);
    expect(isSecurityProxyOrg('Zscaler, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('ZSCALER-INC')).toBe(true);
    expect(isSecurityProxyOrg('iboss, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('Cloudflare, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('CLOUDFLARENET')).toBe(true);
    expect(isSecurityProxyOrg('Netskope Inc')).toBe(true);
    expect(isSecurityProxyOrg('Forcepoint Cloud Ltd')).toBe(true);
  });

  it('does not match lookalikes or ordinary orgs', () => {
    expect(isSecurityProxyOrg('Menlo College')).toBe(false);
    expect(isSecurityProxyOrg('Menlo Park Research LLC')).toBe(false);
    expect(isSecurityProxyOrg('Cloud Nine Fabrication')).toBe(false);
    expect(isSecurityProxyOrg('Bossier University')).toBe(false);
    expect(isSecurityProxyOrg('Stanford University')).toBe(false);
    expect(isSecurityProxyOrg('China Mobile')).toBe(false);
  });

  it('checks every provided name and tolerates null/undefined/empty', () => {
    expect(isSecurityProxyOrg(undefined, null, '')).toBe(false);
    expect(isSecurityProxyOrg()).toBe(false);
    // org empty but isp carries the vendor
    expect(isSecurityProxyOrg('', undefined, 'Zscaler, Inc.')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/analytics/proxy-vendors.test.ts`
Expected: FAIL — `Cannot find module './proxy-vendors'` (or equivalent resolve error)

- [ ] **Step 3: Write the implementation**

```typescript
// amplify/lib/analytics/proxy-vendors.ts
/**
 * Security-proxy / browser-isolation vendors whose egress IPs mask the real
 * visitor's organization (secure web gateways, remote browser isolation,
 * Zero-Trust network access). A visit attributed to one of these org names
 * tells us NOTHING about the visitor — classifying the vendor itself is the
 * misattribution this module prevents (e.g. a Taiwan semiconductor reader
 * surfacing as "Menlo Security, Inc. — cybersecurity company, does not
 * conduct R&D").
 *
 * Shared by the server-track (/d) Lambda, the classify-org Lambda, and the
 * admin analytics frontend (same amplify/lib sharing precedent as
 * amplify/lib/rfq and amplify/lib/evidence).
 *
 * Name-based on purpose: vendor org names are stable across every egress
 * city; IP ranges churn. Matching plain "Cloudflare" covers WARP/Gateway
 * egress (how the first live Stripe buyer surfaced, PR #341) at the cost of
 * treating actual Cloudflare employees as proxy visitors — the same
 * trade-off ISP handling already makes for residential ISPs.
 */
const SECURITY_PROXY_PATTERNS: RegExp[] = [
  /menlo[\s-]*security/i,
  /zscaler/i,
  /\biboss\b/i,
  /cloudflare/i,
  /netskope/i,
  /forcepoint/i,
];

/**
 * True when any provided name (org, orgName, isp — pass whichever you have)
 * matches a known security-proxy vendor.
 */
export function isSecurityProxyOrg(...names: Array<string | null | undefined>): boolean {
  for (const name of names) {
    if (!name) continue;
    for (const pattern of SECURITY_PROXY_PATTERNS) {
      if (pattern.test(name)) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/analytics/proxy-vendors.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/analytics/proxy-vendors.ts amplify/lib/analytics/proxy-vendors.test.ts
git commit -m "feat(analytics): shared security-proxy vendor matcher"
```

---

### Task 2: `/d` Lambda — tag proxy egress `corporate_proxy`, skip AI, never name-target

**Files:**
- Modify: `amplify/functions/server-track/handler.ts` (lookupIP ~line 194-217; `NEVER_TARGET_TYPES` at ~462 and ~757)
- Test: `amplify/functions/server-track/handler.writes.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('writePageView (via page_view_store branch)')` block in `amplify/functions/server-track/handler.writes.test.ts` (helpers `loadHandler`, `invoke`, `pvEvent`, `putItem`, `cmds`, `stubPageViewFetch` already exist in the file):

```typescript
    it('security-proxy egress (Menlo) → organizationType corporate_proxy, AI classify skipped', async () => {
        // CLASSIFY_ORG_FUNCTION_NAME set: proves the skip is the org-type gate,
        // not a missing function name.
        const handler = await loadHandler({ CLASSIFY_ORG_FUNCTION_NAME: 'classify-fn' });
        // ipinfo reports the vendor as a business — proxy match must win over companyType.
        stubPageViewFetch({ org: 'AS399629 Menlo Security, Inc.', companyType: 'business' });

        const res = await invoke(handler, pvEvent({ ip: '57.140.1.2' }));

        expect(res.statusCode).toBe(200);
        const item = putItem();
        expect(item.organizationType).toBe('corporate_proxy');
        expect(item.orgName).toBe('Menlo Security, Inc.'); // AS prefix stripped, name retained for display
        // corporate_proxy is not in AI_CLASSIFY_ORG_TYPES → classify-org never invoked
        expect(mockLambdaSend).not.toHaveBeenCalled();
        // and not a categorical target either → no enrichment Update
        expect(cmds('UpdateCommand')).toHaveLength(0);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/server-track/handler.writes.test.ts -t 'security-proxy'`
Expected: FAIL — `organizationType` is `'business'`, and `mockLambdaSend` WAS called

- [ ] **Step 3: Implement in `lookupIP` + `NEVER_TARGET_TYPES`**

In `amplify/functions/server-track/handler.ts`, add the import at the top of the file (next to the existing imports):

```typescript
import { isSecurityProxyOrg } from '../../lib/analytics/proxy-vendors';
```

In `lookupIP()` (~line 199), make the proxy check the highest-priority branch — vendor IPs often carry `company.type: 'business'`, which would otherwise route them to AI:

```typescript
    let organizationType = 'unknown';
    // Security-proxy / browser-isolation egress: the vendor's org name says
    // nothing about the visitor. Highest priority — ipinfo often types these
    // vendors as 'business', which would send the vendor name to AI
    // classification (the exact misattribution this prevents).
    if (isSecurityProxyOrg(merged.org as string, merged.isp as string, orgName)) {
        organizationType = 'corporate_proxy';
    }
    else if (companyType === 'education') organizationType = 'education';
    else if (companyType === 'business') organizationType = 'business';
    else if (companyType === 'government') organizationType = 'government';
    else if (companyType === 'isp') organizationType = 'isp';
    else if (companyType === 'hosting') organizationType = 'hosting';
    else if (!companyType) {
        if (EDUCATION_KEYWORDS.test(orgName)) organizationType = 'education';
        else if (GOVERNMENT_KEYWORDS.test(orgName)) organizationType = 'government';
    }
```

Then update BOTH `NEVER_TARGET_TYPES` declarations (page_time_flush ~line 462 and page_view ~line 757) — belt-and-braces so an AI result can never name-target a proxy vendor; behavior-based scoring is independent of this and unaffected:

```typescript
                const NEVER_TARGET_TYPES = ['telecom_isp', 'corporate_proxy'];
```

Note: `AI_CLASSIFY_ORG_TYPES` (line 229) and `CATEGORICAL_TARGET_TYPES` are deliberately NOT changed — `corporate_proxy` being absent from both is what skips AI and prevents name-based targeting.

- [ ] **Step 4: Run the file's tests**

Run: `npx vitest run amplify/functions/server-track/`
Expected: PASS (new test + all existing server-track tests)

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/server-track/handler.ts amplify/functions/server-track/handler.writes.test.ts
git commit -m "feat(server-track): tag security-proxy egress corporate_proxy, skip AI classification"
```

---

### Task 3: classify-org Lambda — deterministic short-circuit before AI

**Files:**
- Modify: `amplify/functions/classify-org/handler.ts` (ClassifyResult type ~line 27; classify flow ~lines 859-891)
- Test: `amplify/functions/classify-org/handler.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `amplify/functions/classify-org/handler.test.ts` (helpers `makeEvent`, `mockGet`, `mockPut`, `handler` already exist; `mockGet` resolves the DDB cache read). Note `makeEvent` adds the admin token, which the classify flow simply ignores:

```typescript
describe('classify-org security-proxy short-circuit', () => {
    it('returns deterministic corporate_proxy without AI and without caching', async () => {
        mockGet.mockResolvedValue({}); // cache miss
        const res = await handler(makeEvent({ orgName: 'Menlo Security, Inc.', city: 'Taipei', country: 'TW' }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.organizationType).toBe('corporate_proxy');
        expect(body.isTargetCustomer).toBe(false);
        expect(body.confidence).toBe(1.0);
        // Deterministic — never written to the AI cache
        expect(mockPut).not.toHaveBeenCalled();
    });

    it('beats a stale AI cache entry (pre-fix "enterprise" classification)', async () => {
        mockGet.mockResolvedValue({ Item: {
            orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
            isTargetCustomer: false, confidence: 0.95,
            reason: 'cybersecurity company, does not conduct R&D', source: 'ai',
        } });
        const res = await handler(makeEvent({ orgName: 'Menlo Security, Inc.' }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).organizationType).toBe('corporate_proxy');
    });

    it('manual override still wins over the short-circuit', async () => {
        mockGet.mockResolvedValue({ Item: {
            orgName: 'Zscaler, Inc.', organizationType: 'enterprise',
            isTargetCustomer: true, confidence: 1,
            reason: 'admin says so', source: 'manual',
        } });
        const res = await handler(makeEvent({ orgName: 'Zscaler, Inc.' }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.organizationType).toBe('enterprise');
        expect(body.source).toBe('manual');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run amplify/functions/classify-org/handler.test.ts -t 'short-circuit'`
Expected: FAIL — first test returns 500 or a non-proxy type (Bedrock mock returns garbage), second returns the cached `enterprise` entry

- [ ] **Step 3: Implement the short-circuit**

In `amplify/functions/classify-org/handler.ts`, add the import at the top:

```typescript
import { isSecurityProxyOrg } from '../../lib/analytics/proxy-vendors';
```

Widen the `ClassifyResult` union (line 27):

```typescript
    organizationType: 'university' | 'research_institute' | 'enterprise' | 'government' | 'hospital' | 'telecom_isp' | 'corporate_proxy' | 'unknown';
```

Replace the default classify flow (the block starting `// Default: classify flow` ~line 859 through the cached-return logic) with — precedence: manual override → proxy short-circuit → AI cache → AI:

```typescript
        // Default: classify flow
        // Check DynamoDB cache first
        const cached = await getCachedClassification(body.orgName);
        // Manual entries are ALWAYS returned, even with force=true
        if (cached && cached.source === 'manual') {
            return {
                statusCode: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(cached),
            };
        }

        // Security-proxy / browser-isolation vendors: deterministic result,
        // no AI call. The vendor's name says nothing about the visitor behind
        // the proxy. Checked BEFORE the AI cache so a stale pre-fix AI entry
        // ("enterprise") is superseded immediately instead of after TTL.
        // Manual overrides (above) still win.
        if (isSecurityProxyOrg(body.orgName)) {
            const proxyResult: ClassifyResult = {
                organizationType: 'corporate_proxy',
                isTargetCustomer: false,
                confidence: 1.0,
                reason: 'Security proxy / browser-isolation vendor egress — real visitor org unknown',
                cached: false,
                source: 'ai',
            };
            return {
                statusCode: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(proxyResult),
            };
        }

        // AI cached: return unless force=true
        if (cached && !body.force) {
            return {
                statusCode: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(cached),
            };
        }
```

(The subsequent `classifyOrganization` + `cacheClassification` calls are unchanged.)

- [ ] **Step 4: Run the file's tests**

Run: `npx vitest run amplify/functions/classify-org/handler.test.ts`
Expected: PASS (3 new + all existing)

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/classify-org/handler.ts amplify/functions/classify-org/handler.test.ts
git commit -m "feat(classify-org): deterministic corporate_proxy short-circuit before AI"
```

---

### Task 4: Admin aggregation — split proxy visitors, historical fallback, behavior scoring intact

**Files:**
- Modify: `src/pages/admin/analytics/orgAggregation.ts` (ISP_ORG_TYPES ~line 129; addIfISP ~line 131; record loop ~lines 303-365)
- Test: `src/pages/admin/analytics/orgAggregation.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `describe('aggregateByOrg')` block in `src/pages/admin/analytics/orgAggregation.test.ts` (the `ev()` helper exists at the top of the file):

```typescript
  it('splits security-proxy visitors by visitorId even when historical events carry an enterprise AI type', () => {
    // Historical shape: pre-fix events were AI-classified 'enterprise' with the
    // vendor's org name — no corporate_proxy type anywhere on the events.
    const records = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', org: 'AS399629 Menlo Security, Inc.',
           organizationType: 'enterprise', aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-tw', ip: '57.140.1.2', city: 'Taipei', pathname: '/products/icp-etcher' }),
      ev({ orgName: 'Menlo Security, Inc.', org: 'AS399629 Menlo Security, Inc.',
           organizationType: 'enterprise', aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-us', ip: '57.140.9.9', city: 'Needham', pathname: '/insights/ald' }),
    ]);
    expect(records).toHaveLength(2);
    for (const r of records) {
      expect(r.isISPVisitor).toBe(true);
      expect(r.organizationType).toBe('corporate_proxy'); // vendor's AI type suppressed
      expect(r.leadTier).toBeNull(); // no tier backfill from the vendor's 'enterprise' type
      expect(r.orgName).toMatch(/^Menlo Security, Inc\. · /); // per-visitor display name
    }
    // Stable override key (PR #341) applies: keyed by visitorId, not display name
    const keys = records.map(r => orgOverrideKey(r)).sort();
    expect(keys).toEqual(['vis-tw', 'vis-us']);
  });

  it('splits proxy visitors tagged corporate_proxy by the new pipeline', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Zscaler, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'z1', ip: '165.225.1.1', city: 'Frankfurt', pathname: '/a' }),
      ev({ orgName: 'Zscaler, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'z2', ip: '165.225.2.2', city: 'Tokyo', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(2);
    expect(records.every(r => r.isISPVisitor)).toBe(true);
  });

  it('lets behavior-based anonymous-high-intent fire for proxy visitors despite the enterprise AI event', () => {
    const [rec] = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'enterprise',
           aiOrganizationType: 'enterprise', aiConfidence: 0.95,
           visitorId: 'vis-tw', ip: '57.140.1.2', city: 'Taipei',
           pathname: '/products/icp-etcher', behaviorScore: 0.4, returnVisits: 1 }),
    ]);
    // Pre-fix: aiIdentifiedRealOrg (enterprise) blocked this flag entirely.
    expect(rec.isAnonymousHighIntent).toBe(true);
  });

  it('prefers the real org type when a proxy visitor also has events from their institution network', () => {
    const records = aggregateByOrg([
      ev({ orgName: 'Menlo Security, Inc.', organizationType: 'corporate_proxy',
           visitorId: 'v1', ip: '57.140.1.2', pathname: '/a' }),
      ev({ orgName: 'National Taiwan University', organizationType: 'education',
           visitorId: 'v1', ip: '140.112.1.1', pathname: '/b' }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].organizationType).toBe('education');
    expect(records[0].leadTier).toBe('B'); // IP-reliable education backfill still applies
  });
```

Also add this import change at the top of the test file if not present: `orgOverrideKey` is already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/admin/analytics/orgAggregation.test.ts -t 'proxy'`
Expected: FAIL — first test yields 1 record (no split), third yields `isAnonymousHighIntent: false`

- [ ] **Step 3: Implement in `orgAggregation.ts`**

Add the import at the top of `src/pages/admin/analytics/orgAggregation.ts`:

```typescript
import { isSecurityProxyOrg } from '../../../../amplify/lib/analytics/proxy-vendors';
```

**(a)** Extend `ISP_ORG_TYPES` and `addIfISP` (~lines 127-136) — the name match is the historical-data fallback (stored events carry `aiOrganizationType: 'enterprise'` and never re-classify):

```typescript
  // ── Collect ISP-like org names (AI telecom_isp + IP-level isp + proxies) ──
  // Used to split ISP/proxy visitors and prevent merge-back. corporate_proxy =
  // security-proxy / browser-isolation egress (Menlo, Zscaler, …): like an ISP,
  // the org name identifies the network, never the visitor.
  const ISP_ORG_TYPES = new Set(['telecom_isp', 'isp', 'corporate_proxy']);
  const ispOrgNames = new Set<string>();
  const addIfISP = (orgName: string, org: string, aiType: string | null | undefined, ipType: string | undefined) => {
    // Name fallback: historical events were AI-classified 'enterprise' under the
    // proxy vendor's name (pre-corporate_proxy pipeline) and never re-classify.
    if (ISP_ORG_TYPES.has(aiType || '') || ISP_ORG_TYPES.has(ipType || '') || isSecurityProxyOrg(orgName, org)) {
      if (orgName) ispOrgNames.add(orgName);
      if (org) ispOrgNames.add(org);
    }
  };
```

**(b)** In the per-group record loop, move the org-name selection (currently ~lines 353-361, the `nonIspEvent` / `orgEvent` / `ispOrgName` / `isISPVisitor` block) so it sits directly ABOVE the "Promote AI classification" block (~line 303), then derive the proxy flag and use it in `effectiveOrgType` and `aiIdentifiedRealOrg`. The resulting section reads:

```typescript
    // Detect ISP/proxy visitors that were split by the ISP split step.
    // Prefer non-ISP org name when the visitor has events from multiple networks.
    // (Computed before org-type promotion: the proxy flag below must suppress
    // the vendor-derived AI type.)
    const nonIspEvent = group.find((e) => {
      const name = e.orgName || e.org || '';
      return name && !ispOrgNames.has(name);
    });
    const orgEvent = nonIspEvent || group.find((e) => e.orgName || e.org) || group[0];
    const ispOrgName = orgEvent.orgName || orgEvent.org || '';
    const isISPVisitor = ispOrgNames.has(ispOrgName) && key !== ispOrgName;
    // The record resolves to a proxy vendor's name (no real-org event found):
    // its org type must say "corporate proxy", never the vendor's own AI
    // classification ("enterprise" — historically stored on pre-fix events).
    const isProxyOrg = isSecurityProxyOrg(ispOrgName);

    // Promote AI classification when IP-based org type is unknown
    const aiEvent = group.find((e) =>
      e.aiOrganizationType && e.aiOrganizationType !== 'unknown' && e.aiConfidence != null && e.aiConfidence >= 0.5
    );
    // Also check parent ISP AI type and visitorOrgMap (ISP-split groups may lack AI on their own events)
    const aiFromParentISP = !aiEvent ? (() => {
      const orgEvt = group.find(e => e.orgName || e.org);
      const orgName = orgEvt?.orgName || orgEvt?.org || '';
      if (orgName && ispAiType.has(orgName)) return ispAiType.get(orgName)!;
      // Also check visitorOrgMap
      for (const e of group) {
        const vid = (e as Record<string, unknown>).visitorId as string;
        if (!vid) continue;
        const meta = visitorOrgMap.get(vid);
        if (meta?.aiOrganizationType && meta.aiOrganizationType !== 'unknown'
            && meta.aiConfidence != null && meta.aiConfidence >= 0.5) {
          return { aiOrganizationType: meta.aiOrganizationType, aiConfidence: meta.aiConfidence };
        }
      }
      return null;
    })() : null;
    const ipOrgType = group.find(e => e.organizationType && e.organizationType !== 'unknown')?.organizationType ||
      geoEvent.organizationType || '';
    const effectiveOrgType = isProxyOrg
      ? 'corporate_proxy'
      : (aiEvent?.aiOrganizationType || aiFromParentISP?.aiOrganizationType || ipOrgType);
```

(Note the inner `orgEvent` in `aiFromParentISP` is renamed `orgEvt` to avoid shadowing the now-earlier `orgEvent`.)

**(c)** Update `aiIdentifiedRealOrg` (~line 345) — a proxy vendor AI-classified 'enterprise' is NOT a real identified org, and must not block behavior-based intent:

```typescript
    // Anonymous high-intent: unidentified org but strong behavioral signals
    // Exclude orgs identified by AI as a real organization (not ISP/proxy/unknown)
    const aiIdentifiedRealOrg = aiEvent && aiEvent.aiOrganizationType !== 'telecom_isp'
      && aiEvent.aiOrganizationType !== 'corporate_proxy' && !isProxyOrg;
```

**(d)** Delete the original `nonIspEvent`/`orgEvent`/`ispOrgName`/`isISPVisitor` block from its old position (~lines 353-361) — it moved up in (b). The `displayName` computation that followed it stays where it is and keeps using `isISPVisitor`/`ispOrgName`.

- [ ] **Step 4: Run the file's tests**

Run: `npx vitest run src/pages/admin/analytics/orgAggregation.test.ts`
Expected: PASS (4 new + all existing — the existing ISP-split, merge-back, consolidation, and override-key tests prove no regression)

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/analytics/orgAggregation.ts src/pages/admin/analytics/orgAggregation.test.ts
git commit -m "feat(admin-analytics): split security-proxy visitors like ISPs, historical name fallback"
```

---

### Task 5: behaviorAnalytics — proxy vendors are not "known organizations"

**Files:**
- Modify: `src/services/behaviorAnalytics.ts` (~lines 262-277)
- Test: `src/services/behaviorAnalytics.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/services/behaviorAnalytics.test.ts`, inside (or alongside) the existing `isKnownOrganization` coverage — check the file for the existing describe block and match its event-literal style:

```typescript
  it('does not count security-proxy vendors as known organizations', () => {
    // New pipeline: corporate_proxy org type
    expect(isKnownOrganization({ orgName: 'Zscaler, Inc.', organizationType: 'corporate_proxy' } as UtmEvent)).toBe(false);
    // Historical events: vendor name with pre-fix 'enterprise' type
    expect(isKnownOrganization({ orgName: 'Menlo Security, Inc.', organizationType: 'enterprise' } as UtmEvent)).toBe(false);
    // Real org still counts
    expect(isKnownOrganization({ orgName: 'MIT', organizationType: 'education' } as UtmEvent)).toBe(true);
  });
```

(If `isKnownOrganization`/`UtmEvent` are not yet imported in the test file, add them to the existing import from `./behaviorAnalytics`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts -t 'security-proxy'`
Expected: FAIL — the historical `enterprise`-typed Menlo event returns `true`

- [ ] **Step 3: Implement**

In `src/services/behaviorAnalytics.ts`, add the import at the top:

```typescript
import { isSecurityProxyOrg } from '../../amplify/lib/analytics/proxy-vendors';
```

Update the set and the predicate (~lines 262-277):

```typescript
// Org types NOT counted as a "known organization" (matches the admin's existing
// ISP handling in AdminAnalyticsPage.tsx).
const NON_KNOWN_ORG_TYPES = new Set(['telecom_isp', 'isp', 'corporate_proxy', 'unknown']);
```

```typescript
/** True when the event resolves to a real organization (not ISP/telecom/proxy/unknown). */
export function isKnownOrganization(e: UtmEvent): boolean {
  if (!normalizeUtmValue(e.orgName)) return false;
  // Security-proxy egress: historical events carry the vendor name with a
  // pre-fix AI type ('enterprise') — name match catches those.
  if (isSecurityProxyOrg(e.orgName)) return false;
  const type = (e.organizationType || 'unknown').toLowerCase();
  return !NON_KNOWN_ORG_TYPES.has(type);
}
```

- [ ] **Step 4: Run the file's tests**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/behaviorAnalytics.ts src/services/behaviorAnalytics.test.ts
git commit -m "feat(behavior-analytics): exclude security-proxy vendors from known-organization counts"
```

---

### Task 6: Full verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass (suite was 2469 passing before this work; now +~11)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run typecheck:amplify && npm run lint`
Expected: no errors

- [ ] **Step 3: Commit any straggler fixes, then final commit if needed**

```bash
git status --short
```

Expected: clean (all work already committed per-task)
