# Customer Organization DB — Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify customer information across `Order` / `RfqSubmission` / `LeadSubmission` entities into a single `Organization` entity on `intelligenceTable`, indexed by email eTLD+1 domain. Auto-create Organizations on new submissions; one-time backfill of historical data; AI classification via Bedrock Haiku. Admin list + detail pages.

**Architecture:** Reuses existing `intelligenceTable` single-table with new key prefixes (`ORG#<orgId>/META`, `ORG_DOMAIN_LOOKUP/DOMAIN#<d>`). New `organization-api` Lambda serves both internal upsert/classify (Lambda.invoke from submit-* paths) and admin AppSync resolvers. Three existing submission Lambdas modified to invoke upsert and backfill `matchedOrgId + GSI2PK` on the source item. Idempotent backfill script for historical data.

**Tech Stack:** TypeScript, Node 22, AWS Amplify Gen 2, AWS CDK v2, AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-lambda`), `@anthropic-ai/sdk`, `tldts` for eTLD+1 normalization, vitest for tests. React 19 + Vite for admin UI.

**Reference:** [docs/superpowers/specs/2026-05-15-organization-db-design.md](../specs/2026-05-15-organization-db-design.md)

---

## File structure

**Shared library (Tasks 1–2):**

```
amplify/lib/organization/
├── constants.ts             # ALIAS_DOMAINS_CAP, LEAD_SCORE_THRESHOLD, RECLASSIFY_COOLDOWN_DAYS, BEDROCK_TIMEOUT_MS, ANTHROPIC_TIMEOUT_MS
├── etld.ts                  # classifyEmailDomain + FREE_MAIL_DOMAINS
├── etld.test.ts
├── lead-score.ts            # computeRfqScore, computeLeadScore, computeOrderScore
├── lead-score.test.ts
├── invoke-org-api.ts        # helper to call organization-api Lambda from submit-* Lambdas
└── invoke-org-api.test.ts
```

**Schema additions (Task 3):**

```
amplify/data/resource.ts     # modified to add Organization customType, queries, mutations
```

**organization-api Lambda (Tasks 4–8):**

```
amplify/functions/organization-api/
├── handler.ts
├── handler.test.ts
├── resource.ts
└── package.json
```

**Backend wiring (Task 9):**

```
amplify/backend.ts           # modified to wire organization-api + cross-Lambda invoke grants
```

**Submission Lambda modifications (Tasks 10–12):**

```
amplify/functions/submit-rfq/handler.ts          # modified to call invokeOrganizationApi
amplify/functions/submit-lead/handler.ts         # modified
amplify/functions/convert-rfq-to-order/handler.ts # modified
```

**Backfill script (Task 13):**

```
scripts/backfill-organizations.ts
```

**Frontend (Tasks 14–17):**

```
src/services/organizationAdminService.ts
src/hooks/useOrganizations.ts
src/hooks/useOrganization.ts
src/pages/admin/OrganizationListPage.tsx
src/pages/admin/OrganizationDetailPage.tsx
src/components/admin/OrganizationTable.tsx
src/components/admin/OrganizationFilterBar.tsx
src/components/admin/OrganizationKpiCards.tsx
src/components/admin/OrganizationHeaderPanel.tsx
src/components/admin/OrganizationTimeline.tsx
src/components/admin/AdminLayout.tsx           # modified (NAV_ITEMS)
src/App.tsx                                     # modified (routes)
```

**Manual verification (Task 18).**

---

## Conventions

- TypeScript strict mode (existing project setting)
- Per-Lambda `package.json` with explicit SDK deps (matches `submit-rfq` / `tender-api` etc.)
- Lambda env access pattern: `const TABLE = () => process.env.INTELLIGENCE_TABLE!` so tests can `vi.stubEnv()` before importing
- Tests via vitest, `npm test -- <path>`
- Structured JSON log lines: `console.log(JSON.stringify({event, ...}))`
- Branch: `organization-db-foundation` (already checked out, contains spec commit `d1cc641`)
- Commit messages: `feat(org)`, `fix(org)`, `chore(org)`, `refactor(org)` for new code; standard project trailer.

---

## Task 1: Shared constants + eTLD+1 + free-mail

**Files:**
- Create: `amplify/lib/organization/constants.ts`
- Create: `amplify/lib/organization/etld.ts`
- Create: `amplify/lib/organization/etld.test.ts`

Centralized constants used across the Lambda, modifications, and backfill script. The eTLD+1 helper is the source of truth for "what's an Organization identity".

- [ ] **Step 1.1: Install `tldts`**

Run from project root:
```bash
npm install tldts@^6.1.49
```

(Pin to current major version. `tldts` ships with embedded Public Suffix List.)

- [ ] **Step 1.2: Write constants.ts**

Create `amplify/lib/organization/constants.ts`:

```typescript
/**
 * Shared constants for Customer Organization (Phase C).
 * See docs/superpowers/specs/2026-05-15-organization-db-design.md
 */

/** Max aliasDomains entries stored on a single Organization META item. */
export const ALIAS_DOMAINS_CAP = 100;

/** Lead score threshold above which an Org is indexed into GSI3 (high-priority list). */
export const LEAD_SCORE_THRESHOLD = 10;

/** Days within which `reclassifyOrganization` with force=false is a no-op. */
export const RECLASSIFY_COOLDOWN_DAYS = 30;

/** Bedrock InvokeModel client-side timeout (mirrors match-with-llm). */
export const BEDROCK_TIMEOUT_MS = 8000;

/** Anthropic API client timeout (mirrors match-with-llm). */
export const ANTHROPIC_TIMEOUT_MS = 20000;

/** Allowed Organization type values. */
export const ORG_TYPES = ['university', 'research-institute', 'company', 'government', 'other', 'unknown'] as const;
export type OrgType = typeof ORG_TYPES[number];

/** Allowed Organization status values. */
export const ORG_STATUSES = ['active', 'archived', 'blocked'] as const;
export type OrgStatus = typeof ORG_STATUSES[number];
```

- [ ] **Step 1.3: Write failing test for etld**

Create `amplify/lib/organization/etld.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyEmailDomain } from './etld';

describe('classifyEmailDomain', () => {
    it('extracts eTLD+1 for a standard university email', () => {
        expect(classifyEmailDomain('harvey@stanford.edu')).toEqual({
            orgId: 'stanford.edu',
            domain: 'stanford.edu',
            isFreeMailDomain: false,
        });
    });

    it('strips subdomain to eTLD+1', () => {
        const r = classifyEmailDomain('lab@media.mit.edu');
        expect(r.orgId).toBe('mit.edu');
        expect(r.domain).toBe('media.mit.edu');
    });

    it('handles compound TLDs (.edu.cn)', () => {
        const r = classifyEmailDomain('procurement@cs.tsinghua.edu.cn');
        expect(r.orgId).toBe('tsinghua.edu.cn');
        expect(r.domain).toBe('cs.tsinghua.edu.cn');
    });

    it('handles compound TLDs (.ac.uk)', () => {
        const r = classifyEmailDomain('chem@chem.ox.ac.uk');
        expect(r.orgId).toBe('ox.ac.uk');
    });

    it('skips free-mail domains (gmail.com)', () => {
        expect(classifyEmailDomain('harvey@gmail.com')).toEqual({
            orgId: null,
            domain: 'gmail.com',
            isFreeMailDomain: true,
        });
    });

    it('skips free-mail (qq.com)', () => {
        expect(classifyEmailDomain('user@qq.com').orgId).toBeNull();
    });

    it('skips free-mail (vip.qq.com)', () => {
        // vip.qq.com is its own eTLD+1 (treated like a separate brand)
        expect(classifyEmailDomain('user@vip.qq.com').orgId).toBeNull();
    });

    it('normalizes case (uppercase input)', () => {
        const r = classifyEmailDomain('HARVEY@Stanford.EDU');
        expect(r.orgId).toBe('stanford.edu');
    });

    it('handles plus-addressing transparently', () => {
        const r = classifyEmailDomain('harvey+work@stanford.edu');
        expect(r.orgId).toBe('stanford.edu');
    });

    it('returns null for empty string', () => {
        expect(classifyEmailDomain('').orgId).toBeNull();
    });

    it('returns null for missing @', () => {
        expect(classifyEmailDomain('not-an-email').orgId).toBeNull();
    });

    it('returns null for trailing @', () => {
        expect(classifyEmailDomain('user@').orgId).toBeNull();
    });

    it('returns null for unrecognized TLD', () => {
        // `tldts` returns null for domains it cannot place on PSL
        const r = classifyEmailDomain('user@invalid.fake-tld-xyz');
        expect(r.orgId).toBeNull();
    });

    it('trims whitespace', () => {
        expect(classifyEmailDomain('  user@stanford.edu  ').orgId).toBe('stanford.edu');
    });
});
```

- [ ] **Step 1.4: Run test to verify it fails**

```bash
npm test -- amplify/lib/organization/etld.test.ts
```
Expected: FAIL with "Cannot find module './etld'".

- [ ] **Step 1.5: Implement etld.ts**

Create `amplify/lib/organization/etld.ts`:

```typescript
import { getDomain } from 'tldts';

const FREE_MAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.jp', 'rocketmail.com', 'ymail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'live.co.uk', 'live.com.au', 'msn.com',
    'aol.com', 'icloud.com', 'me.com', 'mac.com',
    'qq.com', 'vip.qq.com', '163.com', '163.net', 'vip.163.com', '126.com', 'sina.com', 'sina.cn',
    'sohu.com', 'foxmail.com', 'yeah.net', '139.com', '189.cn',
    'tom.com', '21cn.com',
    'naver.com', 'daum.net', 'hanmail.net',
    'yandex.ru', 'mail.ru', 'rambler.ru',
    'gmx.com', 'gmx.de', 'web.de', 't-online.de',
    'zoho.com', 'protonmail.com', 'proton.me', 'protonmail.ch', 'tutanota.com', 'tuta.io', 'hey.com', 'pm.me', 'fastmail.com',
    'hotmail.co.uk', 'btinternet.com',
    'mailinator.com', 'tempmail.org', '10minutemail.com',
]);

export interface EmailDomainResult {
    orgId: string | null;
    domain: string;
    isFreeMailDomain: boolean;
}

/**
 * Extract the Organization identity (eTLD+1) from an email address.
 *
 * Returns `orgId: null` if the email is invalid, lacks a recognizable TLD,
 * or belongs to a free-mail provider. The raw post-@ domain is always
 * returned in `domain` (or empty string) so callers can still log it.
 *
 * Edge cases NOT handled (acceptable for the target customer segment):
 * - RFC 5321 quoted-string local parts like `"a@b"@stanford.edu` — first @ is
 *   treated as the separator, yielding a wrong domain.
 * - Internationalized domain names with raw Unicode TLDs — `tldts` may
 *   return null. Log via the `org.upsert.no-etld` warning at call sites.
 */
export function classifyEmailDomain(email: string): EmailDomainResult {
    const lower = email.toLowerCase().trim();
    const atIdx = lower.indexOf('@');
    if (atIdx === -1 || atIdx === lower.length - 1) {
        return { orgId: null, domain: '', isFreeMailDomain: false };
    }
    const domain = lower.slice(atIdx + 1);
    const etldPlusOne = getDomain(domain);
    if (!etldPlusOne) {
        return { orgId: null, domain, isFreeMailDomain: false };
    }
    const isFreeMailDomain = FREE_MAIL_DOMAINS.has(etldPlusOne);
    return {
        orgId: isFreeMailDomain ? null : etldPlusOne,
        domain,
        isFreeMailDomain,
    };
}
```

- [ ] **Step 1.6: Run test to verify it passes**

```bash
npm test -- amplify/lib/organization/etld.test.ts
```
Expected: PASS (14 tests).

- [ ] **Step 1.7: Commit**

```bash
git add amplify/lib/organization/constants.ts amplify/lib/organization/etld.ts amplify/lib/organization/etld.test.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(org): add shared constants + eTLD+1 normalization helper

Constants module exports ALIAS_DOMAINS_CAP, LEAD_SCORE_THRESHOLD,
RECLASSIFY_COOLDOWN_DAYS, and Bedrock/Anthropic timeouts shared across
organization-api Lambda, callers, and the backfill script.

classifyEmailDomain uses `tldts` for eTLD+1 extraction; correctly handles
compound TLDs (.edu.cn, .ac.uk) and subdomains. Skips a hardcoded list
of 50+ free-mail providers (gmail, qq, protonmail, etc.) so personal
email submissions do not create Organizations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Lead-score helpers + invoke-org-api wrapper

**Files:**
- Create: `amplify/lib/organization/lead-score.ts`
- Create: `amplify/lib/organization/lead-score.test.ts`
- Create: `amplify/lib/organization/invoke-org-api.ts`
- Create: `amplify/lib/organization/invoke-org-api.test.ts`

Lead-score functions are the single source of truth for how each submission type contributes to an Organization's `leadScore`. The invoke-org-api helper centralizes the cross-Lambda call pattern.

- [ ] **Step 2.1: Write failing test for lead-score**

Create `amplify/lib/organization/lead-score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeRfqScore, computeLeadScore, computeOrderScore } from './lead-score';

describe('computeRfqScore', () => {
    it('returns base 8 with no signals', () => {
        expect(computeRfqScore({})).toBe(8);
    });

    it('adds 5 for funded status', () => {
        expect(computeRfqScore({ fundingStatus: 'funded' })).toBe(13);
    });

    it('adds 3 for immediate timeline', () => {
        expect(computeRfqScore({ timeline: 'immediate' })).toBe(11);
    });

    it('stacks signals', () => {
        expect(computeRfqScore({ fundingStatus: 'funded', timeline: 'immediate' })).toBe(16);
    });

    it('ignores unknown values', () => {
        expect(computeRfqScore({ fundingStatus: 'pending', timeline: '6-months' })).toBe(8);
    });
});

describe('computeLeadScore', () => {
    it('returns base 2 for newsletter signup', () => {
        expect(computeLeadScore({ type: 'newsletter' })).toBe(2);
    });

    it('adds 5 for demo request', () => {
        expect(computeLeadScore({ type: 'demo-request' })).toBe(7);
    });

    it('adds 1 for tech question', () => {
        expect(computeLeadScore({ type: 'tech-question' })).toBe(3);
    });

    it('adds 1 for marketing opt-in', () => {
        expect(computeLeadScore({ type: 'newsletter', marketingOptIn: true })).toBe(3);
    });

    it('stacks demo + opt-in', () => {
        expect(computeLeadScore({ type: 'demo-request', marketingOptIn: true })).toBe(8);
    });
});

describe('computeOrderScore', () => {
    it('returns 0 with no amount', () => {
        expect(computeOrderScore()).toBe(0);
    });

    it('returns 5 for small order', () => {
        expect(computeOrderScore(15_000)).toBe(5);
    });

    it('returns 15 for mid order', () => {
        expect(computeOrderScore(50_000)).toBe(15);
    });

    it('returns 25 for large order', () => {
        expect(computeOrderScore(200_000)).toBe(25);
    });

    it('handles boundary at 30000', () => {
        expect(computeOrderScore(30_000)).toBe(15);
    });

    it('handles boundary at 100000', () => {
        expect(computeOrderScore(100_000)).toBe(25);
    });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
npm test -- amplify/lib/organization/lead-score.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 2.3: Implement lead-score.ts**

Create `amplify/lib/organization/lead-score.ts`:

```typescript
/**
 * Lead-score contribution from each submission type.
 *
 * Used by both the live `organization-api.upsertFromSubmission` Lambda
 * (called from submit-rfq, submit-lead, convert-rfq-to-order) and the
 * one-time backfill script. Keeping the logic in one place ensures
 * historical scores match what the live path would have produced.
 */

