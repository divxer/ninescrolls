# Customer Organization DB — Foundation Design Spec

**Date:** 2026-05-15
**Status:** Approved (pending implementation)
**Owner:** harvey@ninescrolls.com
**Position in roadmap:** This is **Phase C** of the internal admin platform expansion. It is a foundational prerequisite for downstream work — D (cross-entity matching engine), E (marketing campaign execution), F (ROI dashboard). It is independent of Phase 2 tender admin UI and Phase 3 (Tender → RFQ CRM hook).

## Summary

Unify the currently-fragmented customer information (scattered across `Order`, `RfqSubmission`, `LeadSubmission`, and partial `ORG#` hooks in `intelligenceTable`) into a single **Organization** entity. Each Organization is identified by its email eTLD+1 domain. New submissions auto-create Organizations, and a one-time backfill script processes historical RFQ/Order/Lead data. AI (Bedrock Claude Haiku, reusing the `classify-org` pattern) populates `displayName`, `type`, `country`, and `industry` asynchronously after creation.

This spec produces:
- A new `Organization` customType layered onto the existing `intelligenceTable` via key prefixes
- A new `organization-api` Lambda that serves both admin AppSync resolvers and internal upsert/classify operations
- Modifications to three existing Lambdas (`submit-rfq`, `submit-lead`, `convert-rfq-to-order`) to invoke the new upsert path
- An idempotent backfill script for historical data
- Two admin pages: `/admin/organizations` (list) and `/admin/organizations/:orgId` (detail)

## Non-goals

- ORG_STATUS_LOG audit entity (admin status changes overwrite, no history)
- Manual create / merge / delete Organizations via admin UI
- Tender → Organization matching (Phase D scope)
- Contact entity for per-person tracking (Phase D or E)
- Multilingual `displayName` translations
- Cron-based periodic reclassification (admin can manually reclassify; bulk reruns via backfill mode)
- Visitor (`orgClassificationTable`) → Customer Organization automatic merging — visitor analytics stays separate
- Email validation beyond what Zod already provides in callers

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | Customer-facing Organizations only; visitor IP-based classification (`orgClassificationTable`) stays separate |
| Identity key | eTLD+1 domain (e.g. `mit.edu`, `tsinghua.edu.cn`, `ox.ac.uk`) via `tldts` library |
| Lifecycle | Auto-create on submission + one-time backfill of historical RFQ/Order/Lead |
| Field categories | Identity + aliases, classification, activity aggregates, management state + contact counts |
| Classification | AI auto (Bedrock Haiku → Anthropic API fallback, same pattern as `classify-org` / `match-with-llm`) |
| AI execution timing | Asynchronous `Lambda.invoke` triggered after sync upsert |
| Admin UI scope | List + Detail; no merge tool, no manual create, no status log |
| Free-mail domain handling | Skip entirely; `matchedOrgId` stays null |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Customer-facing forms                                              │
│  /request-quote  →  submit-rfq      ┐                              │
│  /lead-form      →  submit-lead     │ sync upsert (Lambda.invoke)  │
│  /admin/orders   →  convert-rfq-to-order ┘                         │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ organization-api Lambda                                            │
│   Action: upsertFromSubmission                                     │
│     - Extract eTLD+1, skip free-mail                               │
│     - GetItem / PutItem ORG#<id>/META                              │
│     - PutItem ORG_DOMAIN_LOOKUP (alias index)                      │
│     - Returns matchedOrgId for caller to write back                │
│     - Triggers async classifyOrg (Lambda.invoke Event)             │
│                                                                    │
│   Action: classifyOrg                                              │
│     - GetItem Org                                                  │
│     - Bedrock Haiku prompt → JSON {displayName, type, country, ...}│
│     - Anthropic API fallback on Bedrock failure                    │
│     - UpdateItem with classification + GSI1PK rewrite              │
│                                                                    │
│   AppSync fieldName: listOrganizations / getOrganization /         │
│                      updateOrganizationStatus /                    │
│                      updateOrganizationOwner /                     │
│                      reclassifyOrganization                        │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ intelligenceTable (shared single-table)                            │
│   ORG#<orgId>/META                  organization metadata          │
│   ORG_DOMAIN_LOOKUP/DOMAIN#<d>     alias-to-orgId index            │
│   RFQ/Order/Lead items (existing): GSI2PK=ORG#<orgId>              │
└────────────────────────────────────────────────────────────────────┘
                              ▲
┌────────────────────────────────────────────────────────────────────┐
│ Admin browser                                                      │
│   /admin/organizations         List page (table)                   │
│   /admin/organizations/:orgId  Detail page (two-column + timeline) │
└────────────────────────────────────────────────────────────────────┘
```

## eTLD+1 normalization

The "effective TLD plus one" extracts the organization-level domain, correctly handling compound TLDs (`.edu.cn`, `.ac.uk`, `.co.jp`).

```typescript
// amplify/lib/organization/etld.ts
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
    orgId: string | null;            // null if free-mail or invalid email
    domain: string;                  // the raw post-@ domain (e.g. 'cs.mit.edu')
    isFreeMailDomain: boolean;
}

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

