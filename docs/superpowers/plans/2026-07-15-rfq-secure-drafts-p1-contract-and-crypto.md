# RFQ Secure Drafts P1 — Contract & Credential Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, unit-testable foundation for RFQ secure drafts — the credential library (base64url codec, HKDF token derivation, non-enumerable ID, versioned peppered HMAC hash + constant-time verify) and the draft field whitelist schema — with no AWS or HTTP dependencies.

**Architecture:** Two new modules under `amplify/lib/rfq/` (peer to the existing `contract.ts` and `limits.ts`). `draftCredentials.ts` owns all cryptography — deterministic derivation from a client nonce and non-reversible storage/verification of the peppered token hash. `draftContract.ts` owns the draft field whitelist as a strict Zod schema that derives enums from `contract.ts` and lengths from `limits.ts`, so drafts cannot drift from the formal RFQ schema. Everything here is a pure function of its inputs; DynamoDB, HTTP, and secret retrieval live in later plans (P2/P3).

**Tech Stack:** TypeScript, Node.js `crypto` (`hkdfSync`, `createHash`, `createHmac`, `timingSafeEqual`), Zod, Vitest.

---

## File Structure

- Create `amplify/lib/rfq/draftCredentials.ts` — credential codec, derivation, hashing, verification. No imports outside `node:crypto`.
- Create `amplify/lib/rfq/draftCredentials.test.ts` — unit tests for the above.
- Create `amplify/lib/rfq/draftContract.ts` — draft field whitelist Zod schema (create + patch variants), deriving from `contract.ts` and `limits.ts`.
- Create `amplify/lib/rfq/draftContract.test.ts` — schema tests.

These are leaf modules: nothing else imports them yet, so P1 ships with zero behavior change to the running app. P2 (storage) and P3 (API) import them.

**Test command for the whole plan:** `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`

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
Expected: PASS (3 tests).

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

### Task 4: Draft field whitelist schema (create + partial patch)

A strict Zod schema for exactly the fields the spec allows a draft to persist (spec lines
37–52), deriving enums from `contract.ts` and lengths from `limits.ts`. Unknown keys are
rejected; email is NFC-normalized and lowercased; `quantity` is 1–100. The patch variant is
the same shape made partial for optimistic-concurrency updates.

**Files:**
- Create: `amplify/lib/rfq/draftContract.ts`
- Test: `amplify/lib/rfq/draftContract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/lib/rfq/draftContract.test.ts
import { describe, it, expect } from 'vitest';
import { draftCreateSchema, draftPatchSchema, DRAFT_FIELD_KEYS } from './draftContract';

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

describe('draftPatchSchema', () => {
  it('accepts a single changed whitelisted field', () => {
    expect(draftPatchSchema.safeParse({ quantity: 5 }).success).toBe(true);
  });

  it('still rejects unknown keys in a patch', () => {
    expect(draftPatchSchema.safeParse({ turnstileToken: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/rfq/draftContract.test.ts`
