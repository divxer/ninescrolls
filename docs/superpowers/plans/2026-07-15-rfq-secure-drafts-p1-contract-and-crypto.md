# RFQ Secure Drafts P1 — Contract & Credential Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, unit-testable foundation for RFQ secure drafts — the credential library (base64url codec, HKDF token derivation, non-enumerable ID, versioned peppered HMAC hash + constant-time verify) and the draft field whitelist schema — with no AWS or HTTP dependencies.

**Architecture:** Extend the import-free `contract.ts` with every enum shared by the frontend,
formal submission, and drafts; migrate the formal handler to consume those exports. Add two
modules under `amplify/lib/rfq/`: `draftCredentials.ts` owns all cryptography, while
`draftContract.ts` owns the strict draft whitelist and normalized set/remove update model.
Everything here is a pure function of its inputs; DynamoDB, HTTP, and secret retrieval live
in later plans (P2/P3).

**Tech Stack:** TypeScript, Node.js `crypto` (`hkdfSync`, `createHash`, `createHmac`, `timingSafeEqual`), Zod, Vitest.

---

## File Structure

- Create `amplify/lib/rfq/draftCredentials.ts` — credential codec, derivation, hashing, verification. No imports outside `node:crypto`.
- Create `amplify/lib/rfq/draftCredentials.test.ts` — unit tests for the above.
- Modify `amplify/lib/rfq/contract.ts` and `amplify/functions/submit-rfq/handler.ts` — make shared enums canonical and migrate the formal schema to them.
- Create `amplify/lib/rfq/draftContract.ts` — draft field whitelist Zod schema plus normalized set/remove patch operations, deriving from `contract.ts` and `limits.ts`.
- Create `amplify/lib/rfq/draftContract.test.ts` — schema tests.

The two new draft modules are leaves, so P1 changes no draft runtime behavior. The formal
handler's local enums are replaced with identical canonical exports; parity tests prove the
migration is behavior-preserving. P2 (storage) and P3 (API) import the draft modules.

**Test command for the whole plan:** `npx vitest run amplify/lib/rfq/ amplify/functions/submit-rfq/handler.test.ts --exclude '**/.claude/**'`

---

### Task 1: Credential codec — base64url of exactly 32 bytes

The nonce, draft token, and submit key are each exactly 32 random bytes, transported as
base64url-without-padding. A single codec validates length so a malformed credential is
rejected before any crypto runs.

**Files:**
- Create: `amplify/lib/rfq/draftCredentials.ts`
- Test: `amplify/lib/rfq/draftCredentials.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/draftCredentials.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encodeCredential,
  decodeCredential,
  InvalidCredentialError,
} from './draftCredentials';

describe('credential codec', () => {
  it('round-trips exactly 32 random bytes as unpadded base64url', () => {
    const bytes = crypto.randomBytes(32);
    const encoded = encodeCredential(bytes);
    expect(encoded).not.toMatch(/[+/=]/); // url-safe, no padding
    expect(decodeCredential(encoded).equals(bytes)).toBe(true);
  });

  it('rejects a credential that does not decode to 32 bytes', () => {
    const short = crypto.randomBytes(16).toString('base64url');
    expect(() => decodeCredential(short)).toThrow(InvalidCredentialError);
  });

  it('rejects raw values that are not exactly 32 bytes before encoding', () => {
    expect(() => encodeCredential(crypto.randomBytes(16))).toThrow(InvalidCredentialError);
    expect(() => encodeCredential(crypto.randomBytes(33))).toThrow(InvalidCredentialError);
  });

  it('rejects a credential with non-base64url characters', () => {
    expect(() => decodeCredential('not*valid*base64url')).toThrow(InvalidCredentialError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: FAIL — `Failed to resolve import "./draftCredentials"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/draftCredentials.ts
import crypto from 'node:crypto';

/** A credential (nonce / draft token / submit key) is exactly 32 random bytes. */
export const CREDENTIAL_BYTES = 32;