**Edge cases not handled** (acceptable for the target customer segment):
- RFC 5321 quoted-string local parts like `"harvey@ninescrolls"@stanford.edu`. The first `@` belongs to the quoted region but our `indexOf('@')` treats it as the domain separator, yielding a wrong domain extraction. Practical impact: vanishingly rare in university/corporate procurement emails; the wrong extraction may return a free-mail-like result (no Org created) or null. No code attempts to remediate.
- Internationalized domain names (IDN, punycode like `xn--...`) — `tldts` handles these correctly, but emails using raw Unicode TLDs (e.g. `info@example.中国`) pass through `tldts` and may produce unexpected results. Track via the `event: 'org.upsert.no-etld'` warning log when `getDomain` returns null on a non-empty domain.

Tests cover: `harvey@stanford.edu` → `stanford.edu`; `lab@media.mit.edu` → `mit.edu`; `proc@tsinghua.edu.cn` → `tsinghua.edu.cn`; `info@chem.ox.ac.uk` → `ox.ac.uk`; `harvey@gmail.com` → null (free-mail); `not-an-email` → null; trailing `@` → null.

## Data model (intelligenceTable single-table additions)

### Entity 1: Organization metadata

```
PK = ORG#<orgId>             // e.g. ORG#stanford.edu
SK = META
GSI1PK = ORG_TYPE#<type>     // university | research-institute | company | government | other | unknown
GSI1SK = <invertedActivityToken>#<orgId>
                              // lex ASC = newest first (inverted ISO datetime)
GSI2PK = ORG_DOMAIN#<primaryDomain>  // for matchOrg lookup (current half-implementation)
GSI2SK = ORG
GSI3PK = ORG_LEAD_SCORE      // sparse — only set when leadScore >= 10
GSI3SK = <invertedScoreToken>#<orgId>
```

| Attribute | Type | Maintained by |
|---|---|---|
| `orgId` | string | Initial PutItem |
| `entityType` | const `ORGANIZATION` | Initial |
| `primaryDomain` | string | Initial (the first domain seen) |
| `aliasDomains` | string[] | upsert appends new alias domains |
| `displayName` | string | AI classify (fallback = orgId) |
| `type` | enum `university` / `research-institute` / `company` / `government` / `other` / `unknown` | AI; default `unknown` |
| `country` | string (ISO 3166-1 alpha-2) | AI; default null |
| `industry` | string? | AI; default null |
| `aiClassifiedAt` | ISO datetime? | AI |
| `aiProvider` | `bedrock` / `anthropic` / `manual` / null | AI |
| `leadScore` | number (0+) | upsert `ADD leadScore :delta` |
| `hasActiveInquiry` | boolean | upsert sets to true on RFQ/Lead submission. Never automatically cleared in Phase C. (Phase E may clear it on RFQ close / order won-lost transitions.) |
| `rfqCount` / `orderCount` / `leadCount` | numbers | upsert `ADD :one` per source |
| `totalOrderValueUSD` | number | upsert order path |
| `firstSeenAt` | ISO datetime | Initial |
| `lastActivityAt` | ISO datetime | upsert refreshes every call |
| `latestRFQDate` / `latestOrderDate` / `latestLeadDate` | dates | source-specific |
| `status` | `active` / `archived` / `blocked` | Admin (default `active`) |
| `adminNotes` | string? | Admin |
| `tags` | string[] | Admin |
| `ownerSalesRep` | string? (email) | Admin |
| `contactCount` | number | computed as `rfqCount + leadCount` |
| `primaryContactEmail` | string? | First submitter's email |
| `createdAt` / `updatedAt` | datetime | standard |

### Entity 2: Domain alias lookup

One lookup item per `(orgId, domain)` pair, so `matchOrg` can resolve any alias to the canonical orgId via GSI2 in one query:

```
PK = ORG_DOMAIN_LOOKUP
SK = DOMAIN#<aliasDomain>            // e.g. DOMAIN#cs.stanford.edu
GSI2PK = ORG_DOMAIN#<aliasDomain>
GSI2SK = ORG
orgId: string                         // canonical orgId
entityType: 'ORG_DOMAIN_LOOKUP'
createdAt: ISO datetime
```

When `submit-rfq` sees `lab@media.mit.edu`:
1. Extract `domain = 'media.mit.edu'`, `orgId = 'mit.edu'`
2. Query GSI2 with `GSI2PK = ORG_DOMAIN#media.mit.edu` — if hit, use that lookup's `orgId`
3. If no hit, the canonical Org may still exist under `mit.edu`. Try GetItem `PK=ORG#mit.edu/META`
4. If Org exists, write alias lookup; if not, create Org then write alias lookup

**GSI2 collision note**: both the Organization META item and the alias lookup items live in GSI2. A query `GSI2PK = ORG_DOMAIN#mit.edu` will return *both* the META item (if `mit.edu` is the canonical primaryDomain) *and* the alias lookup item if one exists for the same domain. Code that resolves domain → orgId via this GSI must filter by `entityType` attribute (`ORGANIZATION` for the META item, `ORG_DOMAIN_LOOKUP` for the alias item) and prefer the lookup item if both exist. In practice the alias lookup item is preferred because it carries the explicit `orgId` field.

### Index usage

| Query | Index | KeyConditionExpression |
|---|---|---|
| Match domain → orgId (submit-rfq matchOrg) | GSI2 | `GSI2PK = ORG_DOMAIN#<domain>` |
| Admin default list, by type + recent activity | GSI1 | `GSI1PK = ORG_TYPE#<type>` |
| Admin "high lead score" list | GSI3 | `GSI3PK = ORG_LEAD_SCORE` |
| Org timeline (RFQs/Orders/Leads for this Org) | GSI2 on existing entities | `GSI2PK = ORG#<orgId>` |