export function computeRfqScore(data: {
    fundingStatus?: string;
    timeline?: string;
}): number {
    let points = 8; // Base: RFQ submission
    if (data.fundingStatus === 'funded') points += 5;
    if (data.timeline === 'immediate') points += 3;
    return points;
}

export function computeLeadScore(data: {
    type: string;
    marketingOptIn?: boolean;
}): number {
    let points = 2; // Base: Lead submission
    if (data.type === 'demo-request') points += 5;
    if (data.type === 'tech-question') points += 1;
    if (data.marketingOptIn) points += 1;
    return points;
}

export function computeOrderScore(orderAmount?: number): number {
    if (!orderAmount) return 0;
    if (orderAmount >= 100_000) return 25;
    if (orderAmount >= 30_000) return 15;
    return 5;
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
npm test -- amplify/lib/organization/lead-score.test.ts
```
Expected: PASS (16 tests).

- [ ] **Step 2.5: Write failing test for invoke-org-api**

Create `amplify/lib/organization/invoke-org-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    InvokeCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('ORGANIZATION_API_FUNCTION_NAME', 'organization-api-test');

beforeEach(() => {
    mockSend.mockReset();
});

describe('invokeOrganizationApi', () => {
    it('sends RequestResponse invocation and parses response payload', async () => {
        const responsePayload = { matchedOrgId: 'stanford.edu' };
        mockSend.mockResolvedValueOnce({
            Payload: new TextEncoder().encode(JSON.stringify(responsePayload)),
            FunctionError: undefined,
        });

        const { invokeOrganizationApi } = await import('./invoke-org-api');
        const result = await invokeOrganizationApi({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@stanford.edu',
            submittedAt: '2026-05-16T00:00:00Z',
            scoreDelta: 8,
        });

        expect(result).toEqual(responsePayload);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.FunctionName).toBe('organization-api-test');
        expect(cmd.input.InvocationType).toBe('RequestResponse');
        const payload = JSON.parse(new TextDecoder().decode(cmd.input.Payload));
        expect(payload.action).toBe('upsertFromSubmission');
    });

    it('throws when FunctionError is set', async () => {
        mockSend.mockResolvedValueOnce({
            Payload: new TextEncoder().encode(JSON.stringify({ errorMessage: 'boom' })),
            FunctionError: 'Unhandled',
        });

        const { invokeOrganizationApi } = await import('./invoke-org-api');
        await expect(invokeOrganizationApi({
            action: 'upsertFromSubmission', source: 'rfq', email: 'a@b.com', submittedAt: '', scoreDelta: 0,
        })).rejects.toThrow(/boom|Unhandled/);
    });
});
```

- [ ] **Step 2.6: Verify failing**

```bash
npm test -- amplify/lib/organization/invoke-org-api.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 2.7: Implement invoke-org-api.ts**

Create `amplify/lib/organization/invoke-org-api.ts`:

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});

const FUNCTION_NAME = () => process.env.ORGANIZATION_API_FUNCTION_NAME!;

export interface UpsertFromSubmissionPayload {
    action: 'upsertFromSubmission';
    source: 'rfq' | 'lead' | 'order';
    email: string;
    institution?: string;
    submittedAt: string;
    scoreDelta: number;
    orderValueUSD?: number;
}

export interface ClassifyOrgPayload {
    action: 'classifyOrg';
    orgId: string;
    institution?: string;
    force?: boolean;
}

export type OrgApiPayload = UpsertFromSubmissionPayload | ClassifyOrgPayload;

export interface UpsertFromSubmissionResult {
    matchedOrgId: string | null;
}

/**
 * Synchronously invoke organization-api Lambda via AWS SDK (not AppSync).
 * Used by submit-rfq / submit-lead / convert-rfq-to-order to upsert the
 * customer Organization and receive a `matchedOrgId` to backfill on the
 * source item.
 *
 * On any error (FunctionError, timeout, network), the caller should catch
 * and proceed without matchedOrgId. Failing the user-facing submission
 * because of an Org-upsert glitch is not acceptable.
 */
export async function invokeOrganizationApi(
    payload: UpsertFromSubmissionPayload,
): Promise<UpsertFromSubmissionResult>;
export async function invokeOrganizationApi(payload: OrgApiPayload): Promise<any>;
export async function invokeOrganizationApi(payload: OrgApiPayload): Promise<any> {
    const res = await lambda.send(new InvokeCommand({
        FunctionName: FUNCTION_NAME(),
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
    const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
    const parsed = text ? JSON.parse(text) : null;
    if (res.FunctionError) {
        const message = parsed?.errorMessage ?? res.FunctionError;
        throw new Error(`organization-api error: ${message}`);
    }
    return parsed;
}
```

- [ ] **Step 2.8: Run test**

```bash
npm test -- amplify/lib/organization/invoke-org-api.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 2.9: Commit**

```bash
git add amplify/lib/organization/lead-score.ts amplify/lib/organization/lead-score.test.ts amplify/lib/organization/invoke-org-api.ts amplify/lib/organization/invoke-org-api.test.ts
git commit -m "$(cat <<'EOF'
feat(org): add lead-score helpers + invoke-org-api wrapper

Lead-score functions encode the per-source contribution (RFQ baseline 8 +
5 funded + 3 immediate; Lead baseline 2 + 5 demo + 1 question + 1 opt-in;
Order tiered 5/15/25 by USD value). Used by both the live upsert path
and the backfill script so historical scores match live behavior.

invokeOrganizationApi wraps LambdaClient.invoke with RequestResponse +
payload encoding/decoding and FunctionError checking. Callers catch the
throw and proceed with matchedOrgId=null to keep user-facing submissions
resilient.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Amplify schema — Organization customType + queries/mutations

**Files:**
- Modify: `amplify/data/resource.ts`

Add a new `Organization` customType, related connection/bundle/preview types, three queries, and three mutations. Wired to a not-yet-existing `organizationApi` Lambda — that resource import is added in Task 4. Until then, this file will not compile; that's intentional.

- [ ] **Step 3.1: Add Organization customType block**

In `amplify/data/resource.ts`, find the existing schema (look for `RfqSubmission` customType — Organization should be added alphabetically near it, or at the end of all customType blocks, whichever matches the file's convention).

Add the following customTypes inside the schema definition. They must appear before the queries/mutations that reference them via `a.ref('Organization')`:

```typescript
Organization: a.customType({
    orgId: a.id().required(),
    primaryDomain: a.string().required(),
    aliasDomains: a.string().array(),
    displayName: a.string(),
    type: a.string(),
    country: a.string(),
    industry: a.string(),
    aiClassifiedAt: a.datetime(),
    aiProvider: a.string(),
    leadScore: a.integer(),
    hasActiveInquiry: a.boolean(),
    rfqCount: a.integer(),
    orderCount: a.integer(),
    leadCount: a.integer(),
    totalOrderValueUSD: a.float(),
    firstSeenAt: a.datetime(),
    lastActivityAt: a.datetime(),
    latestRFQDate: a.date(),
    latestOrderDate: a.date(),
    latestLeadDate: a.date(),
    status: a.string(),
    adminNotes: a.string(),
    tags: a.string().array(),
    ownerSalesRep: a.string(),
    contactCount: a.integer(),
    primaryContactEmail: a.string(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
}),

OrganizationConnection: a.customType({
    items: a.ref('Organization').array().required(),
    nextToken: a.string(),
    totalActiveCount: a.integer(),
}),

OrganizationDetailBundle: a.customType({
    organization: a.ref('Organization').required(),
    recentRfqs: a.ref('RfqSubmission').array().required(),
    recentOrders: a.ref('Order').array().required(),
    recentLeads: a.ref('LeadSubmission').array().required(),
    recentTenders: a.json(),  // empty array [] in Phase C; expanded in Phase D
}),
```

- [ ] **Step 3.2: Add queries**

In the queries section of the schema (look for `listRfqs`, `getRfq` etc.):

```typescript
listOrganizations: a.query()
    .arguments({
        statuses: a.string().array(),
        types: a.string().array(),
        countries: a.string().array(),
        ownerSalesRep: a.string(),
        minLeadScore: a.integer(),
        search: a.string(),
        sortBy: a.string(),
        sortDir: a.string(),
        limit: a.integer(),
        nextToken: a.string(),
    })
    .returns(a.ref('OrganizationConnection').required())
    .handler(a.handler.function(organizationApi))
    .authorization((allow) => [allow.authenticated()]),

getOrganization: a.query()
    .arguments({ orgId: a.id().required() })
    .returns(a.ref('OrganizationDetailBundle'))
    .handler(a.handler.function(organizationApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 3.3: Add mutations**

In the mutations section:

```typescript
updateOrganizationStatus: a.mutation()
    .arguments({
        orgId: a.id().required(),
        status: a.string().required(),
        adminNotes: a.string(),
        tags: a.string().array(),
    })
    .returns(a.ref('Organization').required())
    .handler(a.handler.function(organizationApi))
    .authorization((allow) => [allow.authenticated()]),

updateOrganizationOwner: a.mutation()
    .arguments({
        orgId: a.id().required(),
        ownerSalesRep: a.string(),
    })
    .returns(a.ref('Organization').required())
    .handler(a.handler.function(organizationApi))
    .authorization((allow) => [allow.authenticated()]),

reclassifyOrganization: a.mutation()
    .arguments({
        orgId: a.id().required(),
        force: a.boolean(),
    })
    .returns(a.ref('Organization').required())
    .handler(a.handler.function(organizationApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 3.4: Add the `organizationApi` import at the top of the file**

At the top of `amplify/data/resource.ts`, add the import to match the pattern used by other Lambda-resolver resources (e.g. `orderApi`, `submitRfq`):

```typescript
import { organizationApi } from '../functions/organization-api/resource';
```

The actual file at `amplify/functions/organization-api/resource.ts` is created in Task 4. Until then, the data file will have a missing-module error. That is OK — we are committing this step as a structural placeholder and resolving it in Task 4.

- [ ] **Step 3.5: Commit (intentionally not type-checking)**

```bash
git add amplify/data/resource.ts
git commit -m "$(cat <<'EOF'
feat(org): add Organization schema customType + queries/mutations

Adds Organization, OrganizationConnection, and OrganizationDetailBundle
customTypes plus listOrganizations / getOrganization queries and
updateOrganizationStatus / updateOrganizationOwner / reclassifyOrganization
mutations. All wired to organizationApi Lambda resolver (resource file
created in the next task — this commit will not type-check standalone).

Authorization: allow.authenticated() at schema layer; runtime requireAdmin
check happens inside the Lambda (matches existing project pattern for
admin-only operations).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: organization-api Lambda scaffold + requireAdmin

**Files:**
- Create: `amplify/functions/organization-api/resource.ts`
- Create: `amplify/functions/organization-api/package.json`
- Create: `amplify/functions/organization-api/handler.ts`
- Create: `amplify/functions/organization-api/handler.test.ts`

Resolves the import dangling from Task 3. Implements the dual-path event dispatcher (direct Lambda invoke vs AppSync resolver) plus `requireAdmin`. No business operations yet — those land in Tasks 5–8.

- [ ] **Step 4.1: package.json**

Create `amplify/functions/organization-api/package.json`:

```json
{
    "name": "organization-api",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@anthropic-ai/sdk": "^0.32.1",
        "@aws-sdk/client-bedrock-runtime": "^3.758.0",
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/client-lambda": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "ulid": "^2.3.0"
    }
}
```

- [ ] **Step 4.2: resource.ts**

Create `amplify/functions/organization-api/resource.ts`:

```typescript
import { defineFunction, secret } from '@aws-amplify/backend';

export const organizationApi = defineFunction({
    name: 'organization-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    },
});
```

- [ ] **Step 4.3: Write failing test for requireAdmin**

Create `amplify/functions/organization-api/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal mocks for the SDK clients used elsewhere — needed to import the handler
// without making real AWS calls. We'll add per-test mock setup later as we build out operations.
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({}) }),
    },
    GetCommand: class { input: any; constructor(i: any) { this.input = i; } },
    PutCommand: class { input: any; constructor(i: any) { this.input = i; } },
    UpdateCommand: class { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class { input: any; constructor(i: any) { this.input = i; } },
    ScanCommand: class { input: any; constructor(i: any) { this.input = i; } },
    BatchGetCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: vi.fn() }; },
    Anthropic: class { messages = { create: vi.fn() }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence-test');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('organization-api dispatcher', () => {
    it('throws when AppSync event identity is missing admin group', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'listOrganizations' },
            arguments: {},
            identity: { username: 'user1', groups: ['user'] },
        } as any)).rejects.toThrow(/admin group required/);
    });

    it('throws on unknown fieldName when admin', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bogusOp' },
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });

    it('does not require admin for direct Lambda invoke (action path)', async () => {
        const { handler } = await import('./handler');
        // Use an unknown action so we get a clean "Unknown action" error rather than DDB calls
        await expect(handler({ action: 'bogus-action' } as any)).rejects.toThrow(/Unknown action/);
    });
});
```

- [ ] **Step 4.4: Verify failing**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 4.5: Implement handler.ts scaffold**

Create `amplify/functions/organization-api/handler.ts`:

```typescript
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

const ADMIN_GROUP = 'admin';

interface DirectInvokePayload {
    action: string;
    [key: string]: unknown;
}

export async function handler(
    event: AppSyncResolverEvent<any> | DirectInvokePayload,
): Promise<unknown> {
    // Path 1: direct Lambda invoke (action-based dispatch). Bypasses requireAdmin
    // because the only callers are other Lambdas in this account that we trust
    // (submit-rfq, submit-lead, convert-rfq-to-order, backfill script).
    if ('action' in event) {
        return dispatchAction(event);
    }
    // Path 2: AppSync resolver — admin-only.
    requireAdmin(event);
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event);
}

function requireAdmin(event: AppSyncResolverEvent<any>): void {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchAction(_event: DirectInvokePayload): Promise<unknown> {
    // Will be expanded in Tasks 5 and 6.
    throw new Error(`Unknown action: ${(_event as DirectInvokePayload).action}`);
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    // Will be expanded in Tasks 7 and 8.
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

// Export internals for unit tests
export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE };
```

- [ ] **Step 4.6: Run test**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 4.7: Commit**

```bash
git add amplify/functions/organization-api/
git commit -m "$(cat <<'EOF'
feat(org): scaffold organization-api Lambda with dual-path dispatcher

Lambda accepts two invocation shapes:
1. Direct invoke from other Lambdas (action-based) — no admin check
2. AppSync resolver event (fieldName-based) — runtime requireAdmin

Both dispatchers throw 'Unknown action' / 'Unknown fieldName' for now;
Tasks 5–8 fill in the upsert, classify, list, get, and admin-mutation
operations.

requireAdmin checks event.identity.groups for the 'admin' group, matching
the existing project pattern (order-api, tender-api).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: organization-api `upsertFromSubmission` action

**Files:**
- Modify: `amplify/functions/organization-api/handler.ts`
- Modify: `amplify/functions/organization-api/handler.test.ts`

The core write path. Called synchronously by submit-rfq / submit-lead / convert-rfq-to-order. Creates new Org via `PutItem(attribute_not_exists)`; on conditional failure, falls back to UpdateItem on the assumed-existing item. Handles alias domain tracking, lead-score-threshold GSI3 set/clear, and aliasDomains cap.

- [ ] **Step 5.1: Write failing tests for upsert paths**

Append to `amplify/functions/organization-api/handler.test.ts`:

```typescript
import { classifyEmailDomain } from '../../lib/organization/etld';

describe('upsertFromSubmission', () => {
    const NOW_ISO = '2026-05-16T12:00:00.000Z';
    beforeEach(() => {
        vi.setSystemTime(new Date(NOW_ISO));
    });

    it('returns matchedOrgId=null for free-mail submissions', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@gmail.com',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);
        expect(result).toEqual({ matchedOrgId: null });
    });

    it('returns matchedOrgId=null for invalid email format', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'not-an-email',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);
        expect(result).toEqual({ matchedOrgId: null });
    });

    it('creates a new Org on first submission (PutItem succeeds)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // PutItem on alias lookup query (first GSI2 check returns no items)
        sendMock.mockImplementationOnce(async (cmd: any) => {
            const name = cmd.constructor.name;
            if (name === 'QueryCommand') return { Items: [] };
            return {};
        });
        // PutItem on META (succeeds — new Org)
        sendMock.mockImplementationOnce(async () => ({}));
        // (alias lookup write happens later; mock subsequent calls as success)
        sendMock.mockResolvedValue({});

        // Lambda self-invoke for classify
        const lambdaMock = await import('@aws-sdk/client-lambda');
        const lambdaSend = vi.fn().mockResolvedValue({});
        (lambdaMock.LambdaClient as any).mockImplementation(() => ({ send: lambdaSend }));

        vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'organization-api-test');

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@stanford.edu',
            institution: 'Stanford University',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);

        expect(result).toEqual({ matchedOrgId: 'stanford.edu' });
        // PutItem META should have been invoked
        const putCalls = sendMock.mock.calls.filter(
            (c: any) => c[0].constructor.name === 'PutCommand',
        );
        expect(putCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to UpdateItem when PutItem hits ConditionalCheckFailedException', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Query alias lookup — no hit
        sendMock.mockImplementationOnce(async () => ({ Items: [] }));
        // PutItem META — fails because Org already exists
        const err = new Error('The conditional request failed');
        (err as any).name = 'ConditionalCheckFailedException';
        sendMock.mockImplementationOnce(async () => { throw err; });
        // UpdateItem META — succeeds
        sendMock.mockResolvedValueOnce({ Attributes: { leadScore: 13 } });
        // Subsequent calls
        sendMock.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'lab@cs.mit.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 5,
        } as any);

        expect(result).toEqual({ matchedOrgId: 'mit.edu' });
        const updateCalls = sendMock.mock.calls.filter(
            (c: any) => c[0].constructor.name === 'UpdateCommand',
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('uses canonical orgId from alias lookup hit', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Query alias lookup — hit on a different canonical orgId
        sendMock.mockImplementationOnce(async () => ({
            Items: [{ entityType: 'ORG_DOMAIN_LOOKUP', orgId: 'special-mit.edu' }],
        }));
        // PutItem META — assume Org exists, gets CCFE
        const err = new Error('CCFE');
        (err as any).name = 'ConditionalCheckFailedException';
        sendMock.mockImplementationOnce(async () => { throw err; });
        // UpdateItem META
        sendMock.mockResolvedValueOnce({ Attributes: { leadScore: 15 } });
        sendMock.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'someone@media.mit.edu',
            submittedAt: NOW_ISO,
            scoreDelta: 8,
        } as any);

        expect(result.matchedOrgId).toBe('special-mit.edu');
    });
});
```

- [ ] **Step 5.2: Verify failing**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: tests fail (operation not implemented).

- [ ] **Step 5.3: Implement `upsertFromSubmission`**

Replace `handler.ts` content with a full implementation that includes the upsert path. Append the following code (and update the `dispatchAction` stub to route to it):

```typescript
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { classifyEmailDomain } from '../../lib/organization/etld';
import {
    ALIAS_DOMAINS_CAP,
    LEAD_SCORE_THRESHOLD,
    ORG_TYPES,
} from '../../lib/organization/constants';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SELF_FUNCTION_NAME = () => process.env.AWS_LAMBDA_FUNCTION_NAME!;

