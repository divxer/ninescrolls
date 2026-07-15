# RFQ Turnstile Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RFQ verification failures visible and recoverable without weakening mandatory CAPTCHA enforcement.

**Architecture:** Keep the change inside `RFQPage` and model Turnstile as an attempt-scoped state machine. Separate bounded script/API loading from widget rendering, invalidate stale callbacks with a generation counter, centralize cleanup, and expose accessible status/retry UI on Step 2.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Cloudflare Turnstile.

## Global Constraints

- Keep the existing RFQ API, payload, form fields, analytics, and mandatory server-side CAPTCHA validation unchanged.
- The initialization timeout is exactly 10 seconds and ends after `turnstile.render` returns a widget ID; it never limits customer challenge-completion time.
- With no `VITE_TURNSTILE_SITE_KEY`, preserve existing no-CAPTCHA development and test behavior.
- Preserve all entered form data across verification retry.
- Do not remove a Turnstile script not created and marked by the RFQ loader.

## File Structure

- Modify `src/pages/RFQPage.tsx`: verification state machine, lifecycle cleanup, retry behavior, and accessible status UI.
- Modify `src/pages/RFQPage.test.tsx`: deterministic Turnstile harness and regression tests.

---

### Task 1: Verification state and accessible locked-button explanation

**Files:**
- Modify: `src/pages/RFQPage.tsx:10-30,240-260,1038-1080`
- Test: `src/pages/RFQPage.test.tsx`

**Interfaces:**
- Produces: `type VerificationStatus = 'inactive' | 'loading' | 'ready' | 'error' | 'expired'`
- Produces: Step 2 status node with id `rfq-verification-status`
- Preserves: configured-key submission is enabled only when the active verification token exists.

- [ ] **Step 1: Add a failing locked-state accessibility test**

Add a test helper that fills Step 1 and clicks Continue, then add this test with a configured site key and a Turnstile mock whose `render` stores callbacks but does not call `callback`:

```tsx
it('explains why proposal submission is disabled while verification is incomplete', async () => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
  installTurnstileMock();
  renderRfq('/request-quote');
  await enterProjectDetails();

  const submit = screen.getByRole('button', { name: 'Request Proposal' });
  expect(submit).toBeDisabled();
  expect(submit).toHaveAttribute('aria-describedby', 'rfq-verification-status');
  expect(screen.getByRole('status')).toHaveTextContent(/verification/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/pages/RFQPage.test.tsx -t "explains why proposal submission"`

Expected: FAIL because the disabled button has no `aria-describedby` and no verification status region.

- [ ] **Step 3: Implement minimal state and accessible status copy**

In `RFQPage.tsx`, add the state type and initialize it from the site key:

```tsx
type VerificationStatus = 'inactive' | 'loading' | 'ready' | 'error' | 'expired';

const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
  turnstileSiteKey ? 'loading' : 'inactive',
);
```

Update Turnstile callbacks so active success sets `ready`, error sets `error`, and expiration sets `expired`. Render `#rfq-verification-status` with concise copy for each state, and add `aria-describedby="rfq-verification-status"` to the submit button whenever a site key is configured. Keep the current disabled predicate secure.

- [ ] **Step 4: Run the focused test and existing RFQ tests**

Run: `npm test -- src/pages/RFQPage.test.tsx`

Expected: all RFQ page tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RFQPage.tsx src/pages/RFQPage.test.tsx
git commit -m "fix(rfq): explain pending verification"
```

---

### Task 2: Attempt-scoped loader, timeout, retry, and stale-callback protection

**Files:**
- Modify: `src/pages/RFQPage.tsx:10-30,245-365,590-605,1038-1070`
- Test: `src/pages/RFQPage.test.tsx`

**Interfaces:**
- Produces: `TURNSTILE_INIT_TIMEOUT_MS = 10_000`
- Produces: `startVerificationAttempt(): void` and `retryVerification(): void`
- Uses: `verificationGenerationRef`, `turnstileWidgetId`, and RFQ-owned script marker `data-rfq-turnstile="true"`.

- [ ] **Step 1: Add failing tests for error, timeout, retry, success, and stale callbacks**

Extend the controlled mock so tests can invoke captured `callback`, `error-callback`, and `expired-callback`. Add individual tests that assert:

```tsx
it('offers retry after a widget error', async () => {
  const turnstile = installTurnstileMock();
  renderRfq('/request-quote');
  await enterProjectDetails();
  turnstile.callbacks['error-callback']?.();
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  expect(screen.getByRole('button', { name: /Retry verification/i })).toBeEnabled();
});