The fourth row reuses the existing `GSI2PK = ORG#<id>` pattern that `submit-rfq` and `convert-rfq-to-order` already write to. No schema change needed for the timeline.

## `organization-api` Lambda

New Lambda under `amplify/functions/organization-api/`. Follows existing project conventions (`order-api`, `tender-api`).

```
amplify/functions/organization-api/
    handler.ts
    handler.test.ts
    resource.ts
    package.json
```

### Handler structure

```typescript
import type { AppSyncResolverEvent } from 'aws-lambda';

type DirectInvokePayload = {
    action: 'upsertFromSubmission' | 'classifyOrg';
    // ...payload depending on action
};

export async function handler(event: AppSyncResolverEvent<any> | DirectInvokePayload) {
    // Path 1: invoked by another Lambda via AWS Lambda.invoke
    if ('action' in event) {
        switch (event.action) {
            case 'upsertFromSubmission': return upsertOrg(event);
            case 'classifyOrg':          return classifyOrgWithAi(event);
        }
    }
    // Path 2: invoked by AppSync as admin resolver
    requireAdmin(event);
    const identity = (event.identity as any)?.username ?? 'unknown';
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    switch (fieldName) {
        case 'listOrganizations':        return listOrgs(event.arguments);
        case 'getOrganization':          return getOrg(event.arguments);
        case 'updateOrganizationStatus': return updateOrgStatus(event.arguments, identity);
        case 'updateOrganizationOwner':  return updateOrgOwner(event.arguments, identity);
        case 'reclassifyOrganization':   return reclassifyOrg(event.arguments);
        default: throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}

function requireAdmin(event: AppSyncResolverEvent<any>) {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes('admin')) {
        throw new Error('Unauthorized: admin group required');
    }
}
```

**Shared constants** (defined in `amplify/lib/organization/constants.ts`):

```typescript
export const ALIAS_DOMAINS_CAP = 100;         // max aliasDomains per Organization
export const LEAD_SCORE_THRESHOLD = 10;       // GSI3 sparse index threshold
export const RECLASSIFY_COOLDOWN_DAYS = 30;   // reclassifyOrganization no-op window
export const BEDROCK_TIMEOUT_MS = 8000;       // mirrors match-with-llm
export const ANTHROPIC_TIMEOUT_MS = 20000;    // mirrors match-with-llm
```

### Operation: `upsertFromSubmission`

Called synchronously by `submit-rfq`, `submit-lead`, `convert-rfq-to-order`.

**Input**:
```typescript
{
    action: 'upsertFromSubmission',
    source: 'rfq' | 'lead' | 'order',
    email: string,
    institution?: string,
    submittedAt: string,
    scoreDelta: number,
    orderValueUSD?: number,        // only for source='order'
    isInitial?: boolean,           // diagnostic flag
}
```

**Output**:
```typescript
{ matchedOrgId: string | null }
```

**Logic**:
1. `classifyEmailDomain(email)` → `{ orgId, domain, isFreeMailDomain }`
2. If `orgId === null` (free-mail or invalid): return `{ matchedOrgId: null }` immediately
3. Query GSI2 for `ORG_DOMAIN#<domain>` to find a pre-existing alias lookup; if hit, set `canonicalOrgId = lookup.orgId`. Otherwise `canonicalOrgId = orgId`.
4. **Try to create the Org with `PutItem` + `attribute_not_exists(PK)` ConditionExpression**:
   - Item fields: firstSeenAt=now, lastActivityAt=now, leadScore=scoreDelta, primaryDomain=domain, displayName=canonicalOrgId (fallback until classify), type='unknown', primaryContactEmail=email, source-specific count=1 (rfqCount or leadCount or orderCount), status='active'. Set GSI1PK = `ORG_TYPE#unknown` and GSI1SK = `<invertedToken(now)>#<canonicalOrgId>`. If `scoreDelta >= 10`, also set GSI3PK + GSI3SK.
   - **On PutItem success (this Lambda invocation created the Org)**: proceed to step 5 to write the alias lookup if needed; then async-invoke classifyOrg; return `{matchedOrgId: canonicalOrgId}`.
   - **On `ConditionalCheckFailedException` (the Org already exists, either pre-existing or created by a concurrent invocation in a race)**: proceed to step 6 to perform the update path.