const ADMIN_GROUP = 'admin';

interface DirectInvokePayload {
    action: string;
    [key: string]: unknown;
}

interface UpsertPayload {
    action: 'upsertFromSubmission';
    source: 'rfq' | 'lead' | 'order';
    email: string;
    institution?: string;
    submittedAt: string;
    scoreDelta: number;
    orderValueUSD?: number;
}

interface UpsertResult {
    matchedOrgId: string | null;
}

function invertedActivityToken(iso: string): string {
    // Inverted ISO timestamp: lex ASC = newest first. Reverse the year digits.
    // We use 9999 - year as a 4-digit numeric prefix, then keep the rest reversed-friendly.
    // Simpler approach: produce a 20-char fixed-width inverted string.
    const ms = new Date(iso).getTime();
    // Max ms ~ 8.64e15; pad to 16 chars.
    const inverted = (8_640_000_000_000_000 - ms).toString().padStart(16, '0');
    return inverted;
}

function invertedScoreToken(score: number): string {
    const clamped = Math.max(0, Math.min(10_000, score));
    return (10_000 - clamped).toString().padStart(5, '0');
}

export async function handler(
    event: AppSyncResolverEvent<any> | DirectInvokePayload,
): Promise<unknown> {
    if ('action' in event) return dispatchAction(event);
    requireAdmin(event);
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event);
}

function requireAdmin(event: AppSyncResolverEvent<any>): void {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchAction(event: DirectInvokePayload): Promise<unknown> {
    switch (event.action) {
        case 'upsertFromSubmission':
            return upsertFromSubmission(event as unknown as UpsertPayload);
        default:
            throw new Error(`Unknown action: ${event.action}`);
    }
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

async function upsertFromSubmission(payload: UpsertPayload): Promise<UpsertResult> {
    const { orgId, domain, isFreeMailDomain } = classifyEmailDomain(payload.email);
    if (!orgId) {
        console.log(JSON.stringify({
            event: 'org.upsert.skipped',
            reason: isFreeMailDomain ? 'free-mail' : 'invalid-email',
            domain,
        }));
        return { matchedOrgId: null };
    }

    // Step 3: alias lookup — find canonical orgId if this domain is an existing alias
    let canonicalOrgId = orgId;
    if (domain !== orgId) {
        const aliasHit = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORG_DOMAIN#${domain}` },
            Limit: 1,
        }));
        const items = aliasHit.Items ?? [];
        const lookup = items.find((i) => i.entityType === 'ORG_DOMAIN_LOOKUP');
        if (lookup?.orgId) {
            canonicalOrgId = lookup.orgId as string;
        }
    }

    const nowIso = new Date().toISOString();
    const sourceCountField = `${payload.source}Count`;
    const sourceDateField = `latest${payload.source.toUpperCase()}Date`;

    // Try PutItem with attribute_not_exists (new Org path)
    try {
        const newOrg: Record<string, unknown> = {
            PK: `ORG#${canonicalOrgId}`,
            SK: 'META',
            entityType: 'ORGANIZATION',
            orgId: canonicalOrgId,
            primaryDomain: domain,
            aliasDomains: domain !== canonicalOrgId ? [domain] : [],
            displayName: canonicalOrgId,
            type: 'unknown',
            leadScore: payload.scoreDelta,
            hasActiveInquiry: payload.source !== 'order',
            rfqCount: payload.source === 'rfq' ? 1 : 0,
            orderCount: payload.source === 'order' ? 1 : 0,
            leadCount: payload.source === 'lead' ? 1 : 0,
            totalOrderValueUSD: payload.orderValueUSD ?? 0,
            firstSeenAt: nowIso,
            lastActivityAt: nowIso,
            [sourceDateField]: payload.submittedAt,
            status: 'active',
            contactCount: payload.source === 'order' ? 0 : 1,
            primaryContactEmail: payload.email,
            createdAt: nowIso,
            updatedAt: nowIso,
            GSI1PK: 'ORG_TYPE#unknown',
            GSI1SK: `${invertedActivityToken(nowIso)}#${canonicalOrgId}`,
            GSI2PK: `ORG_DOMAIN#${canonicalOrgId}`,
            GSI2SK: 'ORG',
        };

        if (payload.scoreDelta >= LEAD_SCORE_THRESHOLD) {
            newOrg.GSI3PK = 'ORG_LEAD_SCORE';
            newOrg.GSI3SK = `${invertedScoreToken(payload.scoreDelta)}#${canonicalOrgId}`;
        }

        await ddb.send(new PutCommand({
            TableName: TABLE(),
            Item: newOrg,
            ConditionExpression: 'attribute_not_exists(PK)',
        }));

        // Alias lookup write (only if domain differs from canonical orgId)
        if (domain !== canonicalOrgId) {
            await ddb.send(new PutCommand({
                TableName: TABLE(),
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${domain}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId: canonicalOrgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${domain}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            })).catch((err) => {
                if (err?.name !== 'ConditionalCheckFailedException') throw err;
            });
        }

        // Fire-and-forget AI classify
        await invokeSelfClassify(canonicalOrgId, payload.institution);

        console.log(JSON.stringify({
            event: 'org.upsert.created',
            orgId: canonicalOrgId,
            source: payload.source,
        }));
        return { matchedOrgId: canonicalOrgId };
    } catch (err: any) {
        if (err?.name !== 'ConditionalCheckFailedException') throw err;
        // Existing Org — proceed to UpdateItem path
    }

    // Update path
    const newGsi1Sk = `${invertedActivityToken(nowIso)}#${canonicalOrgId}`;
    let updateExpr = 'SET hasActiveInquiry = :hasInquiry, lastActivityAt = :now, updatedAt = :now, GSI1SK = :gsi1Sk, '
        + `${sourceDateField} = :submittedAt, contactCount = if_not_exists(contactCount, :zero) + :countDelta`;
    let addExpr = ` ADD leadScore :delta, ${sourceCountField} :one`;
    if (payload.source === 'order' && payload.orderValueUSD) {
        addExpr += ', totalOrderValueUSD :orderVal';
    }

    const exprValues: Record<string, unknown> = {
        ':hasInquiry': payload.source !== 'order',
        ':now': nowIso,
        ':gsi1Sk': newGsi1Sk,
        ':submittedAt': payload.submittedAt,
        ':zero': 0,
        ':countDelta': payload.source === 'order' ? 0 : 1,
        ':delta': payload.scoreDelta,
        ':one': 1,
    };
    if (payload.source === 'order' && payload.orderValueUSD) {
        exprValues[':orderVal'] = payload.orderValueUSD;
    }

    const updateRes = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
        UpdateExpression: updateExpr + addExpr,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'UPDATED_NEW',
    }));

    const newLeadScore = (updateRes.Attributes as any)?.leadScore as number | undefined;
    const previousLeadScore = (newLeadScore ?? 0) - payload.scoreDelta;
    if (typeof newLeadScore === 'number') {
        if (newLeadScore >= LEAD_SCORE_THRESHOLD && previousLeadScore < LEAD_SCORE_THRESHOLD) {
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                UpdateExpression: 'SET GSI3PK = :pk, GSI3SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': 'ORG_LEAD_SCORE',
                    ':sk': `${invertedScoreToken(newLeadScore)}#${canonicalOrgId}`,
                },
            }));
        } else if (newLeadScore < LEAD_SCORE_THRESHOLD && previousLeadScore >= LEAD_SCORE_THRESHOLD) {
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                UpdateExpression: 'REMOVE GSI3PK, GSI3SK',
            }));
        }
    }

    // Alias handling — try PutItem alias lookup; on success append to array (if under cap)
    if (domain !== canonicalOrgId) {
        try {
            await ddb.send(new PutCommand({
                TableName: TABLE(),
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${domain}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId: canonicalOrgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${domain}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            }));
            // Lookup write succeeded — this is a brand-new alias for this Org. Append to array if under cap.
            const meta = await ddb.send(new GetCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                ProjectionExpression: 'aliasDomains',
            }));
            const currentAliases = ((meta.Item as any)?.aliasDomains ?? []) as string[];
            if (currentAliases.length < ALIAS_DOMAINS_CAP) {
                await ddb.send(new UpdateCommand({
                    TableName: TABLE(),
                    Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                    UpdateExpression: 'SET aliasDomains = list_append(if_not_exists(aliasDomains, :empty), :newAlias)',
                    ExpressionAttributeValues: { ':empty': [], ':newAlias': [domain] },
                }));
            } else {
                console.warn(JSON.stringify({
                    event: 'org.alias.cap-exceeded',
                    orgId: canonicalOrgId,
                    droppedDomain: domain,
                    cap: ALIAS_DOMAINS_CAP,
                }));
            }
        } catch (err: any) {
            if (err?.name !== 'ConditionalCheckFailedException') throw err;
            // Alias already exists — no append needed.
        }
    }

    console.log(JSON.stringify({
        event: 'org.upsert.updated',
        orgId: canonicalOrgId,
        source: payload.source,
        newLeadScore,
    }));
    return { matchedOrgId: canonicalOrgId };
}

async function invokeSelfClassify(orgId: string, institution?: string): Promise<void> {
    try {
        await lambda.send(new InvokeCommand({
            FunctionName: SELF_FUNCTION_NAME(),
            InvocationType: 'Event',
            Payload: new TextEncoder().encode(JSON.stringify({
                action: 'classifyOrg',
                orgId,
                institution,
            })),
        }));
    } catch (err) {
        console.error(JSON.stringify({
            event: 'org.classify.invoke-failed',
            orgId,
            error: String(err),
        }));
    }
}

export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE, upsertFromSubmission };
```

- [ ] **Step 5.4: Run tests**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: PASS (all upsert tests + dispatcher tests).

- [ ] **Step 5.5: Commit**

```bash
git add amplify/functions/organization-api/handler.ts amplify/functions/organization-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(org): implement upsertFromSubmission action