it('reports initialization timeout but does not time challenge completion', async () => {
  vi.useFakeTimers();
  // First render: API never appears. Advance 10 seconds and expect retry.
  // Second render: render returns a widget ID. Advance beyond 10 seconds and
  // expect loading copy, not an initialization error.
});

it('ignores a success callback from an obsolete attempt', async () => {
  const first = capturedCallbacks();
  fireEvent.click(screen.getByRole('button', { name: /Retry verification/i }));
  first.callback('stale-token');
  expect(screen.getByRole('button', { name: 'Request Proposal' })).toBeDisabled();
});
```

Also test expiration clears readiness, script `error` reaches recovery, retry resets/recreates safely, and leaving Step 2/unmount prevents later timer or callback updates.

- [ ] **Step 2: Run new focused tests and verify RED**

Run: `npm test -- src/pages/RFQPage.test.tsx -t "widget error|initialization timeout|obsolete attempt|expires|script error|unmount"`

Expected: FAIL because retry UI, bounded loading, and generation guards do not exist.

- [ ] **Step 3: Replace the current Turnstile effect with an attempt-scoped lifecycle**

Implement these invariants in `RFQPage.tsx`:

```tsx
const TURNSTILE_INIT_TIMEOUT_MS = 10_000;
const verificationGenerationRef = useRef(0);
const cleanupVerificationRef = useRef<() => void>(() => undefined);

const invalidateVerification = useCallback(() => {
  verificationGenerationRef.current += 1;
  cleanupVerificationRef.current();
  cleanupVerificationRef.current = () => undefined;
  setTurnstileToken(null);
}, []);
```

`startVerificationAttempt` must:

1. Return unless the key exists, `currentStep === 2`, and the widget ref is mounted.
2. Invalidate prior work, capture the new generation, and set `loading`.
3. Start a 10-second timeout for API availability/render only.
4. Use the existing API immediately, or attach bounded `load`/`error` listeners to an existing script, or create a marked RFQ-owned script.
5. On API availability, call `render` inside `try/catch`; clear the timeout immediately after a widget ID is returned.
6. Guard every callback with `generation === verificationGenerationRef.current`.
7. Store cleanup that clears timers/listeners and removes only the active widget; remove a failed script only when it has `data-rfq-turnstile="true"`.

`retryVerification` invalidates the old generation and starts a fresh attempt. If reset is usable it may reset before recreation, but any reset/render exception must transition the active attempt to `error`.

- [ ] **Step 4: Render recovery UI**

For `error` and `expired`, render an alert/status message, a `Retry verification` button, and a `mailto:sales@ninescrolls.com` fallback. Preserve the Turnstile container so retry can render without remounting the form.

- [ ] **Step 5: Run the lifecycle tests and full RFQ suite**

Run: `npm test -- src/pages/RFQPage.test.tsx`

Expected: all RFQ page tests PASS with no unhandled timer or `act` warnings.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RFQPage.tsx src/pages/RFQPage.test.tsx
git commit -m "fix(rfq): recover failed Turnstile verification"
```

---

### Task 3: Submission-failure recovery and final verification

**Files:**
- Modify: `src/pages/RFQPage.tsx:590-605`
- Test: `src/pages/RFQPage.test.tsx`

**Interfaces:**
- Consumes: `startVerificationAttempt()` and generation invalidation from Task 2.
- Produces: a failed API submission always invalidates the consumed token and starts a new verification attempt.

- [ ] **Step 1: Add a failing submission-recovery test**

Configure `fetch` to return a failing RFQ response, complete the active Turnstile callback, submit, and assert the API error remains visible while the button returns to its explained disabled/loading state. Then invoke the old callback and assert it cannot re-enable submission.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/pages/RFQPage.test.tsx -t "recovers verification after submission failure"`

Expected: FAIL because the existing catch block resets the widget without synchronizing verification status/generation.

- [ ] **Step 3: Implement minimal submission recovery**

In the catch path, preserve `submitError`, then invalidate the consumed verification attempt and start a new one. Remove the direct unsynchronized token/reset mutation. If recovery cannot initialize, let the lifecycle expose `error` and retry.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test -- src/pages/RFQPage.test.tsx
npm test
npm run lint
npx tsc --noEmit
```

Expected: all tests PASS, lint reports zero errors, and TypeScript exits 0.

- [ ] **Step 5: Inspect the final diff and commit**

Run: `git diff --check && git diff --stat HEAD~2`

Expected: no whitespace errors; changes limited to the RFQ page and its tests.

```bash
git add src/pages/RFQPage.tsx src/pages/RFQPage.test.tsx
git commit -m "test(rfq): cover verification recovery"
```