5. **Alias lookup write (for new Orgs only)**: if `domain !== canonicalOrgId`, attempt PutItem `ORG_DOMAIN_LOOKUP/DOMAIN#<domain>` with `attribute_not_exists(PK)`. On success, also UpdateItem the META item to append `domain` to `aliasDomains` (only if `aliasDomains.length < ALIAS_DOMAINS_CAP`; see step 7 cap enforcement). On `ConditionalCheckFailedException`, skip both — another invocation already created this alias. After alias work, async-invoke `Lambda.invoke(self, { action: 'classifyOrg', orgId: canonicalOrgId, institution })` with `InvocationType: 'Event'`; return `{matchedOrgId: canonicalOrgId}`.
6. **Update path (Org already exists)**:
   - UpdateItem the META item: `ADD leadScore :delta`, `ADD <source>Count :one`, `ADD totalOrderValueUSD :v` (only for source='order'), `SET hasActiveInquiry=true, latest<Source>Date=:submittedAt, lastActivityAt=:now, updatedAt=:now, GSI1SK=:newSk` (newSk = `<invertedToken(now)>#<canonicalOrgId>`).
   - **leadScore threshold check**: after the UpdateItem, if the returned new `leadScore` is `>= 10` and the previous value was `< 10`, perform a second UpdateItem to set GSI3PK = `ORG_LEAD_SCORE` + GSI3SK = `<invertedScoreToken>#<canonicalOrgId>`. If new score is `< 10` and previous was `>= 10` (only possible via negative scoreDelta, currently not used but supported), REMOVE GSI3PK + GSI3SK. Use `ReturnValues: 'UPDATED_NEW'` on the first UpdateItem to read the new score; gate the second UpdateItem on the threshold crossing.
   - **Alias handling**: if `domain` was extracted but is not already in `aliasDomains` (check via the alias lookup PutItem path described in step 5, with `attribute_not_exists(PK)` gating), do the alias PutItem + array append. Cap enforcement in step 7.
   - **Contact count maintenance**: `contactCount` is derived from `rfqCount + leadCount + orderCount`. Update it in the same UpdateItem expression to keep it in sync: `SET contactCount = if_not_exists(rfqCount, :zero) + if_not_exists(leadCount, :zero) + if_not_exists(orderCount, :zero) + :one` (the `+ :one` represents the contribution from this submission, which the `ADD` clause has not yet been visible to in the same operation; alternatively, recompute on the next read).
   - Return `{matchedOrgId: canonicalOrgId}`.
7. **`aliasDomains` cap enforcement (applies to steps 5 and 6 array-append)**: before `list_append`, GetItem the current `aliasDomains` length. If `>= ALIAS_DOMAINS_CAP` (constant = 100), log a warning (`event: 'org.alias.cap-exceeded'`, orgId, droppedDomain) and skip the append. The alias lookup PutItem can still be written so that GSI2 lookups continue to resolve, even when the array array cannot reflect the new alias.

### Operation: `classifyOrg`

Invoked asynchronously (fire-and-forget) after a new Org is created, or explicitly via admin `reclassifyOrganization` mutation.

**Input**:
```typescript
{ action: 'classifyOrg', orgId: string, institution?: string }
```

**Logic**:
1. GetItem the Org. If absent (race), log warning and return.
2. Build prompt:
   ```
   Classify this customer organization. Output JSON only.

   Schema:
   {
     "displayName": string,     // human-readable, prefer institution name if provided
     "type": string,            // one of: university, research-institute, company, government, other
     "country": string,         // ISO 3166-1 alpha-2 code
     "industry": string | null  // short noun phrase or null
   }

   Inputs:
   - Domain: <orgId>
   - Institution name provided: "<institution or 'none'>"
   ```