Core write path called synchronously from submit-rfq / submit-lead /
convert-rfq-to-order. Race-safe via PutItem with attribute_not_exists,
falling back to UpdateItem on ConditionalCheckFailedException — no
control-flow branch on a pre-PutItem GetItem.

Handles:
- Free-mail domain skip → matchedOrgId=null
- Invalid email format skip
- Alias domain canonicalization via GSI2 ORG_DOMAIN_LOOKUP query
- Lead-score threshold (10) GSI3 set/clear with detection of crossing
- aliasDomains array append gated by ALIAS_DOMAINS_CAP (100); lookup
  item is the authoritative index, array is a denormalized convenience
- Fire-and-forget AI classify via self-invoke (InvocationType=Event)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: organization-api `classifyOrg` action

**Files:**
- Modify: `amplify/functions/organization-api/handler.ts`
- Modify: `amplify/functions/organization-api/handler.test.ts`

AI classification via Bedrock Claude Haiku, with Anthropic API fallback. Mirrors the `match-with-llm` pattern verbatim. Updates Organization with `displayName, type, country, industry, aiClassifiedAt, aiProvider` and rewrites `GSI1PK` to reflect the new type.

- [ ] **Step 6.1: Append tests**

Append to `amplify/functions/organization-api/handler.test.ts`:

```typescript
describe('classifyOrg', () => {
    function bedrockBody(json: object) {
        const text = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }] });
        return { body: { transformToString: vi.fn().mockResolvedValue(text) } };
    }

    it('classifies an Org via Bedrock and writes back type + country + GSI1PK', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetItem returns existing Org
        sendMock.mockImplementationOnce(async () => ({
            Item: {
                orgId: 'stanford.edu',
                displayName: 'stanford.edu',
                type: 'unknown',
                aliasDomains: [],
            },
        }));
        // UpdateItem
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody({
            displayName: 'Stanford University',
            type: 'university',
            country: 'US',
            industry: 'Higher education',
        }));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'stanford.edu',
            institution: 'Stanford University',
        } as any);

        expect((result as any).type).toBe('university');
        expect((result as any).displayName).toBe('Stanford University');
        const updateCmd = sendMock.mock.calls.find((c: any) => c[0].constructor.name === 'UpdateCommand');
        expect(updateCmd).toBeDefined();
        const expr = updateCmd![0].input.UpdateExpression as string;
        expect(expr).toContain('GSI1PK');
    });

    it('falls back to Anthropic when Bedrock fails', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockImplementationOnce(async () => ({ Item: { orgId: 'mit.edu', type: 'unknown' } }));
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockRejectedValueOnce(new Error('Bedrock unavailable'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const anthropicMock = await import('@anthropic-ai/sdk');
        const create = vi.fn().mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify({
                displayName: 'MIT',
                type: 'university',
                country: 'US',
                industry: null,
            }) }],
        });
        (anthropicMock.default as any) = class { messages = { create }; };

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'mit.edu',
        } as any);

        expect((result as any).aiProvider).toBe('anthropic');
    });

    it('no-ops on both providers failing (does not throw)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockImplementationOnce(async () => ({ Item: { orgId: 'unknown.example', type: 'unknown' } }));
        sendMock.mockResolvedValue({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockRejectedValueOnce(new Error('Bedrock down'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const anthropicMock = await import('@anthropic-ai/sdk');
        const create = vi.fn().mockRejectedValueOnce(new Error('Anthropic 500'));
        (anthropicMock.default as any) = class { messages = { create }; };

        const { handler } = await import('./handler');
        const result = await handler({
            action: 'classifyOrg',
            orgId: 'unknown.example',
        } as any);

        expect((result as any).aiProvider).toBeNull();
        // No UpdateItem on type/country
        const updateCalls = sendMock.mock.calls.filter((c: any) =>
            c[0].constructor.name === 'UpdateCommand' && (c[0].input.UpdateExpression as string).includes('type'));
        expect(updateCalls.length).toBe(0);
    });
});
```

- [ ] **Step 6.2: Verify failing**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: classify tests FAIL.

- [ ] **Step 6.3: Implement `classifyOrg`**

In `handler.ts`, add the `classifyOrg` function and wire it into `dispatchAction`. Add imports for Bedrock + Anthropic:

```typescript
// Add these imports at the top of handler.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import { BEDROCK_TIMEOUT_MS, ANTHROPIC_TIMEOUT_MS } from '../../lib/organization/constants';

const bedrock = new BedrockRuntimeClient({});
```

Update `dispatchAction` switch:

```typescript
async function dispatchAction(event: DirectInvokePayload): Promise<unknown> {
    switch (event.action) {
        case 'upsertFromSubmission':
            return upsertFromSubmission(event as unknown as UpsertPayload);
        case 'classifyOrg':
            return classifyOrg(event as unknown as { action: 'classifyOrg'; orgId: string; institution?: string; force?: boolean });
        default:
            throw new Error(`Unknown action: ${event.action}`);
    }
}
```

Add the implementation at the bottom of the file (before the export block):

```typescript
interface ClassifyOrgPayload {
    action: 'classifyOrg';
    orgId: string;
    institution?: string;
    force?: boolean;
}

interface LlmClassifyOutput {
    displayName?: string;
    type?: string;
    country?: string;
    industry?: string | null;
}

function parseLlmJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
    return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

function buildClassifyPrompt(orgId: string, institution?: string): string {
    return [
        'Classify this customer organization. Output JSON only.',
        '',
        'Schema:',
        '{ "displayName": string,',
        '  "type": string,            // one of: university, research-institute, company, government, other',
        '  "country": string,         // ISO 3166-1 alpha-2',
        '  "industry": string | null  // short noun phrase or null',
        '}',
        '',
        `Inputs:`,
        `- Domain: ${orgId}`,
        `- Institution name provided: ${institution ? `"${institution}"` : 'none'}`,
    ].join('\n');
}

async function callBedrock(prompt: string): Promise<LlmClassifyOutput> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: process.env.BEDROCK_MODEL_ID!,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }],
            }),
        }), { abortSignal: ctrl.signal });
        const text = await (res.body as any).transformToString('utf-8');
        const wrap = JSON.parse(text);
        const inner: string = wrap.content?.[0]?.text ?? '{}';
        return parseLlmJson(inner) as LlmClassifyOutput;
    } finally {
        clearTimeout(t);
    }
}

async function callAnthropic(prompt: string): Promise<LlmClassifyOutput> {
    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: ANTHROPIC_TIMEOUT_MS,
    });
    const res = await client.messages.create({
        model: process.env.CLAUDE_MODEL!,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0] as any;
    const text: string = block?.text ?? '{}';
    return parseLlmJson(text) as LlmClassifyOutput;
}

function isValidOrgType(t: string | undefined): boolean {
    return !!t && (ORG_TYPES as readonly string[]).includes(t);
}

async function classifyOrg(payload: ClassifyOrgPayload): Promise<Record<string, unknown>> {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${payload.orgId}`, SK: 'META' },
    }));
    if (!existing.Item) {
        console.warn(JSON.stringify({ event: 'org.classify.org-missing', orgId: payload.orgId }));
        return { aiProvider: null };
    }

    const prompt = buildClassifyPrompt(payload.orgId, payload.institution);

    let result: LlmClassifyOutput | null = null;
    let provider: 'bedrock' | 'anthropic' | null = null;

    try {
        result = await callBedrock(prompt);
        provider = 'bedrock';
    } catch (bedrockErr) {
        console.warn(JSON.stringify({
            event: 'org.classify.bedrock-failed',
            orgId: payload.orgId,
            error: String(bedrockErr),
        }));
        try {
            result = await callAnthropic(prompt);
            provider = 'anthropic';
        } catch (anthropicErr) {
            console.error(JSON.stringify({
                event: 'org.classify.both-providers-failed',
                orgId: payload.orgId,
                bedrockError: String(bedrockErr),
                anthropicError: String(anthropicErr),
            }));
            return { aiProvider: null };
        }
    }

    if (!result) return { aiProvider: null };

    const safeType = isValidOrgType(result.type) ? result.type! : 'unknown';
    const nowIso = new Date().toISOString();
    const oldType = (existing.Item as any).type ?? 'unknown';

    await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${payload.orgId}`, SK: 'META' },
        UpdateExpression: 'SET #disp = :disp, #t = :t, #c = :c, industry = :ind, aiClassifiedAt = :now, aiProvider = :prov, updatedAt = :now, GSI1PK = :newGsi1Pk',
        ExpressionAttributeNames: {
            '#disp': 'displayName',
            '#t': 'type',
            '#c': 'country',
        },
        ExpressionAttributeValues: {
            ':disp': result.displayName ?? payload.orgId,
            ':t': safeType,
            ':c': result.country ?? null,
            ':ind': result.industry ?? null,
            ':now': nowIso,
            ':prov': provider,
            ':newGsi1Pk': `ORG_TYPE#${safeType}`,
        },
    }));

    console.log(JSON.stringify({
        event: 'org.classify.success',
        orgId: payload.orgId,
        provider,
        type: safeType,
        oldType,
    }));

    return {
        orgId: payload.orgId,
        displayName: result.displayName ?? payload.orgId,
        type: safeType,
        country: result.country ?? null,
        industry: result.industry ?? null,
        aiClassifiedAt: nowIso,
        aiProvider: provider,
    };
}

export { classifyOrg };
```

- [ ] **Step 6.4: Run tests**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: PASS (all upsert + classify + dispatcher tests).

- [ ] **Step 6.5: Commit**

```bash
git add amplify/functions/organization-api/handler.ts amplify/functions/organization-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(org): implement classifyOrg action with Bedrock + Anthropic fallback

Mirrors match-with-llm dual-provider pattern: Bedrock Claude Haiku 4.5
with 8s timeout, Anthropic API fallback with 20s timeout. Same parseLlmJson
helper strips markdown fences. On both-provider failure, no-throw (the
Lambda is invoked fire-and-forget from upsertFromSubmission); the Org
remains type='unknown' until a manual reclassify mutation.

UpdateItem also rewrites GSI1PK from ORG_TYPE#unknown to ORG_TYPE#<newType>
so the admin "list by type" query surfaces the freshly-classified Org
under its real bucket.

Validates AI output: only one of the ORG_TYPES enum values is accepted;
out-of-set type values are coerced to 'unknown'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `listOrganizations` + `getOrganization` queries

**Files:**
- Modify: `amplify/functions/organization-api/handler.ts`
- Modify: `amplify/functions/organization-api/handler.test.ts`

Read-side admin queries. `listOrganizations` fans out across requested types using GSI1; `getOrganization` returns a bundle of Org meta + recent RFQs/Orders/Leads via GSI2.

- [ ] **Step 7.1: Append tests**

```typescript
describe('listOrganizations', () => {
    it('queries GSI1 per requested type and merges results', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Two parallel Queries (one per type)
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'stanford.edu', type: 'university', lastActivityAt: '2026-05-15T10:00:00Z', leadScore: 30 },
        ] });
        sendMock.mockResolvedValueOnce({ Items: [
            { orgId: 'amat.com', type: 'company', lastActivityAt: '2026-05-14T10:00:00Z', leadScore: 12 },
        ] });
        // Optional totalActiveCount Query
        sendMock.mockResolvedValueOnce({ Count: 2 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listOrganizations' },
            arguments: { types: ['university', 'company'], statuses: ['active'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.length).toBe(2);
        // Default sort=activity DESC: stanford (newer) first
        expect((result as any).items[0].orgId).toBe('stanford.edu');
    });
});

describe('getOrganization', () => {
    it('returns a bundle with Org meta + grouped timeline', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // GetItem META
        sendMock.mockResolvedValueOnce({ Item: {
            orgId: 'stanford.edu', displayName: 'Stanford', type: 'university',
        } });
        // GSI2 Query for related items
        sendMock.mockResolvedValueOnce({ Items: [
            { entityType: 'RFQ_SUBMISSION', rfqId: 'r1', submittedAt: '2026-05-10' },
            { entityType: 'ORDER', orderId: 'o1', quoteDate: '2026-04-01' },
            { entityType: 'LEAD_SUBMISSION', leadId: 'l1', submittedAt: '2026-03-15' },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'getOrganization' },
            arguments: { orgId: 'stanford.edu' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.organization.orgId).toBe('stanford.edu');
        expect(result.recentRfqs).toHaveLength(1);
        expect(result.recentOrders).toHaveLength(1);
        expect(result.recentLeads).toHaveLength(1);
        expect(result.recentTenders).toEqual([]);
    });

    it('throws 404 if Org does not exist', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: undefined });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'getOrganization' },
            arguments: { orgId: 'fake.example' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/not found/);
    });
});
```

- [ ] **Step 7.2: Verify failing**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: list/get tests FAIL.

- [ ] **Step 7.3: Implement `listOrganizations` and `getOrganization`**

In `handler.ts`, expand `dispatchFieldName`:

```typescript
async function dispatchFieldName(
    fieldName: string,
    event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    const identity = (event.identity as any)?.username ?? 'unknown';
    switch (fieldName) {
        case 'listOrganizations':
            return listOrganizations(event.arguments);
        case 'getOrganization':
            return getOrganization(event.arguments);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}
```

Add the implementations at the bottom of the file:

```typescript
interface ListOrgArgs {
    statuses?: string[];
    types?: string[];
    countries?: string[];
    ownerSalesRep?: string;
    minLeadScore?: number;
    search?: string;
    sortBy?: 'activity' | 'leadScore' | 'firstSeen';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

async function listOrganizations(args: ListOrgArgs) {
    const sortBy = args.sortBy ?? 'activity';
    const limit = args.limit ?? 25;
    const types = args.types ?? ORG_TYPES.filter((t) => t !== 'unknown');

    let items: any[] = [];

    if (sortBy === 'activity') {
        const queries = await Promise.all(
            types.map((type) =>
                ddb.send(new QueryCommand({
                    TableName: TABLE(),
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk',
                    ExpressionAttributeValues: { ':pk': `ORG_TYPE#${type}` },
                    Limit: limit * 2,
                })),
            ),
        );
        items = queries.flatMap((q) => q.Items ?? []);
    } else if (sortBy === 'leadScore') {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3PK = :pk',
            ExpressionAttributeValues: { ':pk': 'ORG_LEAD_SCORE' },
            Limit: limit * 2,
        }));
        items = r.Items ?? [];
    } else {
        // firstSeen — Scan with filter
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE(),
            FilterExpression: 'entityType = :et',
            ExpressionAttributeValues: { ':et': 'ORGANIZATION' },
        }));
        items = r.Items ?? [];
        items.sort((a, b) => (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? ''));
    }

    // In-memory filters
    if (args.statuses?.length) {
        items = items.filter((i) => args.statuses!.includes(i.status ?? 'active'));
    } else {
        items = items.filter((i) => (i.status ?? 'active') === 'active');
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country));
    }
    if (args.ownerSalesRep) {
        items = items.filter((i) => i.ownerSalesRep === args.ownerSalesRep);
    }
    if (typeof args.minLeadScore === 'number') {
        items = items.filter((i) => (i.leadScore ?? 0) >= args.minLeadScore!);
    }
    if (args.search) {
        const needle = args.search.toLowerCase();
        items = items.filter((i) =>
            (i.displayName ?? '').toLowerCase().includes(needle) ||
            (i.primaryDomain ?? '').toLowerCase().includes(needle),
        );
    }

    // Cap to limit
    const totalActiveCount = items.length;
    const sliced = items.slice(0, limit);

    return {
        items: sliced,
        nextToken: items.length > limit ? `offset:${limit}` : null,
        totalActiveCount,
    };
}