export class InvalidCredentialError extends Error {
  constructor(message = 'Invalid credential encoding') {
    super(message);
    this.name = 'InvalidCredentialError';
  }
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Encode raw bytes as base64url without padding. */
export function encodeCredential(bytes: Buffer): string {
  if (bytes.length !== CREDENTIAL_BYTES) {
    throw new InvalidCredentialError();
  }
  return bytes.toString('base64url');
}

/** Decode a base64url credential, requiring exactly CREDENTIAL_BYTES bytes. */
export function decodeCredential(value: string): Buffer {
  if (typeof value !== 'string' || !BASE64URL_RE.test(value)) {
    throw new InvalidCredentialError();
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== CREDENTIAL_BYTES) {
    throw new InvalidCredentialError();
  }
  return bytes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftCredentials.ts amplify/lib/rfq/draftCredentials.test.ts
git commit -m "feat(rfq-draft): base64url credential codec with 32-byte validation"
```

---

### Task 2: Deterministic draft token + non-enumerable ID derivation

From the client nonce, derive the bearer `draftToken` (HKDF-SHA-256) and the `rfqId`
(SHA-256), each with its own domain string. Both are deterministic — an identical create
retry yields the same token and ID — and neither depends on the rotating pepper.

**Files:**
- Modify: `amplify/lib/rfq/draftCredentials.ts`
- Test: `amplify/lib/rfq/draftCredentials.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/lib/rfq/draftCredentials.test.ts
import { deriveDraftToken, deriveDraftId } from './draftCredentials';

describe('draft token + id derivation', () => {
  const nonce = crypto.randomBytes(32);

  it('derives a 32-byte token deterministically from the nonce', () => {
    const a = deriveDraftToken(nonce);
    const b = deriveDraftToken(nonce);
    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);       // identical retry → identical token
    expect(a.equals(nonce)).toBe(false);  // token is not the nonce
  });

  it('derives a url-safe id deterministically, distinct from the token', () => {
    const id = deriveDraftId(nonce);
    expect(deriveDraftId(nonce)).toBe(id); // deterministic
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/); // non-enumerable, url + PK safe
    expect(id).not.toBe(encodeCredential(deriveDraftToken(nonce)));
  });

  it('gives different nonces different tokens and ids', () => {
    const other = crypto.randomBytes(32);
    expect(deriveDraftToken(nonce).equals(deriveDraftToken(other))).toBe(false);
    expect(deriveDraftId(nonce)).not.toBe(deriveDraftId(other));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: FAIL — `deriveDraftToken is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/draftCredentials.ts
const DRAFT_TOKEN_INFO = 'ninescrolls/rfq-draft-token/v1';
const DRAFT_ID_INFO = 'ninescrolls/rfq-draft-id/v1';

/**
 * Bearer token = HKDF-SHA-256(ikm=nonce, info=domain). Deterministic and
 * independent of the pepper, so an identical create retry returns the same token.
 */
export function deriveDraftToken(nonce: Buffer): Buffer {
  return Buffer.from(
    crypto.hkdfSync('sha256', nonce, Buffer.alloc(0), Buffer.from(DRAFT_TOKEN_INFO), CREDENTIAL_BYTES),
  );
}

/**
 * Non-enumerable rfqId = base64url(SHA-256(domain || nonce)). Deterministic and
 * distinct from the token (different domain, different primitive).
 */
export function deriveDraftId(nonce: Buffer): string {
  const digest = crypto.createHash('sha256')
    .update(DRAFT_ID_INFO)
    .update(nonce)
    .digest();
  return digest.toString('base64url');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftCredentials.ts amplify/lib/rfq/draftCredentials.test.ts
git commit -m "feat(rfq-draft): deterministic HKDF token + SHA-256 non-enumerable id"
```

---

### Task 3: Versioned peppered hash + constant-time, non-disclosing verify

Storage holds only `v<keyVersion>:<HMAC-SHA-256(pepper, token) hex>`. Verification selects
the pepper by the stored version prefix and uses a constant-time compare. Missing or
malformed input still performs a fixed-length HMAC + constant-time compare so timing and
outcome never disclose whether a draft exists (spec lines 96–97).

**Files:**
- Modify: `amplify/lib/rfq/draftCredentials.ts`
- Test: `amplify/lib/rfq/draftCredentials.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/lib/rfq/draftCredentials.test.ts
import { hashDraftToken, verifyDraftToken } from './draftCredentials';

describe('peppered hash + verify', () => {
  const pepperV1 = crypto.randomBytes(32);
  const pepperV2 = crypto.randomBytes(32);
  const resolve = (v: number) => (v === 1 ? pepperV1 : v === 2 ? pepperV2 : undefined);
  const nonce = crypto.randomBytes(32);
  const token = deriveDraftToken(nonce);

  it('stores a versioned hex hash and verifies the matching token', () => {
    const stored = hashDraftToken(pepperV1, 1, token);
    expect(stored).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(verifyDraftToken(stored, token, resolve)).toBe(true);
  });

  it('rejects a wrong token', () => {
    const stored = hashDraftToken(pepperV1, 1, token);
    const wrong = deriveDraftToken(crypto.randomBytes(32));
    expect(verifyDraftToken(stored, wrong, resolve)).toBe(false);
  });

  it('selects the pepper by stored version', () => {
    const stored = hashDraftToken(pepperV2, 2, token);
    expect(verifyDraftToken(stored, token, resolve)).toBe(true);
    // verifying a v2 hash with only v1 available must fail, not throw
    expect(verifyDraftToken(stored, token, (v) => (v === 1 ? pepperV1 : undefined))).toBe(false);
  });

  it('returns false (never throws) for missing or malformed stored hashes', () => {
    expect(verifyDraftToken(undefined, token, resolve)).toBe(false);
    expect(verifyDraftToken('', token, resolve)).toBe(false);
    expect(verifyDraftToken('garbage', token, resolve)).toBe(false);
    expect(verifyDraftToken('v9:deadbeef', token, resolve)).toBe(false); // unknown version
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: FAIL — `hashDraftToken is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/draftCredentials.ts
const HASH_HEX_LEN = 64; // SHA-256 hex
const DUMMY_HASH = '0'.repeat(HASH_HEX_LEN);

/** Peppered token hash, stored as `v<keyVersion>:<hmac-sha256 hex>`. */
export function hashDraftToken(pepper: Buffer, keyVersion: number, token: Buffer): string {
  const mac = crypto.createHmac('sha256', pepper).update(token).digest('hex');
  return `v${keyVersion}:${mac}`;
}

/**
 * Constant-time verification. Any missing/malformed/unknown-version input still
 * computes an HMAC and compares against a fixed dummy so the caller cannot infer
 * draft existence from timing or from which branch returned false.
 */
export function verifyDraftToken(
  storedHash: string | undefined,
  token: Buffer,
  resolvePepper: (keyVersion: number) => Buffer | undefined,
): boolean {
  const parsed = typeof storedHash === 'string' ? /^v(\d+):([0-9a-f]{64})$/.exec(storedHash) : null;
  const version = parsed ? Number(parsed[1]) : -1;
  const expectedHex = parsed ? parsed[2] : DUMMY_HASH;
  const pepper = version >= 0 ? resolvePepper(version) : undefined;
  // Always run the HMAC (dummy pepper if unresolved) to keep timing uniform.
  const actualHex = crypto
    .createHmac('sha256', pepper ?? DUMMY_PEPPER)
    .update(token)
    .digest('hex');
  const match = crypto.timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  return match && parsed !== null && pepper !== undefined;
}

// Fixed dummy pepper for the non-disclosing path; never used for real storage.
const DUMMY_PEPPER = Buffer.alloc(CREDENTIAL_BYTES, 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftCredentials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftCredentials.ts amplify/lib/rfq/draftCredentials.test.ts
git commit -m "feat(rfq-draft): versioned peppered hash + non-disclosing constant-time verify"
```

---

### Task 4: Canonical RFQ contract + normalized draft updates

First extend the canonical contract so the formal submission and draft schemas consume the
same role, budget, timeline, funding, equipment, and normalization definitions. Then add a
strict schema for exactly the fields the spec allows a draft to persist (spec lines 37–52).
Unknown keys are rejected; email is NFC-normalized and lowercased; `quantity` is 1–100.

Updates have an explicit normalized representation: `{ set, remove }`. An absent key means
"unchanged"; a normalized empty optional string means REMOVE; an empty required value is
invalid. P1 also provides a pure apply-and-revalidate helper: it evaluates every full-draft
and cross-field rule against the current draft plus the normalized operation before P2 attempts
a conditional write. P2 can therefore detect a no-op without extending activity/expiry.

**Files:**
- Modify: `amplify/lib/rfq/contract.ts`
- Modify: `amplify/functions/submit-rfq/handler.ts`
- Test: `amplify/functions/submit-rfq/handler.test.ts`
- Create: `amplify/lib/rfq/draftContract.ts`
- Test: `amplify/lib/rfq/draftContract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/draftContract.test.ts
import { describe, it, expect } from 'vitest';
import {
  draftCreateSchema,
  draftPatchRequestSchema,
  normalizeDraftPatch,
  applyNormalizedDraftPatch,
  DRAFT_FIELD_KEYS,
} from './draftContract';

const VALID = {
  name: 'Jane Researcher',
  email: 'JANE@Stanford.edu',
  institution: 'Stanford University',
  equipmentCategory: 'Probe-Station',
  applicationDescription: 'Wafer probing for silicon photonics device characterization.',
  quantity: 2,
};

describe('draftCreateSchema', () => {
  it('accepts a valid whitelisted draft and NFC-lowercases the email', () => {
    const r = draftCreateSchema.safeParse(VALID);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('jane@stanford.edu');
  });

  it('rejects unknown keys (e.g. a leaked shipping field)', () => {
    const r = draftCreateSchema.safeParse({ ...VALID, shippingAddress: '1 Infinite Loop' });
    expect(r.success).toBe(false);
  });

  it('rejects quantity outside 1–100', () => {
    expect(draftCreateSchema.safeParse({ ...VALID, quantity: 0 }).success).toBe(false);
    expect(draftCreateSchema.safeParse({ ...VALID, quantity: 101 }).success).toBe(false);
  });

  it('rejects a category not in the shared contract', () => {
    expect(draftCreateSchema.safeParse({ ...VALID, equipmentCategory: 'Nonsense' }).success).toBe(false);
  });

  it('never lists a non-whitelisted field (attachments, keySpecifications, comments)', () => {
    for (const banned of ['attachmentKeys', 'keySpecifications', 'additionalComments', 'shippingAddress']) {
      expect(DRAFT_FIELD_KEYS).not.toContain(banned);
    }
  });
});

describe('normalized draft patch', () => {
  it('accepts a single changed whitelisted field', () => {
    const parsed = draftPatchRequestSchema.parse({ quantity: 5 });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: { quantity: 5 }, remove: [] });
  });

  it('still rejects unknown keys in a patch', () => {
    expect(draftPatchRequestSchema.safeParse({ turnstileToken: 'x' }).success).toBe(false);
  });

  it('normalizes an empty optional string to an explicit removal', () => {
    const parsed = draftPatchRequestSchema.parse({ department: '  ' });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: {}, remove: ['department'] });
  });

  it('normalizes whitespace-only phone and enum values to removals', () => {
    const parsed = draftPatchRequestSchema.parse({ phone: '  ', role: '  ' });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: {}, remove: ['phone', 'role'] });
  });