3. Bedrock Claude Haiku invoke with `BEDROCK_TIMEOUT_MS = 8000`. On failure, Anthropic API fallback with `ANTHROPIC_TIMEOUT_MS = 20000`. Both follow the `match-with-llm` pattern verbatim.
4. Parse JSON, strip markdown fences if present (`parseLlmJson` pattern from `match-with-llm`).
5. UpdateItem: set `displayName, type, country, industry, aiClassifiedAt=now, aiProvider`. Also update `GSI1PK` to `ORG_TYPE#<newType>` (this is the critical re-indexing — same pattern as tender's score-driven GSI1SK refresh).
6. On both providers failing: log error, leave Org as `type='unknown'`, do not throw (this is a fire-and-forget call).

### Operation: `listOrganizations` (admin AppSync query)

**Arguments**:
```typescript
{
    statuses?: string[],        // default ['active']
    types?: string[],
    countries?: string[],
    ownerSalesRep?: string,
    minLeadScore?: number,
    search?: string,            // matches displayName + primaryDomain substring
    sortBy?: 'activity' | 'leadScore' | 'firstSeen',  // default 'activity'
    sortDir?: 'asc' | 'desc',   // default 'desc'
    limit?: number,             // default 25
    nextToken?: string,
}
```

**Logic**:
- `sortBy='activity'`: fan-out `Query GSI1 WHERE GSI1PK=ORG_TYPE#<type>` for each requested type; in-memory merge by GSI1SK (already inverted-activity-sorted).
- `sortBy='leadScore'`: `Query GSI3 WHERE GSI3PK=ORG_LEAD_SCORE`.
- `sortBy='firstSeen'`: scan `intelligenceTable` with `FilterExpression: entityType = :org`. As `intelligenceTable` grows (Phase 1 tender pipeline writes ~100 new TENDER items/day), this Scan reads progressively more pages. At ~30k total table items, a Scan with filter still completes in <5s but reads ~5MB of table data per request. **Scaling escape valve**: if this becomes too slow, add a sparse GSI keyed by `firstSeenAt` for `entityType = ORGANIZATION` items, or fall back to a dedicated `ORG_FIRST_SEEN` GSI4 keyed by `firstSeenAt` only on Org items. Decision deferred until measured pain.
- After GSI/Scan: apply `country / ownerSalesRep / minLeadScore / search` in-memory.
- Paginate by cursor.

### Operation: `getOrganization`

**`getOrganization`**:

Arguments: `{ orgId: string }`

Returns `OrganizationDetailBundle = { organization, recentRfqs, recentOrders, recentLeads, recentTenders: [] }`.

Logic:
1. GetItem the Org META: `PK = ORG#<orgId>, SK = META`. If absent, throw `404: organization not found`.
2. Single Query against GSI2 with `KeyConditionExpression: GSI2PK = :pk` where `:pk = ORG#<orgId>`. This returns all RFQ, Order, Lead items whose GSI2PK references this Org. Limit 80 (sized to give ~20 each for 4 entity types).
3. Group results in-memory by `entityType` attribute: collect into `recentRfqs`, `recentOrders`, `recentLeads`. Sort each by the corresponding date attribute (`submittedAt` / `quoteDate` / `submittedAt`) descending, cap at 20.
4. `recentTenders` is unconditionally `[]` in Phase C — Tender → Organization matching is Phase D scope.
5. Return the assembled bundle.

The single GSI2 query is more efficient than four parallel queries with begins_with filters; entity discrimination is done in-memory.

### Operation: `updateOrganizationStatus`

**`updateOrganizationStatus`**:

Arguments: `{ orgId, status: 'active'|'archived'|'blocked', adminNotes?, tags? }`

UpdateItem to set `status`, `adminNotes` (if provided), `tags` (if provided), `updatedAt`. No log entity (per non-goals). Status validation: must be one of the three values; reject otherwise with `400: invalid status`.

### Operation: `updateOrganizationOwner`

**Arguments**: `{ orgId, ownerSalesRep?: string }`

UpdateItem to set ownerSalesRep. Null clears the field. No log.

### Operation: `reclassifyOrganization`

**Arguments**: `{ orgId, force?: boolean }`

Calls the internal `classifyOrg` action directly. `force=false` and Org already has `aiClassifiedAt` within last RECLASSIFY_COOLDOWN_DAYS days (30): no-op return existing. `force=true`: always re-invoke Bedrock.

### IAM and environment

- DDB read/write on `intelligenceTable`
- `bedrock:InvokeModel` (same model + region as `classify-org` / `match-with-llm`)
- `lambda:InvokeFunction` on self (for fire-and-forget classify)
- `INTELLIGENCE_TABLE`, `BEDROCK_MODEL_ID`, `CLAUDE_MODEL` env injected by `backend.ts`
- `ANTHROPIC_API_KEY` Amplify secret

The Lambda for `submit-rfq`, `submit-lead`, `convert-rfq-to-order` each need `lambda:InvokeFunction` granted on `organization-api`.

### Authorization pattern

All five admin AppSync operations are declared with `allow.authenticated()` — any authenticated Cognito user can call them at the schema level. Defense-in-depth is enforced at the Lambda layer via `requireAdmin` which checks `event.identity.groups.includes('admin')`.

This matches the existing project-wide pattern (e.g. `listRfqs`, `listLeads`, `convertRfqToOrder` all use the same combination). It is not a Phase C regression. The implication: a non-admin authenticated user who bypasses our admin UI (e.g. raw GraphQL call with a valid Cognito token) hits the Lambda and is rejected with `Unauthorized: admin group required`. Schema-level admin enforcement would require introducing custom Cognito group claims in the AppSync auth resolver, which is out of scope for Phase C.

### `amplify/backend.ts` wiring

In `backend.ts`, after the `organizationApi` import and the `defineBackend({ ..., organizationApi })` registration:

```typescript
intelligenceTable.grantReadWriteData(backend.organizationApi.resources.lambda);
backend.organizationApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Bedrock IAM (mirrors classify-org / match-with-llm)
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

// Allow submit-rfq, submit-lead, convert-rfq-to-order to invoke organization-api
[backend.submitRfq, backend.submitLead, backend.convertRfqToOrder].forEach((fn) => {
    fn.resources.lambda.addToRolePolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [backend.organizationApi.resources.lambda.functionArn],
    }));
    fn.addEnvironment('ORGANIZATION_API_FUNCTION_NAME', backend.organizationApi.resources.lambda.functionName);
});
```

This mirrors the existing pattern used to wire `classifyOrg` invocation from `serverTrack` (see `amplify/backend.ts` lines ~165-180).

### Tests

`handler.test.ts` covers:
- `upsertFromSubmission`: new Org path (PutItem + alias + async classify invoke); existing Org path (UpdateItem + maybe new alias); free-mail returns `{matchedOrgId: null}` without DDB write
- `classifyOrg`: Bedrock success path; Bedrock failure → Anthropic fallback; both providers fail → log + return without UpdateItem
- AppSync resolvers: each fieldName happy path + `requireAdmin` rejection
- Edge cases: `aliasDomains` duplicate prevention, `GSI3PK` set/clear at score=10 threshold

## Modifications to existing Lambdas

### `submit-rfq/handler.ts`

Replace the existing dead `matchOrg` + `updateLeadScore` block with a call to `invokeOrganizationApi`:

```typescript
// AFTER the RFQ is successfully written to DDB:
const orgResult = await invokeOrganizationApi({
    action: 'upsertFromSubmission',
    source: 'rfq',
    email: data.email,
    institution: data.institution,
    submittedAt: now,
    scoreDelta: computeRfqScore(data),
}).catch((err) => {
    console.error('Organization upsert failed:', err);
    return { matchedOrgId: null };
});

if (orgResult.matchedOrgId) {
    await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
        UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
        ExpressionAttributeValues: {
            ':id': orgResult.matchedOrgId,
            ':gsi2': `ORG#${orgResult.matchedOrgId}`,
        },
    }));
}
```

**Timing of `GSI2PK` write**: the existing dead-code path wrote `GSI2PK` in the initial RFQ PutCommand (with always-null `matchedOrgId` resulting in no `GSI2PK` value, so the field was effectively unset). The new code path writes `GSI2PK` in a follow-up UpdateCommand after `invokeOrganizationApi` resolves. Between the initial PutCommand and the UpdateCommand there is a brief window (typically <500ms) where the RFQ exists without `GSI2PK`. Admin queries against `GSI2PK = ORG#<orgId>` during that window would not find this RFQ. The practical impact is negligible (admin loads list rarely during user submission), but is noted for completeness.