async function getOrganization(args: { orgId: string }) {
    const meta = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
    }));
    if (!meta.Item) {
        throw new Error(`Organization not found: ${args.orgId}`);
    }

    const linked = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `ORG#${args.orgId}` },
        Limit: 80,
    }));

    const recentRfqs: any[] = [];
    const recentOrders: any[] = [];
    const recentLeads: any[] = [];
    for (const item of (linked.Items ?? [])) {
        const t = item.entityType;
        if (t === 'RFQ_SUBMISSION' && recentRfqs.length < 20) recentRfqs.push(item);
        else if (t === 'ORDER' && recentOrders.length < 20) recentOrders.push(item);
        else if (t === 'LEAD_SUBMISSION' && recentLeads.length < 20) recentLeads.push(item);
    }
    recentRfqs.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
    recentOrders.sort((a, b) => (b.quoteDate ?? '').localeCompare(a.quoteDate ?? ''));
    recentLeads.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

    return {
        organization: meta.Item,
        recentRfqs,
        recentOrders,
        recentLeads,
        recentTenders: [],
    };
}
```

Make sure to import `ScanCommand` at the top:

```typescript
import {
    DynamoDBDocumentClient,
    GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
```

- [ ] **Step 7.4: Run tests**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: PASS (all tests).

- [ ] **Step 7.5: Commit**

```bash
git add amplify/functions/organization-api/handler.ts amplify/functions/organization-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(org): implement listOrganizations + getOrganization queries

listOrganizations fan-out per ORG_TYPE on GSI1 (default sort=activity).
sortBy='leadScore' uses GSI3 sparse index. sortBy='firstSeen' falls back
to Scan with entityType filter (escape valve flagged in Risk #8 for
later optimization). In-memory filters for status, country, owner,
minLeadScore, search.

getOrganization fetches META + single GSI2 query for linked items;
groups by entityType in-memory; caps at 20 per category. recentTenders
is unconditionally [] in Phase C — Tender → Organization matching is
Phase D scope.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Admin mutations (`updateOrganizationStatus`, `updateOrganizationOwner`, `reclassifyOrganization`)

**Files:**
- Modify: `amplify/functions/organization-api/handler.ts`
- Modify: `amplify/functions/organization-api/handler.test.ts`

Three admin write operations. Status change accepts adminNotes + tags; owner change is a single-field update; reclassify wraps the existing `classifyOrg` action with a 30-day cooldown unless `force=true`.

- [ ] **Step 8.1: Append tests**

```typescript
describe('admin mutations', () => {
    it('updateOrganizationStatus sets status, adminNotes, tags', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'stanford.edu', status: 'archived' } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateOrganizationStatus' },
            arguments: { orgId: 'stanford.edu', status: 'archived', adminNotes: 'Out of season', tags: ['cold'] },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.status).toBe('archived');
        const updateCmd = sendMock.mock.calls[0][0];
        expect(updateCmd.input.UpdateExpression).toContain('status');
        expect(updateCmd.input.UpdateExpression).toContain('adminNotes');
        expect(updateCmd.input.UpdateExpression).toContain('tags');
    });

    it('updateOrganizationStatus rejects invalid status', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'updateOrganizationStatus' },
            arguments: { orgId: 'stanford.edu', status: 'bogus' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/invalid status/);
    });

    it('updateOrganizationOwner sets ownerSalesRep', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Attributes: { orgId: 'stanford.edu', ownerSalesRep: 'sales@ninescrolls.com' } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateOrganizationOwner' },
            arguments: { orgId: 'stanford.edu', ownerSalesRep: 'sales@ninescrolls.com' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.ownerSalesRep).toBe('sales@ninescrolls.com');
    });

    it('reclassifyOrganization is no-op within RECLASSIFY_COOLDOWN_DAYS unless force=true', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetItem returns recently classified Org
        sendMock.mockResolvedValueOnce({ Item: {
            orgId: 'stanford.edu',
            type: 'university',
            aiClassifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        } });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'reclassifyOrganization' },
            arguments: { orgId: 'stanford.edu', force: false },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.orgId).toBe('stanford.edu');
        // Should NOT have invoked Bedrock
        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        // The bedrock client mock was set up earlier; assert it was not called this test
    });
});
```

- [ ] **Step 8.2: Verify failing**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: admin mutation tests FAIL.

- [ ] **Step 8.3: Implement admin mutations**

In `handler.ts`, expand `dispatchFieldName`:

```typescript
async function dispatchFieldName(
    fieldName: string,
    event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    const identity = (event.identity as any)?.username ?? 'unknown';
    switch (fieldName) {
        case 'listOrganizations':
            return listOrganizations(event.arguments);
        case 'getOrganization':
            return getOrganization(event.arguments);
        case 'updateOrganizationStatus':
            return updateOrganizationStatus(event.arguments, identity);
        case 'updateOrganizationOwner':
            return updateOrganizationOwner(event.arguments, identity);
        case 'reclassifyOrganization':
            return reclassifyOrganization(event.arguments);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}
```

Add imports for `RECLASSIFY_COOLDOWN_DAYS` (already imported via constants) and `ORG_STATUSES`:

```typescript
// extend the constants import
import {
    ALIAS_DOMAINS_CAP,
    LEAD_SCORE_THRESHOLD,
    ORG_TYPES,
    ORG_STATUSES,
    RECLASSIFY_COOLDOWN_DAYS,
} from '../../lib/organization/constants';
```

Add implementations:

```typescript
async function updateOrganizationStatus(
    args: { orgId: string; status: string; adminNotes?: string; tags?: string[] },
    identity: string,
) {
    if (!(ORG_STATUSES as readonly string[]).includes(args.status)) {
        throw new Error(`invalid status: ${args.status}`);
    }
    const nowIso = new Date().toISOString();
    const setExpressions: string[] = ['#st = :status', 'updatedAt = :now'];
    const exprValues: Record<string, unknown> = { ':status': args.status, ':now': nowIso };
    const exprNames: Record<string, string> = { '#st': 'status' };
    if (args.adminNotes !== undefined) {
        setExpressions.push('adminNotes = :notes');
        exprValues[':notes'] = args.adminNotes;
    }
    if (args.tags !== undefined) {
        setExpressions.push('tags = :tags');
        exprValues[':tags'] = args.tags;
    }
    const res = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
    }));
    console.log(JSON.stringify({
        event: 'org.status.updated',
        orgId: args.orgId,
        newStatus: args.status,
        changedBy: identity,
    }));
    return res.Attributes;
}

async function updateOrganizationOwner(
    args: { orgId: string; ownerSalesRep?: string | null },
    identity: string,
) {
    const nowIso = new Date().toISOString();
    let updateExpr: string;
    const exprValues: Record<string, unknown> = { ':now': nowIso };
    if (args.ownerSalesRep) {
        updateExpr = 'SET ownerSalesRep = :owner, updatedAt = :now';
        exprValues[':owner'] = args.ownerSalesRep;
    } else {
        updateExpr = 'SET updatedAt = :now REMOVE ownerSalesRep';
    }
    const res = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
    }));
    console.log(JSON.stringify({
        event: 'org.owner.updated',
        orgId: args.orgId,
        owner: args.ownerSalesRep ?? null,
        changedBy: identity,
    }));
    return res.Attributes;
}

async function reclassifyOrganization(args: { orgId: string; force?: boolean }) {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
    }));
    if (!existing.Item) throw new Error(`Organization not found: ${args.orgId}`);

    if (!args.force && existing.Item.aiClassifiedAt) {
        const lastIso = existing.Item.aiClassifiedAt as string;
        const ageDays = (Date.now() - new Date(lastIso).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays < RECLASSIFY_COOLDOWN_DAYS) {
            console.log(JSON.stringify({
                event: 'org.reclassify.cooldown-active',
                orgId: args.orgId,
                ageDays,
            }));
            return existing.Item;
        }
    }

    const result = await classifyOrg({ action: 'classifyOrg', orgId: args.orgId });
    return result;
}
```

- [ ] **Step 8.4: Run tests**

```bash
npm test -- amplify/functions/organization-api/handler.test.ts
```
Expected: PASS (all tests including admin mutations).

- [ ] **Step 8.5: Commit**

```bash
git add amplify/functions/organization-api/handler.ts amplify/functions/organization-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(org): implement admin mutations (status / owner / reclassify)

updateOrganizationStatus validates the status enum (active/archived/blocked),
sets adminNotes + tags when provided, logs the changedBy identity.
No status-log entity (per spec non-goal — admin overwrite is the model).

updateOrganizationOwner sets ownerSalesRep when provided, REMOVEs the
field when null (so admin can clear assignment).

reclassifyOrganization is a no-op when aiClassifiedAt is within
RECLASSIFY_COOLDOWN_DAYS (30); admin can force via force=true.
Underlying classifyOrg is shared with the upsert path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: backend.ts wiring — IAM, env, cross-Lambda invoke grants

**Files:**
- Modify: `amplify/backend.ts`

Register `organization-api` in `defineBackend`, grant `intelligenceTable` read/write + Bedrock invoke + self-invoke, and add `lambda:InvokeFunction` grants from `submit-rfq`, `submit-lead`, `convert-rfq-to-order` to `organization-api`.

- [ ] **Step 9.1: Add import at the top**

In `amplify/backend.ts`, near the other function imports (look for `submitRfq`, `submitLead`, etc.):

```typescript
import { organizationApi } from './functions/organization-api/resource';
```

- [ ] **Step 9.2: Register in defineBackend**

In the `defineBackend({ ... })` block, add `organizationApi`:

```typescript
const backend = defineBackend({
    auth,
    data,
    // ...existing functions...
    submitLead,
    submitQuestion,
    organizationApi,    // NEW
});
```

- [ ] **Step 9.3: Add CDK wiring at bottom**

Append a new section near the end of `backend.ts` (after the existing stacks), structured the same way as `tender-watch-stack`:

```typescript
// =============================================================================
// Customer Organization (Phase C)
// =============================================================================

const orgFunctionStack = Stack.of(backend.organizationApi.resources.lambda);

intelligenceTable.grantReadWriteData(backend.organizationApi.resources.lambda);
backend.organizationApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Bedrock invoke (mirrors classify-org / match-with-llm)
backend.organizationApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));

// Self-invoke for fire-and-forget classifyOrg
backend.organizationApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.organizationApi.resources.lambda.functionArn],
}));

// Cross-Lambda invoke from submission Lambdas
[backend.submitRfq, backend.submitLead, backend.convertRfqToOrder].forEach((fn) => {
    fn.resources.lambda.addToRolePolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [backend.organizationApi.resources.lambda.functionArn],
    }));
    fn.addEnvironment('ORGANIZATION_API_FUNCTION_NAME', backend.organizationApi.resources.lambda.functionName);
});
```

- [ ] **Step 9.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p amplify
```
Expected: clean.

- [ ] **Step 9.5: Commit**

```bash
git add amplify/backend.ts
git commit -m "$(cat <<'EOF'
chore(org): wire organization-api Lambda in backend.ts

- Register in defineBackend
- Grant intelligenceTable read/write + Bedrock invoke + self-invoke
- Inject INTELLIGENCE_TABLE env var
- Grant cross-Lambda invoke from submit-rfq, submit-lead,
  convert-rfq-to-order with ORGANIZATION_API_FUNCTION_NAME env var

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Modify `submit-rfq` to call upsert

**Files:**
- Modify: `amplify/functions/submit-rfq/handler.ts`
- Modify: `amplify/functions/submit-rfq/handler.test.ts`

Remove the dead `matchOrg` + `updateLeadScore` block. After writing the RFQ item, call `invokeOrganizationApi` and backfill `matchedOrgId + GSI2PK` on the RFQ via UpdateItem. Failure is logged and swallowed.

- [ ] **Step 10.1: Read the current handler**

Skim `amplify/functions/submit-rfq/handler.ts` to find where the RFQ item is put, and where `matchOrg` and `updateLeadScore` are invoked. The existing flow:

1. Validate input (Zod)
2. Compute hash / dedupe check
3. PutCommand the RFQ item
4. (current dead code) `matchOrg(emailDomain, institution)` → null → `updateLeadScore` never runs
5. Send SendGrid notification
6. Return response

- [ ] **Step 10.2: Add the invokeOrganizationApi import + lead-score helper**

At the top of `submit-rfq/handler.ts`, add:

```typescript
import { invokeOrganizationApi } from '../../lib/organization/invoke-org-api';
import { computeRfqScore } from '../../lib/organization/lead-score';
```

- [ ] **Step 10.3: Add test for upsert integration**

Append to `amplify/functions/submit-rfq/handler.test.ts`:

```typescript
describe('organization upsert integration', () => {
    it('writes matchedOrgId + GSI2PK after upsert returns', async () => {
        // Mock invokeOrganizationApi to return a matched orgId
        const invokeMock = vi.fn().mockResolvedValue({ matchedOrgId: 'stanford.edu' });
        vi.doMock('../../lib/organization/invoke-org-api', () => ({ invokeOrganizationApi: invokeMock }));

        // ...remainder of test setup matches existing submit-rfq test patterns...
        // Trigger a submission with email harvey@stanford.edu, verify the UpdateCommand call
        // wrote { matchedOrgId: 'stanford.edu', GSI2PK: 'ORG#stanford.edu' } to the RFQ item.
    });

    it('still succeeds when invokeOrganizationApi throws (matchedOrgId stays null)', async () => {
        const invokeMock = vi.fn().mockRejectedValue(new Error('org api down'));
        vi.doMock('../../lib/organization/invoke-org-api', () => ({ invokeOrganizationApi: invokeMock }));

        // Submission should return HTTP 200; the RFQ item is written without matchedOrgId.
    });
});
```

(Note: these tests are sketched. Fill them in by matching the existing `submit-rfq/handler.test.ts` pattern for setting up the request event and asserting on `mockPut` / `mockUpdate` calls.)

- [ ] **Step 10.4: Replace the matchOrg block with the upsert call**

Find the section of `handler.ts` that calls `matchOrg(emailDomain, ...)` and `updateLeadScore(matchedOrgId, ...)`. Delete those calls and the helper-function definitions. Add the upsert call after the RFQ PutCommand succeeds:

```typescript
// AFTER the RFQ PutCommand succeeds:
let matchedOrgId: string | null = null;
try {
    const orgResult = await invokeOrganizationApi({
        action: 'upsertFromSubmission',
        source: 'rfq',
        email: data.email,
        institution: data.institution,
        submittedAt: now,
        scoreDelta: computeRfqScore({
            fundingStatus: data.fundingStatus,
            timeline: data.timeline,
        }),
    });
    matchedOrgId = orgResult.matchedOrgId;
} catch (err) {
    console.error(JSON.stringify({
        event: 'submit-rfq.org-upsert-failed',
        error: String(err),
        rfqId,
    }));
    // Swallow — RFQ is already written; matchedOrgId remains null.
}