  it('rejects removal of a required string', () => {
    expect(draftPatchRequestSchema.safeParse({ institution: '  ' }).success).toBe(false);
  });

  it('preserves an empty patch as a detectable no-op', () => {
    expect(normalizeDraftPatch(draftPatchRequestSchema.parse({})))
      .toEqual({ set: {}, remove: [] });
  });

  it('applies an operation and revalidates the complete resulting draft', () => {
    const operation = normalizeDraftPatch(draftPatchRequestSchema.parse({ department: '' }));
    const current = draftCreateSchema.parse({ ...VALID, department: 'Physics' });
    expect(applyNormalizedDraftPatch(current, operation))
      .not.toHaveProperty('department');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftContract.test.ts`
Expected: FAIL — `Failed to resolve import "./draftContract"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/lib/rfq/contract.ts — import-free canonical values
export const RFQ_ROLE_VALUES = [
  'PI', 'Research Scientist', 'Postdoc', 'Researcher', 'Graduate Student', 'Engineer',
  'Procurement', 'Lab Manager', 'Business Development', 'Other',
] as const;
export const RFQ_BUDGET_RANGE_VALUES = [
  'Under $10k', '$10k - $30k', '$30k - $80k', '$80k - $150k', 'Over $150k', 'Not yet defined',
] as const;
export const RFQ_TIMELINE_VALUES = [
  'immediate', 'within-3-months', 'within-6-months', '6-plus-months', 'budgetary-planning',
] as const;
export const RFQ_FUNDING_STATUS_VALUES = [
  'funded', 'budget-under-review', 'grant-pending', 'exploring', 'prefer-not-to-say',
] as const;

/** Canonical Unicode/whitespace normalization shared by formal and draft input. */
export function normalizeRfqText(value: string): string {
  return value.trim().normalize('NFC');
}

export function normalizeRfqEmail(value: string): string {
  return normalizeRfqText(value).toLowerCase();
}
```

Replace the four local arrays in `submit-rfq/handler.ts` with imports of these values and
use them in the existing `rfqSchema`. Apply `normalizeRfqEmail` to `email`; apply
`normalizeRfqText` only to these human-entered prose/address fields before their existing
length validation: `name`, `phone`, `institution`, `department`, `specificModel`,
`applicationDescription`, `keySpecifications`, `existingEquipment`, `additionalComments`,
`shippingAddress`, `shippingCity`, `shippingState`, `shippingZipCode`, and `shippingCountry`.
Do **not** normalize opaque/security-sensitive values (`turnstileToken`, `attachmentKeys`,
`visitorId`, or any future credential/identifier) and do not replace a field-specific
canonicalizer such as the existing `referralSource` transform. Add handler tests that assert:
(1) each canonical enum parses through the corresponding formal field, (2) formal name/email
normalization matches the draft schema, and (3) representative opaque values pass through
unchanged. This makes canonicalization part of P1, not a promise deferred to later work.

```ts
// amplify/lib/rfq/draftContract.ts
import { z } from 'zod';
import {
  RFQ_BUDGET_RANGE_VALUES,
  RFQ_EQUIPMENT_CATEGORY_VALUES,
  RFQ_FUNDING_STATUS_VALUES,
  RFQ_ROLE_VALUES,
  RFQ_TIMELINE_VALUES,
  normalizeRfqEmail,
  normalizeRfqText,
} from './contract';
import { RFQ_FIELD_LIMITS as L } from './limits';

const normalizedText = (schema: z.ZodString) =>
  z.string().transform(normalizeRfqText).pipe(schema);
const email = z.string().transform(normalizeRfqEmail)
  .pipe(z.string().max(L.email.max).email());

// Exactly the spec's draft whitelist (design lines 37–52). `.strict()` rejects
// any key not listed here — the guarantee that shipping/attachments/comments and
// credential material can never be persisted in a draft.
const draftFields = {
  name: normalizedText(z.string().min(L.name.min).max(L.name.max)),
  email,
  phone: normalizedText(z.string().min(7).max(L.phone.max)).optional(),
  institution: normalizedText(z.string().min(L.institution.min).max(L.institution.max)),
  department: normalizedText(z.string().max(L.department.max)).optional(),
  role: z.enum(RFQ_ROLE_VALUES).optional(),
  equipmentCategory: z.enum(RFQ_EQUIPMENT_CATEGORY_VALUES),
  specificModel: normalizedText(z.string().max(L.specificModel.max)).optional(),
  applicationDescription: normalizedText(z.string().min(L.applicationDescription.min).max(L.applicationDescription.max)),
  quantity: z.number().int().min(1).max(100),
  budgetRange: z.enum(RFQ_BUDGET_RANGE_VALUES).optional(),
  timeline: z.enum(RFQ_TIMELINE_VALUES).optional(),
  fundingStatus: z.enum(RFQ_FUNDING_STATUS_VALUES).optional(),
  needsBudgetaryQuote: z.boolean().optional(),
};

export const DRAFT_FIELD_KEYS = Object.keys(draftFields);

/** Full draft (create): required fields present, unknown keys rejected. */
export const draftCreateSchema = z.object(draftFields).strict();

const removableStringFields = [
  'phone', 'department', 'specificModel',
] as const;
const removableEnumFields = [
  'role', 'budgetRange', 'timeline', 'fundingStatus',
] as const;
const removableFields = [...removableStringFields, ...removableEnumFields] as const;

/** Raw PATCH body: absent means unchanged; blank is allowed only for removable fields. */
const removable = (schema: z.ZodTypeAny) => z.preprocess(
  (value) => typeof value === 'string' ? normalizeRfqText(value) : value,
  schema.or(z.literal('')),
);

export const draftPatchRequestSchema = z.object({
  ...draftFields,
  phone: removable(draftFields.phone.unwrap()),
  department: removable(draftFields.department.unwrap()),
  role: removable(draftFields.role.unwrap()),
  specificModel: removable(draftFields.specificModel.unwrap()),
  budgetRange: removable(draftFields.budgetRange.unwrap()),
  timeline: removable(draftFields.timeline.unwrap()),
  fundingStatus: removable(draftFields.fundingStatus.unwrap()),
}).strict().partial();

export type DraftRemoveField = (typeof removableFields)[number];
export type NormalizedDraftPatch = {
  set: Record<string, unknown>;
  remove: DraftRemoveField[];
};

export function normalizeDraftPatch(
  input: z.infer<typeof draftPatchRequestSchema>,
): NormalizedDraftPatch {
  const set: Record<string, unknown> = {};
  const remove: DraftRemoveField[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() === '' &&
        (removableFields as readonly string[]).includes(key)) {
      remove.push(key as DraftRemoveField);
    } else {
      set[key] = value;
    }
  }
  return { set, remove };
}

/** Apply removals/sets and rerun all full-draft and cross-field validation. */
export function applyNormalizedDraftPatch(
  current: DraftCreateInput,
  operation: NormalizedDraftPatch,
): DraftCreateInput {
  const candidate: Record<string, unknown> = { ...current };
  for (const key of operation.remove) delete candidate[key];
  Object.assign(candidate, operation.set);
  return draftCreateSchema.parse(candidate);
}

export type DraftCreateInput = z.infer<typeof draftCreateSchema>;
export type DraftPatchRequest = z.infer<typeof draftPatchRequestSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/contract.ts amplify/functions/submit-rfq/handler.ts \
  amplify/functions/submit-rfq/handler.test.ts amplify/lib/rfq/draftContract.ts \
  amplify/lib/rfq/draftContract.test.ts
git commit -m "feat(rfq-draft): canonical contract and normalized draft updates"
```

---

### Task 5: Plan-wide verification

- [ ] **Step 1: Run the full P1 suite**

Run: `npx vitest run amplify/lib/rfq/ amplify/functions/submit-rfq/handler.test.ts --exclude '**/.claude/**'`
Expected: PASS — draftCredentials + draftContract + existing contract/limits tests + formal-handler canonical enum/normalization parity tests.

- [ ] **Step 2: Typecheck and lint the new modules**

Run: `npx tsc --noEmit && npm run typecheck:amplify && npx eslint amplify/lib/rfq/draftCredentials.ts amplify/lib/rfq/draftContract.ts amplify/lib/rfq/contract.ts amplify/functions/submit-rfq/handler.ts`
Expected: no errors.

- [ ] **Step 3: Confirm zero runtime coupling**

Run: `grep -rn "draftCredentials\|draftContract" src/ amplify/functions/ || echo "draft modules not yet imported — P1 ships dark"`
Expected: no runtime imports of `draftCredentials` or `draftContract`. The formal handler does
import the newly canonical enum values from `contract.ts`; P1 otherwise ships dark.

---

## Self-Review

**Spec coverage (P1 scope only — spec §"Three distinct credentials", "Token verification", "Exact draft field whitelist"):**
- 32-byte base64url credentials — Task 1.
- HKDF token + SHA-256 non-enumerable ID, deterministic, pepper-independent — Task 2.
- Versioned peppered hash, constant-time compare, non-disclosing dummy path — Task 3.
- Canonical enums consumed by formal + draft schemas; strict draft whitelist; normalized
  set/remove/no-op update semantics; unknown-key rejection; NFC email; quantity 1–100 — Task 4.

**Deferred to later plans (out of P1 scope):** pepper retrieval/rotation from Secrets Manager (P2/A), `draftCreateNonce`/`submitIdempotencyKey` header handling (P3), submit-receipt binding + canonicalization (P4), DynamoDB storage & optimistic concurrency (P2).

**Placeholder scan:** none — every code step contains complete implementation.

**Type consistency:** `deriveDraftToken`/`deriveDraftId`/`hashDraftToken`/`verifyDraftToken` signatures are used identically across Tasks 2–3; `draftCreateSchema`/`draftPatchRequestSchema`/`normalizeDraftPatch`/`applyNormalizedDraftPatch`/`DRAFT_FIELD_KEYS` names match between `draftContract.ts` and its test.

**Note for the implementer:** `crypto.hkdfSync` returns an `ArrayBuffer`; it is wrapped in `Buffer.from(...)` in Task 2. `crypto.timingSafeEqual` requires equal-length buffers — Task 3 guarantees this by always comparing two 32-byte (64 hex) values.