`invokeOrganizationApi` is a helper module `amplify/lib/organization/invoke-org-api.ts` that wraps `LambdaClient.invoke` with `InvocationType: 'RequestResponse'`, timeout 5000ms, and returns parsed payload. On any error, throws — caller catches.

`computeRfqScore` (and siblings `computeLeadScore`, `computeOrderScore`) live in `amplify/lib/organization/lead-score.ts` so all callers share the same scoring logic.

Delete the old `matchOrg` and `updateLeadScore` functions.

### `submit-lead/handler.ts`

`submit-lead` handles three discriminated lead types: `contact`, `download_gate`, `newsletter`.

- **`contact` and `download_gate`**: both have `email` and may have `organization` (institution-name-like). After writing the Lead item, call `invokeOrganizationApi({source: 'lead', email, institution: data.organization, submittedAt, scoreDelta: computeLeadScore(data)})`. If `matchedOrgId` returned, UpdateItem the Lead to set `matchedOrgId + GSI2PK = ORG#<orgId>`.
- **`newsletter`**: has only `email` (no `organization` field on the schema). Call `invokeOrganizationApi({source: 'lead', email, institution: undefined, submittedAt, scoreDelta: computeLeadScore(data)})`. Free-mail domains are skipped by the upsert (most newsletter signups), so most newsletter leads will not create Orgs. Corporate newsletter signups (e.g. someone subscribing with `info@amat.com`) will create or update the Org.

### `convert-rfq-to-order/handler.ts`

Order conversion always has a `matchedOrgId` from the underlying RFQ. After writing the Order, call `invokeOrganizationApi` with `source: 'order', orderValueUSD: order.quoteAmount` to increment `orderCount`, add to `totalOrderValueUSD`, refresh `lastActivityAt`, and bump `leadScore` by `computeOrderScore(order.quoteAmount)`.

If for some reason the RFQ had `matchedOrgId=null` (e.g. free-mail submitter), the conversion still passes `email: order.contacts[0].email` and the new upsert logic re-evaluates. This is a self-healing path.

### Failure semantics

`invokeOrganizationApi` failures are logged and swallowed by the caller. The user-facing submission still succeeds; `matchedOrgId` stays null on the source item. The next submission from the same email triggers another attempt (no permanent failure state).

## Backfill script

`scripts/backfill-organizations.ts`:

```typescript
// One-time idempotent script. Run with --dry-run first.
//
// 1. Scan intelligenceTable for entityType IN (RFQ, ORDER, LEAD). Filter on entityType
//    server-side to reduce read costs.
// 2. Group items by submitter email's eTLD+1 (via classifyEmailDomain); skip free-mail domains.
// 3. For each group:
//    a. Compute aggregates: source-specific counts (rfqCount, orderCount, leadCount), sum of
//       order values (totalOrderValueUSD), earliest firstSeenAt, latest lastActivityAt, sum of
//       computeRfqScore / computeLeadScore / computeOrderScore results as the initial leadScore.
//    b. PutItem ORG#<id>/META with ConditionExpression: attribute_not_exists(PK) — skips if Org
//       already exists.
//    c. PutItem ORG_DOMAIN_LOOKUP/DOMAIN#<d> for each unique domain in the group (also
//       attribute_not_exists).
//    d. UpdateItem each source RFQ/Order/Lead item to set matchedOrgId + GSI2PK = ORG#<canonicalOrgId>.
//    e. Order repair sub-step: for each updated RFQ, if its linkedOrderId is non-empty, also
//       fetch the Order and UpdateItem its matchedOrgId + GSI2PK to match the RFQ's resolved Org.
//       Historical orders were created by convert-rfq-to-order with matchedOrgId: rfq.matchedOrgId || ''
//       — empty string because the dead matchOrg always returned null. Without this repair,
//       historical converted Orders will not surface in the Org's timeline.
//    f. Async Lambda.invoke organization-api with action='classifyOrg' for each new Org
//       (batches of 10, 100ms throttle between batches).
// 4. Log summary: { orgsCreated, orgsExisting, rfqsBackfilled, ordersBackfilled, ordersRepaired,
//    leadsBackfilled, freeMailSkipped, errors }.
//
// Modes:
//   --dry-run         Print all planned writes, do not execute.
//   --classify-only   Skip Org creation, only trigger classify for existing Orgs missing aiClassifiedAt.
```

Idempotent because every write uses `attribute_not_exists` ConditionExpression. Rerunning is safe.

Throttle BatchWriteCommand to 50ms sleep per batch to keep DDB write capacity comfortable.

## Admin UI