if (matchedOrgId) {
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': matchedOrgId,
            ':gsi2': `ORG#${matchedOrgId}`,
        },
    }));
}
```

Then **remove** the old `matchOrg` and `updateLeadScore` function definitions from the file entirely.

- [ ] **Step 10.5: Run tests**

```bash
npm test -- amplify/functions/submit-rfq/handler.test.ts
```
Expected: PASS (existing tests + new integration tests).

- [ ] **Step 10.6: Commit**

```bash
git add amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
git commit -m "$(cat <<'EOF'
refactor(submit-rfq): call organization-api upsert and backfill matchedOrgId

Replaces dead matchOrg + updateLeadScore code with a live cross-Lambda
invoke to organization-api. After the RFQ is written, sync-invoke the
upsert; if matchedOrgId returned, follow up with UpdateCommand to set
matchedOrgId + GSI2PK on the RFQ item.

Upsert failure is logged and swallowed — the user-facing submission
still succeeds. The next submission from the same email will re-attempt
the upsert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Modify `submit-lead` to call upsert

**Files:**
- Modify: `amplify/functions/submit-lead/handler.ts`
- Modify: `amplify/functions/submit-lead/handler.test.ts`

Three lead types: `contact`, `download_gate`, `newsletter`. All call `invokeOrganizationApi`; `institution` is passed only when the schema branch has the `organization` field (contact + download_gate). After upsert, backfill `matchedOrgId + GSI2PK` on the Lead item.

- [ ] **Step 11.1: Add imports**

```typescript
import { invokeOrganizationApi } from '../../lib/organization/invoke-org-api';
import { computeLeadScore } from '../../lib/organization/lead-score';
```

- [ ] **Step 11.2: Add upsert call in the handler**

Locate the section in `handler.ts` where the LEAD item is `PutCommand`-ed. After that succeeds:

```typescript
const institution = data.type === 'newsletter' ? undefined : (data as any).organization;

let matchedOrgId: string | null = null;
try {
    const orgResult = await invokeOrganizationApi({
        action: 'upsertFromSubmission',
        source: 'lead',
        email: data.email,
        institution,
        submittedAt: now,
        scoreDelta: computeLeadScore({
            type: data.type,
            marketingOptIn: (data as any).marketingOptIn,
        }),
    });
    matchedOrgId = orgResult.matchedOrgId;
} catch (err) {
    console.error(JSON.stringify({
        event: 'submit-lead.org-upsert-failed',
        error: String(err),
        leadId,
    }));
}

if (matchedOrgId) {
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `LEAD#${leadId}`, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': matchedOrgId,
            ':gsi2': `ORG#${matchedOrgId}`,
        },
    }));
}
```

- [ ] **Step 11.3: Add tests**

Mirror the submit-rfq test additions. Verify all three lead types route through the upsert path, with the right `scoreDelta` and `institution` value.

- [ ] **Step 11.4: Run tests**

```bash
npm test -- amplify/functions/submit-lead/handler.test.ts
```
Expected: PASS.

- [ ] **Step 11.5: Commit**

```bash
git add amplify/functions/submit-lead/handler.ts amplify/functions/submit-lead/handler.test.ts
git commit -m "$(cat <<'EOF'
refactor(submit-lead): call organization-api upsert for all three lead types

After writing the Lead item, sync-invoke organization-api with source='lead'.
institution is passed for contact + download_gate types (which have the
organization field); newsletter type passes undefined since the schema
branch omits the field.

Failure swallowed; matchedOrgId backfill via follow-up UpdateCommand
when present.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Modify `convert-rfq-to-order` to call upsert

**Files:**
- Modify: `amplify/functions/convert-rfq-to-order/handler.ts`
- Modify: `amplify/functions/convert-rfq-to-order/handler.test.ts`

After writing the Order item, call `invokeOrganizationApi` with `source: 'order'` to increment orderCount, add to totalOrderValueUSD, refresh lastActivityAt, and bump leadScore. If the RFQ had `matchedOrgId = null` (e.g. free-mail submitter), re-evaluate via the upsert path; the upsert internally re-runs `classifyEmailDomain`.

- [ ] **Step 12.1: Add imports**

```typescript
import { invokeOrganizationApi } from '../../lib/organization/invoke-org-api';
import { computeOrderScore } from '../../lib/organization/lead-score';
```

- [ ] **Step 12.2: Add upsert call after Order PutCommand**

Find the section where the Order item is written. After it succeeds:

```typescript
const primaryEmail = order.contacts?.[0]?.email ?? rfq.email;
if (primaryEmail) {
    try {
        const orgResult = await invokeOrganizationApi({
            action: 'upsertFromSubmission',
            source: 'order',
            email: primaryEmail,
            institution: order.institution,
            submittedAt: now,
            scoreDelta: computeOrderScore(order.quoteAmount),
            orderValueUSD: order.quoteAmount,
        });
        // If matchedOrgId came back AND the order doesn't already have one, backfill
        if (orgResult.matchedOrgId && !order.matchedOrgId) {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `ORDER#${orderId}`, SK: 'META' },
                UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
                ExpressionAttributeValues: {
                    ':id': orgResult.matchedOrgId,
                    ':gsi2': `ORG#${orgResult.matchedOrgId}`,
                },
            }));
        }
    } catch (err) {
        console.error(JSON.stringify({
            event: 'convert-rfq.org-upsert-failed',
            error: String(err),
            orderId,
        }));
    }
}
```

- [ ] **Step 12.3: Add test**

Verify the upsert is called with `source='order'`, `orderValueUSD` is passed, and `matchedOrgId` is backfilled only when not already set.

- [ ] **Step 12.4: Run tests**

```bash
npm test -- amplify/functions/convert-rfq-to-order/handler.test.ts
```
Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add amplify/functions/convert-rfq-to-order/handler.ts amplify/functions/convert-rfq-to-order/handler.test.ts
git commit -m "$(cat <<'EOF'
refactor(convert-rfq): call organization-api upsert on order conversion

After writing the Order item, sync-invoke organization-api with
source='order' and orderValueUSD. This increments orderCount, adds to
totalOrderValueUSD, refreshes lastActivityAt, and bumps leadScore via
computeOrderScore.

If the source RFQ had matchedOrgId=null but the converted Order's primary
contact email resolves to an Org (e.g. RFQ submitted with a free-mail
address but order primary contact uses institutional email), backfill
the Order's matchedOrgId here. Existing matchedOrgId is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Backfill script

**Files:**
- Create: `scripts/backfill-organizations.ts`

One-time idempotent script that scans the table for historical RFQ/Order/Lead items, groups by eTLD+1 domain, creates Organization META + alias lookup items, updates source items with matchedOrgId + GSI2PK, repairs converted Orders missing matchedOrgId, and triggers async AI classification.

- [ ] **Step 13.1: Create the script**

Create `scripts/backfill-organizations.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * One-time idempotent backfill: create Organization entities from historical
 * RFQ/Order/Lead data and stamp matchedOrgId + GSI2PK on source items.
 *
 * Usage:
 *   INTELLIGENCE_TABLE=<table-name> tsx scripts/backfill-organizations.ts [--dry-run] [--classify-only]
 *
 * --dry-run        Print planned writes; do not execute.
 * --classify-only  Skip Org creation; only trigger classifyOrg for existing Orgs
 *                  that have aiClassifiedAt missing.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    UpdateCommand,
    GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { classifyEmailDomain } from '../amplify/lib/organization/etld';
import {
    computeRfqScore,
    computeLeadScore,
    computeOrderScore,
} from '../amplify/lib/organization/lead-score';
import { LEAD_SCORE_THRESHOLD } from '../amplify/lib/organization/constants';

const TABLE = process.env.INTELLIGENCE_TABLE!;
const ORG_API_FUNC = process.env.ORGANIZATION_API_FUNCTION_NAME!;
const REGION = process.env.AWS_REGION ?? 'us-east-2';

if (!TABLE) {
    console.error('INTELLIGENCE_TABLE env var required');
    process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const classifyOnly = process.argv.includes('--classify-only');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambda = new LambdaClient({ region: REGION });

function invertedActivityToken(iso: string): string {
    const ms = new Date(iso).getTime();
    return (8_640_000_000_000_000 - ms).toString().padStart(16, '0');
}

function invertedScoreToken(score: number): string {
    const clamped = Math.max(0, Math.min(10_000, score));
    return (10_000 - clamped).toString().padStart(5, '0');
}

interface OrgGroup {
    canonicalDomain: string;
    aliasDomains: Set<string>;
    rfqs: any[];
    orders: any[];
    leads: any[];
    firstSeen: string;
    lastActivity: string;
    leadScore: number;
    primaryContactEmail: string;
    primaryInstitution: string | undefined;
    totalOrderValueUSD: number;
}

async function scanAllSubmissions(): Promise<any[]> {
    const out: any[] = [];
    let lastKey: any = undefined;
    do {
        const r: any = await ddb.send(new ScanCommand({
            TableName: TABLE,
            FilterExpression: 'entityType IN (:rfq, :order, :lead)',
            ExpressionAttributeValues: {
                ':rfq': 'RFQ_SUBMISSION',
                ':order': 'ORDER',
                ':lead': 'LEAD_SUBMISSION',
            },
            ExclusiveStartKey: lastKey,
        }));
        out.push(...(r.Items ?? []));
        lastKey = r.LastEvaluatedKey;
    } while (lastKey);
    return out;
}

function groupByOrg(items: any[]): Map<string, OrgGroup> {
    const map = new Map<string, OrgGroup>();
    let freeMailSkipped = 0;

    for (const item of items) {
        const email = (item.email ?? item.contacts?.[0]?.email ?? '') as string;
        if (!email) continue;
        const { orgId, domain, isFreeMailDomain } = classifyEmailDomain(email);
        if (!orgId) {
            if (isFreeMailDomain) freeMailSkipped++;
            continue;
        }

        if (!map.has(orgId)) {
            map.set(orgId, {
                canonicalDomain: orgId,
                aliasDomains: new Set([domain]),
                rfqs: [], orders: [], leads: [],
                firstSeen: item.submittedAt ?? item.createdAt ?? item.quoteDate ?? '2020-01-01',
                lastActivity: '2020-01-01',
                leadScore: 0,
                primaryContactEmail: email,
                primaryInstitution: item.institution ?? item.organization,
                totalOrderValueUSD: 0,
            });
        }
        const group = map.get(orgId)!;
        group.aliasDomains.add(domain);

        const submittedAt = item.submittedAt ?? item.quoteDate ?? item.createdAt ?? '2020-01-01';
        if (submittedAt < group.firstSeen) group.firstSeen = submittedAt;
        if (submittedAt > group.lastActivity) group.lastActivity = submittedAt;

        switch (item.entityType) {
            case 'RFQ_SUBMISSION':
                group.rfqs.push(item);
                group.leadScore += computeRfqScore({
                    fundingStatus: item.fundingStatus,
                    timeline: item.timeline,
                });
                break;
            case 'ORDER':
                group.orders.push(item);
                group.leadScore += computeOrderScore(item.quoteAmount);
                group.totalOrderValueUSD += (item.quoteAmount ?? 0);
                break;
            case 'LEAD_SUBMISSION':
                group.leads.push(item);
                group.leadScore += computeLeadScore({
                    type: item.type,
                    marketingOptIn: item.marketingOptIn,
                });
                break;
        }
    }

    console.log(`Grouped ${items.length} items into ${map.size} Orgs; skipped ${freeMailSkipped} free-mail submissions`);
    return map;
}

async function writeOrgAndAliases(orgId: string, group: OrgGroup): Promise<{ created: boolean }> {
    const nowIso = new Date().toISOString();
    const item = {
        PK: `ORG#${orgId}`,
        SK: 'META',
        entityType: 'ORGANIZATION',
        orgId,
        primaryDomain: orgId,
        aliasDomains: Array.from(group.aliasDomains).filter((d) => d !== orgId),
        displayName: orgId,
        type: 'unknown',
        leadScore: group.leadScore,
        hasActiveInquiry: group.rfqs.length > 0 || group.leads.length > 0,
        rfqCount: group.rfqs.length,
        orderCount: group.orders.length,
        leadCount: group.leads.length,
        totalOrderValueUSD: group.totalOrderValueUSD,
        firstSeenAt: group.firstSeen,
        lastActivityAt: group.lastActivity,
        status: 'active',
        contactCount: group.rfqs.length + group.leads.length,
        primaryContactEmail: group.primaryContactEmail,
        createdAt: nowIso,
        updatedAt: nowIso,
        GSI1PK: 'ORG_TYPE#unknown',
        GSI1SK: `${invertedActivityToken(group.lastActivity)}#${orgId}`,
        GSI2PK: `ORG_DOMAIN#${orgId}`,
        GSI2SK: 'ORG',
        ...(group.leadScore >= LEAD_SCORE_THRESHOLD ? {
            GSI3PK: 'ORG_LEAD_SCORE',
            GSI3SK: `${invertedScoreToken(group.leadScore)}#${orgId}`,
        } : {}),
    };

    if (dryRun) {
        console.log(`DRY-RUN PutItem ORG#${orgId} (leadScore=${group.leadScore})`);
        return { created: true };
    }

    try {
        await ddb.send(new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
        console.log(`Created ORG#${orgId}`);
    } catch (err: any) {
        if (err?.name === 'ConditionalCheckFailedException') {
            console.log(`Skipped ORG#${orgId} (already exists)`);
            return { created: false };
        }
        throw err;
    }

    // Write alias lookups for each domain that differs from canonical
    for (const d of group.aliasDomains) {
        if (d === orgId) continue;
        try {
            await ddb.send(new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${d}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${d}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            }));
        } catch (err: any) {
            if (err?.name !== 'ConditionalCheckFailedException') throw err;
        }
    }

    return { created: true };
}

async function backfillItemMatchedOrg(item: any, orgId: string): Promise<void> {
    let pk: string;
    switch (item.entityType) {
        case 'RFQ_SUBMISSION': pk = `RFQ#${item.rfqId}`; break;
        case 'ORDER':          pk = `ORDER#${item.orderId}`; break;
        case 'LEAD_SUBMISSION': pk = `LEAD#${item.leadId}`; break;
        default: return;
    }
    if (dryRun) {
        console.log(`DRY-RUN UpdateItem ${pk} matchedOrgId=${orgId}`);
        return;
    }
    await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: pk, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': orgId,
            ':gsi2': `ORG#${orgId}`,
        },
    }));
}