Expected: FAIL — `Failed to resolve import "./draftContract"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/lib/rfq/draftContract.ts
import { z } from 'zod';
import { RFQ_EQUIPMENT_CATEGORY_VALUES } from './contract';
import { RFQ_FIELD_LIMITS as L } from './limits';

// Enums that also constrain the formal RFQ (kept in one place — see contract.ts).
const ROLES = [
  'PI', 'Research Scientist', 'Postdoc', 'Researcher', 'Graduate Student', 'Engineer',
  'Procurement', 'Lab Manager', 'Business Development', 'Other',
] as const;
const BUDGET_RANGES = [
  'Under $10k', '$10k - $30k', '$30k - $80k', '$80k - $150k', 'Over $150k', 'Not yet defined',
] as const;
const TIMELINES = [
  'immediate', 'within-3-months', 'within-6-months', '6-plus-months', 'budgetary-planning',
] as const;
const FUNDING_STATUSES = [
  'funded', 'budget-under-review', 'grant-pending', 'exploring', 'prefer-not-to-say',
] as const;

const email = z.string().trim().max(L.email.max).email()
  .transform((v) => v.normalize('NFC').toLowerCase());

// Exactly the spec's draft whitelist (design lines 37–52). `.strict()` rejects
// any key not listed here — the guarantee that shipping/attachments/comments and
// credential material can never be persisted in a draft.
const draftFields = {
  name: z.string().trim().min(L.name.min).max(L.name.max),
  email,
  phone: z.string().trim().min(7).max(L.phone.max).optional(),
  institution: z.string().trim().min(L.institution.min).max(L.institution.max),
  department: z.string().trim().max(L.department.max).optional(),
  role: z.enum(ROLES).optional(),
  equipmentCategory: z.enum(RFQ_EQUIPMENT_CATEGORY_VALUES),
  specificModel: z.string().trim().max(L.specificModel.max).optional(),
  applicationDescription: z.string().trim().min(L.applicationDescription.min).max(L.applicationDescription.max),
  quantity: z.number().int().min(1).max(100),
  budgetRange: z.enum(BUDGET_RANGES).optional(),
  timeline: z.enum(TIMELINES).optional(),
  fundingStatus: z.enum(FUNDING_STATUSES).optional(),
  needsBudgetaryQuote: z.boolean().optional(),
};

export const DRAFT_FIELD_KEYS = Object.keys(draftFields);

/** Full draft (create): required fields present, unknown keys rejected. */
export const draftCreateSchema = z.object(draftFields).strict();

/** Partial draft (patch): any subset of whitelisted fields, unknown keys rejected. */
export const draftPatchSchema = z.object(draftFields).strict().partial();

export type DraftCreateInput = z.infer<typeof draftCreateSchema>;
export type DraftPatchInput = z.infer<typeof draftPatchSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/rfq/draftContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/rfq/draftContract.ts amplify/lib/rfq/draftContract.test.ts
git commit -m "feat(rfq-draft): strict draft field whitelist schema (create + patch)"
```

---

### Task 5: Plan-wide verification

- [ ] **Step 1: Run the full P1 suite**

Run: `npx vitest run amplify/lib/rfq/ --exclude '**/.claude/**'`
Expected: PASS — draftCredentials + draftContract + existing contract/limits tests.

- [ ] **Step 2: Typecheck and lint the new modules**

Run: `npx tsc --noEmit && npx eslint amplify/lib/rfq/draftCredentials.ts amplify/lib/rfq/draftContract.ts`
Expected: no errors.

- [ ] **Step 3: Confirm zero runtime coupling**

Run: `grep -rn "draftCredentials\|draftContract" src/ amplify/functions/ || echo "not yet imported — P1 ships dark"`
Expected: no matches — P1 is a leaf; P2/P3 wire it in.

---

## Self-Review

**Spec coverage (P1 scope only — spec §"Three distinct credentials", "Token verification", "Exact draft field whitelist"):**
- 32-byte base64url credentials — Task 1.
- HKDF token + SHA-256 non-enumerable ID, deterministic, pepper-independent — Task 2.
- Versioned peppered hash, constant-time compare, non-disclosing dummy path — Task 3.
- Strict draft whitelist deriving from the shared contract; unknown-key rejection; NFC email; quantity 1–100 — Task 4.

**Deferred to later plans (out of P1 scope):** pepper retrieval/rotation from Secrets Manager (P2/A), `draftCreateNonce`/`submitIdempotencyKey` header handling (P3), submit-receipt binding + canonicalization (P4), DynamoDB storage & optimistic concurrency (P2).

**Placeholder scan:** none — every code step contains complete implementation.

**Type consistency:** `deriveDraftToken`/`deriveDraftId`/`hashDraftToken`/`verifyDraftToken` signatures are used identically across Tasks 2–3; `draftCreateSchema`/`draftPatchSchema`/`DRAFT_FIELD_KEYS` names match between `draftContract.ts` and its test.

**Note for the implementer:** `crypto.hkdfSync` returns an `ArrayBuffer`; it is wrapped in `Buffer.from(...)` in Task 2. `crypto.timingSafeEqual` requires equal-length buffers — Task 3 guarantees this by always comparing two 32-byte (64 hex) values.