Two pages, matches existing admin patterns (`OrderListPage`, `RFQListPage`, `TenderListPage`).

### `/admin/organizations` — List page

- KPI cards: `Total active`, `High lead score (≥50)`, `New this week`, `Without owner`
- Filter bar: search (displayName / primaryDomain), type multi-select, country multi-select, status, owner, min lead score, sort selector (activity / leadScore / firstSeen)
- Table columns: displayName (link), primaryDomain, type chip, country flag+code, leadScore progress bar, lastActivityAt relative time, status chip, ownerSalesRep
- 25/page pagination, server cursor
- URL state sync (matches tender admin pattern)
- Filter pills update URL query params

### `/admin/organizations/:orgId` — Detail page

Two-column layout:

**Left sticky panel** (240px):
- `displayName` (h2) + primaryDomain
- Type chip + country flag
- Lead score progress bar + numeric
- Status dropdown (active / archived / blocked)
- Owner sales rep dropdown
- Quick actions: `Reclassify with AI` button (calls `reclassifyOrganization` mutation; `force=false` first, button text becomes "Force reclassify" on hover-with-modifier or admin can call it again with `force=true` via menu)
- Metadata: firstSeenAt, lastActivityAt, aiClassifiedAt + provider, aliasDomains chip list

**Right scrolling content**:
- Aggregate cards: `rfqCount`, `orderCount`, `leadCount`, `totalOrderValueUSD` formatted
- Activity timeline with 4 tabs (RFQs / Orders / Leads / Tenders):
  - Each tab lists most-recent 20 entries from the corresponding entity sorted by date desc
  - Row format: `<date> <type chip> <title/summary> <amount?> <→ link>`
  - Links to existing detail pages (`/admin/rfqs/<id>`, `/admin/orders/<id>`, etc.)
  - Tenders tab shows empty state for Phase C ("Tender → Organization matching arrives in Phase D")
- `Admin notes` textarea (auto-saves on blur via `updateOrganizationStatus` mutation, debounced 1s)
- `Tags` chip input (saves same way)

### Admin nav

`AdminLayout.tsx` `NAV_ITEMS` adds:

```typescript
{ path: '/admin/organizations', label: 'Organizations', icon: 'business' },
```

Position after `Leads` in the existing order. Final nav: Dashboard → Orders → RFQs → Leads → **Organizations** → Insights → Q&A → Analytics.

**Merge order with Phase 2**: Phase 2's `TenderListPage` adds a `Tenders` entry between `RFQs` and `Leads`. Phase C inserts `Organizations` after `Leads`. The final post-merge order is:

```typescript
Dashboard → Orders → RFQs → Tenders → Leads → Organizations → Insights → Q&A → Analytics
```

If Phase 2 merges first (expected), Phase C's PR adds only the `Organizations` line in the position above. If Phase C merges first, Phase 2's PR adds `Tenders` between `RFQs` and `Leads`. Either ordering avoids a merge conflict because each PR only adds an array entry.

### Frontend file inventory

```
src/pages/admin/
    OrganizationListPage.tsx
    OrganizationDetailPage.tsx
src/components/admin/
    OrganizationTable.tsx
    OrganizationFilterBar.tsx
    OrganizationKpiCards.tsx
    OrganizationHeaderPanel.tsx
    OrganizationTimeline.tsx
src/hooks/
    useOrganizations.ts
    useOrganization.ts
src/services/
    organizationAdminService.ts
```

## Amplify schema additions

Added to `amplify/data/resource.ts`:

```typescript
Organization: a.customType({
    orgId: a.id().required(),
    primaryDomain: a.string().required(),
    aliasDomains: a.string().array(),
    displayName: a.string(),
    type: a.string(),                          // unknown by default
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
    recentTenders: a.json(),                   // [] in Phase C; expanded in Phase D
}),

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

## Testing

### Lambda tests

Each handler case gets a vitest unit:
- `upsertFromSubmission` — new Org, existing Org, free-mail skip, new alias path
- `classifyOrg` — Bedrock success, Anthropic fallback, both-fail no-throw
- AppSync resolvers — happy path each + `requireAdmin` rejection
- `submit-rfq/handler.test.ts` — extend with `invokeOrganizationApi` mock; verify RFQ matchedOrgId backfill on success; verify RFQ submission still succeeds when org API errors
- `submit-lead/handler.test.ts` and `convert-rfq-to-order/handler.test.ts` — analogous

### Shared lib tests

- `etld.test.ts` — eTLD+1 normalization, compound TLDs, subdomain stripping, free-mail detection, invalid email handling
- `lead-score.test.ts` — score function boundaries

### Frontend tests

- `OrganizationTable.test.tsx` — sort + filter rendering
- `OrganizationFilterBar.test.tsx` — URL state sync
- `OrganizationDetailPage.test.tsx` — timeline tabs, reclassify button

### Manual QA checklist

- Submit a new RFQ with `harvey@stanford.edu` → verify Org created within seconds with `type='unknown'`, classified within ~10s
- Submit a second RFQ from same domain → verify `leadScore` accumulates, `rfqCount=2`, no new Org
- Submit from `harvey@gmail.com` → no Org created, RFQ has `matchedOrgId=null`
- Backfill dry-run on prod data → review output before live run
- Backfill live run → verify ~N Orgs created, historical RFQ/Order/Lead updated with `matchedOrgId`
- Admin UI: filter by country `US`, sort by leadScore → verify high-value US orgs surface first

## Implementation phases

| Sub-task | Estimated | Depends on |
|---|---|---|
| 1. Shared library: `etld.ts`, `lead-score.ts`, `free-mail-domains.ts` + tests | 0.5d | — |
| 2. Amplify schema additions (customType, queries, mutations) | 0.3d | 1 |
| 3. `organization-api` Lambda + 7 handler cases + tests | 2.0d | 1, 2 |
| 4. Modify `submit-rfq` / `submit-lead` / `convert-rfq-to-order` + tests | 1.0d | 3 |
| 5. Backfill script + dry-run + idempotency tests | 0.7d | 3, 4 |
| 6. Frontend service + hooks + List page | 1.5d | 2, 3 |
| 7. Detail page + timeline tabs + admin mutations wired | 1.5d | 6 |
| 8. Nav integration + manual QA + adjustments | 0.5d | all |
| **Total** | **~8 days** | |

## Risks

1. **`tldts` PSL staleness** — `getDomain` reads from Public Suffix List embedded at package version. New TLDs may not be recognized. Mitigation: pin to latest version; CI periodically updates dependency.

2. **AI classification quality at the long tail** — `smallcorp.io` or obscure foreign universities may receive `type='unknown'` or wrong `country`. Mitigation: admin can manually edit fields; track `type='unknown'` ratio as a quality metric.

3. **Backfill write throughput** — Hundreds to thousands of UpdateCommands in a short window. Mitigation: BatchWriteItem in 25-row batches; 50ms sleep between batches; PAY_PER_REQUEST auto-scales DDB; monitor `ConsumedWriteCapacity` metric.

4. **`aliasDomains` array unbounded growth** — Edge case: a misconfigured PSL or buggy upsert could append the same domain hundreds of times. Mitigation: `attribute_not_exists` ConditionExpression on the separate `ORG_DOMAIN_LOOKUP` item ensures we only append to the main `aliasDomains` array when we successfully added the new lookup; also cap `aliasDomains.length` at 100 in the upsert path (log + skip append above the cap).

5. **`submit-rfq` extra latency from sync Lambda invoke** — Adds ~200-500ms to the user-facing request path. Mitigation: `organization-api` Lambda uses Provisioned Concurrency = 1 (no cold start); 5s hard timeout; on any failure or timeout, `submit-rfq` proceeds with `matchedOrgId=null` and logs. If observed latency consistently exceeds 1s for a week, switch upsert to also async (sacrifices immediate matchedOrgId backfill on the source item).

6. **Cross-Lambda IAM grants** — `submit-rfq`, `submit-lead`, `convert-rfq-to-order` need `lambda:InvokeFunction` on `organization-api`. Mitigation: explicit IAM grants in `backend.ts`; test in sandbox before prod merge.

7. **`type` change triggers GSI1PK rewrite** — The reclassify mutation can move an Org from `ORG_TYPE#unknown` to `ORG_TYPE#university`, requiring GSI1PK update. Mitigation: `classifyOrg` UpdateItem builds both the new GSI1PK and GSI1SK in one expression, matching the Phase 1 `classify-and-store` pattern for tender scoring.

8. **Race condition on first submission** — If two RFQ submissions from the same brand-new domain arrive within milliseconds, both Lambda invocations may try to PutItem the Org concurrently. Mitigation: PutItem uses `attribute_not_exists(PK)` ConditionExpression; the second invocation falls through the `ConditionalCheckFailedException` catch block to the "Org exists, do update" path.

## Cost estimate (monthly)

| Item | Usage | Cost |
|---|---|---|
| `organization-api` Lambda invocations | ~20 user submissions/day × 30 + admin ops ≈ 700/month | $0 (free tier) |
| Bedrock Haiku classify | ~20 new Orgs/month × ~1500 tokens × $0.002 | <$0.10 |
| Provisioned Concurrency 1 (512 MB, organization-api) | 0.5 GB × 720 hours × $0.000004646/GB-s × 3600 s/h | ~$6.00 |
| Additional DDB read/write | A few thousand ops/month | <$0.10 |
| `tldts` bundle impact | +30KB gzipped | Negligible |
| **Phase C added cost** | | **~$6.50/month** |

Backfill is a one-time cost not included above; expected ~$1-2 of DDB write capacity for the full historical sweep.

**Note on Provisioned Concurrency cost**: the ~$6/month for PC=1 dominates the Phase C operational cost. The alternative is to drop PC and accept cold-start latency for `organization-api`. At current submission volume (~20/day), cold starts would affect maybe 1-2 user submissions per day — those see +1-2s added latency, which is recoverable via the `catch + matchedOrgId = null` failure path. **Decision to revisit before merge**: if cost matters more than 1-2 occasional slow submissions, drop PC; cost falls to <$0.30/month with no functional impact (just occasional cold-start latency that already fails gracefully).

## Out of scope (explicitly excluded)

- ORG_STATUS_LOG audit entity
- Manual create / merge / delete via admin UI
- Tender → Organization matching (Phase D)
- Contact entity (Phase D or E)
- Multilingual `displayName`
- Cron periodic reclassification
- Visitor → Customer Organization auto-merging (Market Intelligence stays separate)
- Email validation enhancements
- Free-mail domain admin editing UI (kept as code constant; admin must PR a change)
- E2E testing framework introduction