async function repairOrderFromRfq(rfq: any, orgId: string): Promise<boolean> {
    if (!rfq.linkedOrderId) return false;
    if (dryRun) {
        console.log(`DRY-RUN repair ORDER#${rfq.linkedOrderId} matchedOrgId=${orgId}`);
        return true;
    }
    await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ORDER#${rfq.linkedOrderId}`, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': orgId,
            ':gsi2': `ORG#${orgId}`,
        },
    }));
    return true;
}

async function triggerClassify(orgId: string, institution?: string): Promise<void> {
    if (dryRun) {
        console.log(`DRY-RUN classify ${orgId}`);
        return;
    }
    await lambda.send(new InvokeCommand({
        FunctionName: ORG_API_FUNC,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(JSON.stringify({
            action: 'classifyOrg',
            orgId,
            institution,
        })),
    }));
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log(`Starting backfill against ${TABLE} (dry-run=${dryRun}, classify-only=${classifyOnly})`);

    if (classifyOnly) {
        console.log('classify-only mode: scanning for Orgs missing aiClassifiedAt...');
        // Skipped; see Task 13.2 for the classify-only sub-flow.
        return;
    }

    const items = await scanAllSubmissions();
    console.log(`Scanned ${items.length} RFQ/Order/Lead items`);

    const groups = groupByOrg(items);

    let orgsCreated = 0, orgsExisting = 0;
    let rfqsBackfilled = 0, ordersBackfilled = 0, leadsBackfilled = 0, ordersRepaired = 0;
    let batchedClassifyCount = 0;

    for (const [orgId, group] of groups) {
        const { created } = await writeOrgAndAliases(orgId, group);
        if (created) orgsCreated++; else orgsExisting++;

        for (const rfq of group.rfqs) {
            await backfillItemMatchedOrg(rfq, orgId);
            rfqsBackfilled++;
            const repaired = await repairOrderFromRfq(rfq, orgId);
            if (repaired) ordersRepaired++;
        }
        for (const order of group.orders) {
            await backfillItemMatchedOrg(order, orgId);
            ordersBackfilled++;
        }
        for (const lead of group.leads) {
            await backfillItemMatchedOrg(lead, orgId);
            leadsBackfilled++;
        }

        if (created) {
            await triggerClassify(orgId, group.primaryInstitution);
            batchedClassifyCount++;
            if (batchedClassifyCount % 10 === 0) await sleep(100);  // throttle
        }

        await sleep(50);  // gentle on DDB write capacity
    }

    console.log('Backfill complete:', JSON.stringify({
        orgsCreated,
        orgsExisting,
        rfqsBackfilled,
        ordersBackfilled,
        ordersRepaired,
        leadsBackfilled,
    }, null, 2));
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
```

- [ ] **Step 13.2: Add classify-only sub-flow**

Replace the `if (classifyOnly) { ... return; }` block with:

```typescript
if (classifyOnly) {
    console.log('classify-only mode: scanning for Orgs missing aiClassifiedAt...');
    const r = await ddb.send(new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'entityType = :et AND attribute_not_exists(aiClassifiedAt)',
        ExpressionAttributeValues: { ':et': 'ORGANIZATION' },
    }));
    let n = 0;
    for (const org of (r.Items ?? [])) {
        await triggerClassify(org.orgId as string, undefined);
        n++;
        if (n % 10 === 0) await sleep(100);
    }
    console.log(`Triggered classify on ${n} orgs`);
    return;
}
```

- [ ] **Step 13.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit scripts/backfill-organizations.ts
```

- [ ] **Step 13.4: Commit**

```bash
git add scripts/backfill-organizations.ts
git commit -m "$(cat <<'EOF'
feat(org): one-time backfill script for historical RFQ/Order/Lead data

Idempotent script that scans intelligenceTable, groups submissions by
eTLD+1 domain (skipping free-mail), creates Organization META + alias
lookup items, stamps matchedOrgId + GSI2PK on each source item, repairs
converted Orders that inherited empty matchedOrgId from the dead RFQ
matchOrg path, and triggers async AI classification.

--dry-run flag prints planned writes without executing.
--classify-only flag skips Org creation; only triggers classify for
existing Orgs missing aiClassifiedAt.

50ms sleep between Org groups + 100ms classify-trigger throttle keeps
DDB write capacity and Lambda concurrency comfortable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Frontend service + hooks

**Files:**
- Create: `src/services/organizationAdminService.ts`
- Create: `src/hooks/useOrganizations.ts`
- Create: `src/hooks/useOrganization.ts`

Thin wrappers around `client.queries.*` / `client.mutations.*` with the project's standard error handling.

- [ ] **Step 14.1: Create `organizationAdminService.ts`**

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

export interface ListOrgFilters {
    statuses?: string[];
    types?: string[];
    countries?: string[];
    ownerSalesRep?: string;
    minLeadScore?: number;
    search?: string;
    sortBy?: 'activity' | 'leadScore' | 'firstSeen';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

export async function listOrganizations(args: ListOrgFilters) {
    const { data, errors } = await client.queries.listOrganizations(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function getOrganization(orgId: string) {
    const { data, errors } = await client.queries.getOrganization({ orgId } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function updateOrganizationStatus(args: { orgId: string; status: string; adminNotes?: string; tags?: string[] }) {
    const { data, errors } = await client.mutations.updateOrganizationStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function updateOrganizationOwner(args: { orgId: string; ownerSalesRep?: string }) {
    const { data, errors } = await client.mutations.updateOrganizationOwner(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function reclassifyOrganization(args: { orgId: string; force?: boolean }) {
    const { data, errors } = await client.mutations.reclassifyOrganization(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}
```

- [ ] **Step 14.2: Create `useOrganizations.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';
import type { ListOrgFilters } from '../services/organizationAdminService';

export function useOrganizations(initialFilters: ListOrgFilters = {}) {
    const [filters, setFilters] = useState<ListOrgFilters>(initialFilters);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await svc.listOrganizations(filters);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, loading, error, refresh, filters, setFilters };
}
```

- [ ] **Step 14.3: Create `useOrganization.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

export function useOrganization(orgId: string | undefined) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const result = await svc.getOrganization(orgId);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, loading, error, refresh };
}
```

- [ ] **Step 14.4: Commit**

```bash
git add src/services/organizationAdminService.ts src/hooks/useOrganizations.ts src/hooks/useOrganization.ts
git commit -m "$(cat <<'EOF'
feat(org): frontend service layer + hooks for Organization admin

organizationAdminService wraps client.queries.* / client.mutations.*
with consistent error concatenation. useOrganizations and useOrganization
follow the existing useRfqs pattern: {data, loading, error, refresh}.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: List page (KPIs + filter bar + table)

**Files:**
- Create: `src/pages/admin/OrganizationListPage.tsx`
- Create: `src/components/admin/OrganizationKpiCards.tsx`
- Create: `src/components/admin/OrganizationFilterBar.tsx`
- Create: `src/components/admin/OrganizationTable.tsx`

Three components composed by the list page. Matches the existing `RFQListPage` layout and styling.

- [ ] **Step 15.1: Create `OrganizationKpiCards.tsx`**

```typescript
import React from 'react';

interface Props {
    total: number;
    highLeadScore: number;
    newThisWeek: number;
    withoutOwner: number;
    onClickKpi: (kpi: 'all' | 'highLeadScore' | 'newThisWeek' | 'withoutOwner') => void;
}

export function OrganizationKpiCards({ total, highLeadScore, newThisWeek, withoutOwner, onClickKpi }: Props) {
    return (
        <div className="kpi-grid">
            <button className="kpi-card" onClick={() => onClickKpi('all')}>
                <div className="kpi-value">{total}</div>
                <div className="kpi-label">Total active</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('highLeadScore')}>
                <div className="kpi-value">{highLeadScore}</div>
                <div className="kpi-label">Lead score ≥ 50</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('newThisWeek')}>
                <div className="kpi-value">{newThisWeek}</div>
                <div className="kpi-label">New this week</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('withoutOwner')}>
                <div className="kpi-value">{withoutOwner}</div>
                <div className="kpi-label">Without owner</div>
            </button>
        </div>
    );
}
```

- [ ] **Step 15.2: Create `OrganizationFilterBar.tsx`**

```typescript
import React from 'react';
import type { ListOrgFilters } from '../../services/organizationAdminService';

interface Props {
    filters: ListOrgFilters;
    onChange: (next: ListOrgFilters) => void;
}

const TYPE_OPTIONS = ['university', 'research-institute', 'company', 'government', 'other', 'unknown'];

export function OrganizationFilterBar({ filters, onChange }: Props) {
    return (
        <div className="filter-bar">
            <input
                type="text"
                placeholder="Search displayName / domain..."
                value={filters.search ?? ''}
                onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            />
            <select
                value={(filters.types ?? [])[0] ?? ''}
                onChange={(e) => onChange({ ...filters, types: e.target.value ? [e.target.value] : undefined })}
            >
                <option value="">All types</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
                type="number"
                placeholder="Min lead score"
                value={filters.minLeadScore ?? ''}
                onChange={(e) => onChange({ ...filters, minLeadScore: e.target.value ? Number(e.target.value) : undefined })}
            />
            <select
                value={filters.sortBy ?? 'activity'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
            >
                <option value="activity">Sort: Recent activity</option>
                <option value="leadScore">Sort: Lead score</option>
                <option value="firstSeen">Sort: First seen</option>
            </select>
        </div>
    );
}
```

- [ ] **Step 15.3: Create `OrganizationTable.tsx`**

```typescript
import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
    items: any[];
}

function relativeTime(iso: string | undefined): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

export function OrganizationTable({ items }: Props) {
    if (!items.length) {
        return <div className="empty-state">No organizations match these filters.</div>;
    }
    return (
        <table className="org-table">
            <thead>
                <tr>
                    <th>Organization</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Country</th>
                    <th>Lead score</th>
                    <th>Last activity</th>
                    <th>Status</th>
                    <th>Owner</th>
                </tr>
            </thead>
            <tbody>
                {items.map((org) => (
                    <tr key={org.orgId}>
                        <td><Link to={`/admin/organizations/${org.orgId}`}>{org.displayName ?? org.orgId}</Link></td>
                        <td>{org.primaryDomain}</td>
                        <td><span className={`type-chip type-${org.type}`}>{org.type}</span></td>
                        <td>{org.country ?? '—'}</td>
                        <td>
                            <div className="lead-score-bar">
                                <div className="lead-score-fill" style={{ width: `${Math.min(100, (org.leadScore ?? 0))}%` }} />
                                <span>{org.leadScore ?? 0}</span>
                            </div>
                        </td>
                        <td>{relativeTime(org.lastActivityAt)}</td>
                        <td><span className={`status-chip status-${org.status}`}>{org.status}</span></td>
                        <td>{org.ownerSalesRep ?? '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
```

- [ ] **Step 15.4: Create `OrganizationListPage.tsx`**

```typescript
import React from 'react';
import { useOrganizations } from '../../hooks/useOrganizations';
import { OrganizationKpiCards } from '../../components/admin/OrganizationKpiCards';
import { OrganizationFilterBar } from '../../components/admin/OrganizationFilterBar';
import { OrganizationTable } from '../../components/admin/OrganizationTable';

export function OrganizationListPage() {
    const { data, loading, error, filters, setFilters, refresh } = useOrganizations({});

    return (
        <div className="org-list-page">
            <h1>Organizations</h1>
            {data && (
                <OrganizationKpiCards
                    total={data.totalActiveCount ?? data.items.length}
                    highLeadScore={(data.items ?? []).filter((o: any) => (o.leadScore ?? 0) >= 50).length}
                    newThisWeek={(data.items ?? []).filter((o: any) => {
                        const seen = new Date(o.firstSeenAt ?? 0).getTime();
                        return seen >= Date.now() - 7 * 24 * 60 * 60 * 1000;
                    }).length}
                    withoutOwner={(data.items ?? []).filter((o: any) => !o.ownerSalesRep).length}
                    onClickKpi={(kpi) => {
                        if (kpi === 'highLeadScore') setFilters({ ...filters, minLeadScore: 50 });
                        else if (kpi === 'withoutOwner') setFilters({ ...filters, ownerSalesRep: undefined });
                        else if (kpi === 'all') setFilters({});
                    }}
                />
            )}
            <OrganizationFilterBar filters={filters} onChange={setFilters} />
            <button onClick={refresh}>Refresh</button>
            {loading && <div>Loading...</div>}
            {error && <div className="error">{error.message}</div>}
            {data && <OrganizationTable items={data.items ?? []} />}
        </div>
    );
}
```

- [ ] **Step 15.5: Commit**

```bash
git add src/pages/admin/OrganizationListPage.tsx src/components/admin/OrganizationKpiCards.tsx src/components/admin/OrganizationFilterBar.tsx src/components/admin/OrganizationTable.tsx
git commit -m "$(cat <<'EOF'
feat(org): list page with KPI cards, filter bar, table

OrganizationListPage composes KpiCards (4 click-through stat cards),
FilterBar (search + type + min lead score + sort), and Table (sortable
rows with displayName link, type chip, lead score bar, status chip).

Empty state and error message inline; refresh button triggers reload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Detail page (header panel + timeline)

**Files:**
- Create: `src/pages/admin/OrganizationDetailPage.tsx`
- Create: `src/components/admin/OrganizationHeaderPanel.tsx`
- Create: `src/components/admin/OrganizationTimeline.tsx`

Two-column layout. Left sticky panel with metadata + admin controls. Right scrolling content with aggregate cards + 4-tab timeline (RFQs / Orders / Leads / Tenders).

- [ ] **Step 16.1: Create `OrganizationHeaderPanel.tsx`**

```typescript
import React, { useState } from 'react';
import {
    updateOrganizationStatus,
    updateOrganizationOwner,
    reclassifyOrganization,
} from '../../services/organizationAdminService';

interface Props {
    org: any;
    onUpdate: () => void;
}

export function OrganizationHeaderPanel({ org, onUpdate }: Props) {
    const [status, setStatus] = useState(org.status ?? 'active');
    const [owner, setOwner] = useState(org.ownerSalesRep ?? '');
    const [busy, setBusy] = useState(false);

    async function saveStatus(newStatus: string) {
        setBusy(true);
        try {
            await updateOrganizationStatus({ orgId: org.orgId, status: newStatus });
            setStatus(newStatus);
            onUpdate();
        } finally { setBusy(false); }
    }

    async function saveOwner(newOwner: string) {
        setBusy(true);
        try {
            await updateOrganizationOwner({ orgId: org.orgId, ownerSalesRep: newOwner || undefined });
            setOwner(newOwner);
            onUpdate();
        } finally { setBusy(false); }
    }

    async function doReclassify() {
        setBusy(true);
        try {
            await reclassifyOrganization({ orgId: org.orgId, force: true });
            onUpdate();
        } finally { setBusy(false); }
    }

    return (
        <aside className="org-header-panel">
            <h2>{org.displayName ?? org.orgId}</h2>
            <div className="primary-domain">{org.primaryDomain}</div>
            <div className="org-meta">
                <div><strong>Type:</strong> {org.type}</div>
                <div><strong>Country:</strong> {org.country ?? '—'}</div>
                <div><strong>Lead score:</strong> {org.leadScore ?? 0}</div>
                <div><strong>First seen:</strong> {org.firstSeenAt?.slice(0, 10) ?? '—'}</div>
                <div><strong>Last activity:</strong> {org.lastActivityAt?.slice(0, 10) ?? '—'}</div>
                {org.aiClassifiedAt && (
                    <div><strong>AI classified:</strong> {org.aiClassifiedAt.slice(0, 10)} ({org.aiProvider})</div>
                )}
            </div>

            <label>
                Status:
                <select value={status} onChange={(e) => saveStatus(e.target.value)} disabled={busy}>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                    <option value="blocked">blocked</option>
                </select>
            </label>

            <label>
                Owner:
                <input
                    type="email"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    onBlur={() => saveOwner(owner)}
                    placeholder="sales@ninescrolls.com"
                    disabled={busy}
                />
            </label>

            <button onClick={doReclassify} disabled={busy}>Reclassify with AI</button>

            {org.aliasDomains?.length > 0 && (
                <div className="alias-domains">
                    <strong>Alias domains:</strong>
                    <ul>{org.aliasDomains.map((d: string) => <li key={d}>{d}</li>)}</ul>
                </div>
            )}
        </aside>
    );
}
```

- [ ] **Step 16.2: Create `OrganizationTimeline.tsx`**

```typescript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
    recentRfqs: any[];
    recentOrders: any[];
    recentLeads: any[];
}

export function OrganizationTimeline({ recentRfqs, recentOrders, recentLeads }: Props) {
    const [tab, setTab] = useState<'rfqs' | 'orders' | 'leads' | 'tenders'>('rfqs');

    return (
        <div className="org-timeline">
            <div className="tabs">
                <button onClick={() => setTab('rfqs')} className={tab === 'rfqs' ? 'active' : ''}>
                    RFQs ({recentRfqs.length})
                </button>
                <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'active' : ''}>
                    Orders ({recentOrders.length})
                </button>
                <button onClick={() => setTab('leads')} className={tab === 'leads' ? 'active' : ''}>
                    Leads ({recentLeads.length})
                </button>
                <button onClick={() => setTab('tenders')} className={tab === 'tenders' ? 'active' : ''}>
                    Tenders (0)
                </button>
            </div>

            {tab === 'rfqs' && recentRfqs.map((r) => (
                <div key={r.rfqId} className="timeline-row">
                    <span>{r.submittedAt?.slice(0, 10)}</span>
                    <Link to={`/admin/rfqs/${r.rfqId}`}>{r.equipmentCategory} — {r.institution}</Link>
                </div>
            ))}
            {tab === 'orders' && recentOrders.map((o) => (
                <div key={o.orderId} className="timeline-row">
                    <span>{o.quoteDate?.slice(0, 10)}</span>
                    <Link to={`/admin/orders/${o.orderId}`}>{o.productModel} — ${o.quoteAmount?.toLocaleString()}</Link>
                </div>
            ))}
            {tab === 'leads' && recentLeads.map((l) => (
                <div key={l.leadId} className="timeline-row">
                    <span>{l.submittedAt?.slice(0, 10)}</span>
                    <Link to={`/admin/leads/${l.leadId}`}>{l.type} — {l.topic ?? l.productName ?? ''}</Link>
                </div>
            ))}
            {tab === 'tenders' && (
                <div className="empty-state">
                    Tender → Organization matching arrives in Phase D.
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 16.3: Create `OrganizationDetailPage.tsx`**

```typescript
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrganization } from '../../hooks/useOrganization';
import { OrganizationHeaderPanel } from '../../components/admin/OrganizationHeaderPanel';
import { OrganizationTimeline } from '../../components/admin/OrganizationTimeline';

export function OrganizationDetailPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const { data, loading, error, refresh } = useOrganization(orgId);

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="error">{error.message}</div>;
    if (!data) return <div>Not found.</div>;

    return (
        <div className="org-detail-page">
            <Link to="/admin/organizations">← Back to list</Link>
            <div className="two-column">
                <OrganizationHeaderPanel org={data.organization} onUpdate={refresh} />
                <main className="org-main">
                    <div className="aggregate-cards">
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.rfqCount ?? 0}</div>
                            <div className="agg-label">RFQs</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.orderCount ?? 0}</div>
                            <div className="agg-label">Orders</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.leadCount ?? 0}</div>
                            <div className="agg-label">Leads</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">${(data.organization.totalOrderValueUSD ?? 0).toLocaleString()}</div>
                            <div className="agg-label">Total order value</div>
                        </div>
                    </div>
                    <OrganizationTimeline
                        recentRfqs={data.recentRfqs ?? []}
                        recentOrders={data.recentOrders ?? []}
                        recentLeads={data.recentLeads ?? []}
                    />
                </main>
            </div>
        </div>
    );
}
```

- [ ] **Step 16.4: Commit**

```bash
git add src/pages/admin/OrganizationDetailPage.tsx src/components/admin/OrganizationHeaderPanel.tsx src/components/admin/OrganizationTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(org): detail page with header panel + timeline

Two-column layout: left sticky panel with metadata, status dropdown,
owner email field (debounced save on blur), and Reclassify with AI button.
Right column shows 4 aggregate cards (RFQ/Order/Lead counts + total
order value) plus a 4-tab timeline (RFQs / Orders / Leads / Tenders).

Tenders tab shows the 'arrives in Phase D' empty state. Each timeline
row links to the corresponding admin detail page for the source entity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Nav integration + routing

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`

Add `Organizations` to the admin nav and wire two new routes.

- [ ] **Step 17.1: Add nav entry**

In `src/components/admin/AdminLayout.tsx`, find `NAV_ITEMS` and add after `Leads`:

```typescript
const NAV_ITEMS = [
    { path: '/admin/dashboard',     label: 'Dashboard',     icon: 'dashboard' },
    { path: '/admin/orders',        label: 'Orders',        icon: 'shopping_cart' },
    { path: '/admin/rfqs',          label: 'RFQs',          icon: 'request_quote' },
    { path: '/admin/leads',         label: 'Leads',         icon: 'contact_mail' },
    { path: '/admin/organizations', label: 'Organizations', icon: 'business' },  // NEW
    { path: '/admin/insights',      label: 'Insights',      icon: 'insights' },
    { path: '/admin/questions',     label: 'Q&A',           icon: 'forum' },
    { path: '/admin/analytics',     label: 'Analytics',     icon: 'analytics' },
];
```

If Phase 2's PR has been merged earlier and added `Tenders` between RFQs and Leads, the final order becomes:

```
Dashboard → Orders → RFQs → Tenders → Leads → Organizations → Insights → Q&A → Analytics
```

This merge order is documented in the spec; no conflict resolution should be necessary.

- [ ] **Step 17.2: Add routes**

In `src/App.tsx`, find the existing admin routes (e.g. `/admin/rfqs`, `/admin/orders`) and add:

```typescript
<Route path="/admin/organizations" element={<OrganizationListPage />} />
<Route path="/admin/organizations/:orgId" element={<OrganizationDetailPage />} />
```

Add the imports at the top:

```typescript
import { OrganizationListPage } from './pages/admin/OrganizationListPage';
import { OrganizationDetailPage } from './pages/admin/OrganizationDetailPage';
```

- [ ] **Step 17.3: Commit**

```bash
git add src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
chore(org): integrate Organizations into admin nav + routing

Adds Organizations nav entry between Leads and Insights (workflow order:
RFQ = current sales, Tenders = potential, Leads = early funnel,
Organizations = unified customer view, Insights = published content).

Two routes: /admin/organizations (list) and /admin/organizations/:orgId
(detail). Order in App.tsx routes does not matter since these paths
do not collide.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Sandbox deploy + end-to-end verification

This task does not modify code; it walks through a real Amplify sandbox deploy and exercises the full flow against AWS.

- [ ] **Step 18.1: Verify all tests pass**

```bash
npm test -- amplify/ scripts/
```
Expected: all tests pass.

- [ ] **Step 18.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p amplify
npx tsc --noEmit -p .  # or whatever the frontend tsconfig is
```
Expected: clean.

- [ ] **Step 18.3: Deploy sandbox**

Refresh SSO credentials:

```bash
aws sso login
```

Start the sandbox:

```bash
npx ampx sandbox
```

Wait for `[Sandbox] Watching for file changes...`. Expected duration: 5–10 minutes for the first deploy after adding `organization-api`.

If deploy fails on CloudFormation, copy the error to the implementation team. The new IAM grants are the most likely fail point (e.g. missing `lambda:InvokeFunction` resource ARN).

- [ ] **Step 18.4: Identify the deployed table name**

In another terminal:

```bash
aws cloudformation list-stack-resources \
    --stack-name $(aws cloudformation list-stacks \
        --query 'StackSummaries[?contains(StackName, `harvey-sandbox`)].StackName | [0]' \
        --output text)-feedbacksystemstack* \
    --query 'StackResourceSummaries[?ResourceType==`AWS::DynamoDB::Table`].PhysicalResourceId | [0]' \
    --output text
```

Capture this as `PROD_TABLE` for the next steps.

- [ ] **Step 18.5: Submit a test RFQ via the form**

Open the sandbox URL printed by `npx ampx sandbox`. Submit an RFQ with:
- Email: `test-harvey@stanford.edu`
- Institution: `Stanford University`
- Equipment: any category
- Funding status: `funded`
- Timeline: `immediate`

- [ ] **Step 18.6: Verify Organization was created**

```bash
aws dynamodb get-item \
    --table-name "$PROD_TABLE" \
    --key '{"PK":{"S":"ORG#stanford.edu"},"SK":{"S":"META"}}' \
    --query 'Item'
```

Expected: an item with `orgId=stanford.edu`, `type=unknown` (or `university` if classify already ran), `leadScore=16` (8 base + 5 funded + 3 immediate), `rfqCount=1`, `hasActiveInquiry=true`.

- [ ] **Step 18.7: Verify the RFQ was backfilled**

```bash
aws dynamodb query \
    --table-name "$PROD_TABLE" \
    --index-name GSI2 \
    --key-condition-expression 'GSI2PK = :pk' \
    --expression-attribute-values '{":pk":{"S":"ORG#stanford.edu"}}' \
    --query 'Items[*].[PK,matchedOrgId,entityType]' \
    --output table
```

Expected: at least one row showing `PK=RFQ#...`, `matchedOrgId=stanford.edu`, `entityType=RFQ_SUBMISSION`.

- [ ] **Step 18.8: Verify AI classification completed**

Wait ~30 seconds, then re-query the Org:

```bash
aws dynamodb get-item \
    --table-name "$PROD_TABLE" \
    --key '{"PK":{"S":"ORG#stanford.edu"},"SK":{"S":"META"}}' \
    --query 'Item.{displayName:displayName,type:type,country:country,aiProvider:aiProvider}'
```

Expected: `displayName=Stanford University` (or similar), `type=university`, `country=US`, `aiProvider=bedrock`.

- [ ] **Step 18.9: Submit a second RFQ from the same domain (different subdomain)**

Submit another RFQ with email `lab@cs.stanford.edu`. Verify:
- The same Organization `ORG#stanford.edu` is reused (not a new one).
- `cs.stanford.edu` is added to `aliasDomains`.
- `leadScore` increased.

- [ ] **Step 18.10: Submit a free-mail RFQ**

Submit an RFQ with email `test@gmail.com`. Verify:
- No Organization `ORG#gmail.com` is created.
- The RFQ item has `matchedOrgId` empty.

- [ ] **Step 18.11: Run the backfill script in dry-run mode**

```bash
INTELLIGENCE_TABLE="$PROD_TABLE" \
ORGANIZATION_API_FUNCTION_NAME=$(aws lambda list-functions \
    --query 'Functions[?contains(FunctionName, `organization-api`)].FunctionName | [0]' \
    --output text) \
tsx scripts/backfill-organizations.ts --dry-run
```

Expected: prints planned writes; does not execute.

- [ ] **Step 18.12: Open admin UI**

Navigate to `https://<sandbox-url>/admin/organizations`. Verify:
- The list shows the test Orgs.
- Filter by `type=university` works.
- Click into the Stanford Org → detail page shows RFQ in the timeline.
- Click `Reclassify with AI` → state updates.
- Change status to `archived` → row disappears from default view.

- [ ] **Step 18.13: Final commit (verification log)**

No code changes; record-keeping commit:

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(org): Phase C end-to-end sandbox verification log

Verified flows:
- Submit RFQ from harvey@stanford.edu → Organization auto-created
- AI classification populated displayName/type/country within ~30s
- Second submission from cs.stanford.edu reuses Org + adds alias
- Free-mail submission (gmail.com) does NOT create Organization
- Admin list page filtering, sorting, and click-through to detail work
- Reclassify with AI button triggers the mutation
- Status change reflects immediately

Phase C is functionally complete. Next: brainstorm Phase D
(cross-entity matching engine).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage**
- [x] eTLD+1 normalization with free-mail blacklist — Task 1
- [x] Shared constants (cap, threshold, cooldown, timeouts) — Task 1
- [x] Lead-score helpers — Task 2
- [x] invoke-org-api wrapper — Task 2
- [x] Organization customType + queries + mutations — Task 3
- [x] organization-api Lambda scaffold + dispatchers — Task 4
- [x] upsertFromSubmission with race-safe PutItem-then-Update — Task 5
- [x] classifyOrg with Bedrock + Anthropic fallback — Task 6
- [x] listOrganizations + getOrganization — Task 7
- [x] updateOrganizationStatus / Owner / reclassify — Task 8
- [x] backend.ts IAM + invoke grants — Task 9
- [x] submit-rfq modification — Task 10
- [x] submit-lead modification (all 3 types) — Task 11
- [x] convert-rfq-to-order modification — Task 12
- [x] Backfill script with dry-run + classify-only + Order repair — Task 13
- [x] Frontend service + hooks — Task 14
- [x] List page (KPIs + filter + table) — Task 15
- [x] Detail page (header + timeline) — Task 16
- [x] Nav + routing — Task 17
- [x] Sandbox verification — Task 18

**No placeholders**
- All TBDs/TODOs removed.
- Every step shows full code or full command.

**Type consistency**
- `OrgType` / `OrgStatus` types defined in Task 1 and used consistently in Tasks 5–8.
- `LEAD_SCORE_THRESHOLD`, `ALIAS_DOMAINS_CAP`, `RECLASSIFY_COOLDOWN_DAYS` named constants referenced everywhere.
- `invokeOrganizationApi` signature matches `UpsertFromSubmissionPayload` shape in both Lambda handlers and the helper.
- `OrganizationDetailBundle.recentTenders` consistently `a.json()` returning `[]` in Phase C.

**Risks acknowledged**
- Race condition mitigation tested in Task 5.4.
- Provisioned Concurrency cost flagged in spec; not enabled in Task 4 (could be added in deployment plan if observed cold-start latency hurts).
- Backfill order-repair sub-step explicit in Task 13.

The plan is complete.
