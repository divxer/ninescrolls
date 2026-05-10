# Insights → RFQ Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RFQ-oriented CTAs to insights articles, prefill `/rfq` from article context, attribute submitted RFQs back to the source article, and let Ask form readers self-segment as commercial intent.

**Architecture:** Backend-first (schema + Lambda field additions), then pure utilities, then a TDD-protected hook extraction of the existing Ask form logic, then new RFQ CTA components, then `RFQPage` URL prefill enhancement, then admin display. Frontend ships only after backend is deployed (backward-compatible additions throughout).

**Tech Stack:** React 18 + TypeScript + Vite + Vitest + React Testing Library; AWS Amplify Gen 2 (Schema + Lambda + DynamoDB); existing `useCombinedAnalytics` (GA4 + Segment); Zod validation in Lambdas.

**Spec:** [docs/superpowers/specs/2026-05-09-insights-rfq-conversion-design.md](../specs/2026-05-09-insights-rfq-conversion-design.md)

---

## Phase 1 — Backend foundation (additive, deploy-first)

### Task 1: Add `referrerSource` and `purchaseIntent` to Amplify schema

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Add `referrerSource` to `RfqSubmission` customType**

In `amplify/data/resource.ts`, locate the `RfqSubmission: a.customType({ ... })` block (~line 334) and add the new field at the bottom:

```ts
RfqSubmission: a.customType({
  // ...existing fields...
  attachmentKeys: a.json(),
  referrerSource: a.string(),  // NEW: "insights/<slug>" | "news/<slug>" | undefined
}),
```

- [ ] **Step 2: Add `purchaseIntent` to `ArticleQuestion` model**

In the same file (~line 88), locate `ArticleQuestion: a.model({ ... })` and add:

```ts
ArticleQuestion: a
  .model({
    // ...existing fields...
    answeredBy: a.string(),
    purchaseIntent: a.boolean(),  // NEW
  })
  // .authorization and .secondaryIndexes unchanged
```

- [ ] **Step 3: Regenerate Amplify outputs locally**

Run: `npx ampx sandbox` in a separate terminal until it prints "Watching for changes" (or use existing sandbox if running)

Then verify the regenerated `amplify_outputs.json` reflects the new fields by grepping:
```bash
grep -E "referrerSource|purchaseIntent" amplify_outputs.json
```
Expected: lines for both new fields appear

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean, no errors

- [ ] **Step 5: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(schema): add referrerSource to RFQ and purchaseIntent to ArticleQuestion"
```

---

### Task 2: Extend `submit-rfq` Lambda Zod schema and persistence

**Files:**
- Modify: `amplify/functions/submit-rfq/handler.ts`
- Modify: `amplify/functions/submit-rfq/handler.test.ts` (if exists)

- [ ] **Step 1: Write failing tests for `referrerSource` handling**

`amplify/functions/submit-rfq/handler.test.ts` exists; add these test cases:

```ts
it('persists referrerSource when valid format', async () => {
  const event = makeEvent({
    ...validRfqBody,
    referrerSource: 'insights/atomic-layer-etching-guide',
  });
  await handler(event, ctx, cb);
  const putCall = ddbMock.commandCalls(PutCommand)[0];
  expect(putCall.args[0].input.Item.referrerSource).toBe('insights/atomic-layer-etching-guide');
});

it('rejects invalid referrerSource format silently (RFQ still submits)', async () => {
  const event = makeEvent({
    ...validRfqBody,
    referrerSource: 'javascript:alert(1)',
  });
  const result = await handler(event, ctx, cb);
  expect(JSON.parse(result.body).success).toBe(true);
  const putCall = ddbMock.commandCalls(PutCommand)[0];
  expect(putCall.args[0].input.Item.referrerSource).toBeUndefined();
});

it('rejects oversized referrerSource (>200 chars)', async () => {
  const event = makeEvent({
    ...validRfqBody,
    referrerSource: 'insights/' + 'a'.repeat(201),
  });
  const result = await handler(event, ctx, cb);
  expect(JSON.parse(result.body).success).toBe(true);
  const putCall = ddbMock.commandCalls(PutCommand)[0];
  expect(putCall.args[0].input.Item.referrerSource).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- amplify/functions/submit-rfq/handler.test.ts`
Expected: 3 new tests fail (referrerSource not in schema yet)

- [ ] **Step 3: Add `referrerSource` to Zod schema**

In `amplify/functions/submit-rfq/handler.ts`, find `export const rfqSchema = z.object({ ... })` (~line 81) and add inside the object **before** the closing `}).refine(...)`:

```ts
referrerSource: z.string().max(200).regex(/^(insights|news|products)\/[a-z0-9-]+$/).optional(),
```

- [ ] **Step 4: Persist `referrerSource` in DDB Item**

Find where `item` is constructed before `PutCommand` (around line 640-660). Add right after where other optional fields are spread:

```ts
if (data.referrerSource) {
    item.referrerSource = data.referrerSource;
}
```

(Don't add it unconditionally — leaving it `undefined` keeps DDB sparse-attribute behavior clean.)

- [ ] **Step 5: Handle Zod rejection of bad format gracefully**

The current Zod schema makes invalid `referrerSource` fail the entire request with a 400. We want the spec behavior: bad format → silently ignored, RFQ still submits.

Replace the strict validator with a custom transform that drops invalid values:

```ts
referrerSource: z
    .string()
    .max(200)
    .optional()
    .transform((v) => {
        if (!v) return undefined;
        if (!/^(insights|news|products)\/[a-z0-9-]+$/.test(v)) {
            console.warn(`Invalid referrerSource ignored: ${v.slice(0, 50)}`);
            return undefined;
        }
        return v;
    }),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- amplify/functions/submit-rfq/handler.test.ts`
Expected: all 3 new tests pass; pre-existing failures unchanged (out of scope per spec)

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
git commit -m "feat(rfq): persist referrerSource for article attribution"
```

---

### Task 3: Extend `submit-question` Lambda for `purchaseIntent`

**Files:**
- Modify: `amplify/functions/submit-question/handler.ts`

(Note: do **not** create a test file — per spec section 6.4, single-boolean addition does not justify new test infrastructure. Skip TDD here.)

- [ ] **Step 1: Add `purchaseIntent` to Zod schema**

In `amplify/functions/submit-question/handler.ts`, find `const questionSchema = z.object({ ... })` (~line 56) and add:

```ts
const questionSchema = z.object({
    articleSlug: z.string().min(1).max(200),
    name: z.string().min(2).max(100),
    email: z.string().email().max(254),
    question: z.string().min(10).max(2000),
    turnstileToken: z.string().min(1),
    purchaseIntent: z.boolean().optional().default(false),  // NEW
});
```

- [ ] **Step 2: Persist `purchaseIntent` in DDB PutCommand**

Find the `PutCommand` block in the handler that writes the question item. Add `purchaseIntent: data.purchaseIntent` to the `Item` object (alongside name, email, question, articleSlug, etc.):

```ts
Item: {
    id: questionId,
    articleSlug: data.articleSlug,
    name: data.name,
    email: data.email,
    question: data.question,
    purchaseIntent: data.purchaseIntent,  // NEW
    status: 'pending',
    submittedAt: new Date().toISOString(),
},
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add amplify/functions/submit-question/handler.ts
git commit -m "feat(qa): persist purchaseIntent flag on article questions"
```

---

## Phase 2 — Pure utility

### Task 4: Build `rfqAttribution` URL helper

**Files:**
- Create: `src/utils/rfqAttribution.ts`
- Create: `src/utils/rfqAttribution.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/rfqAttribution.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRfqUrl } from './rfqAttribution';

describe('buildRfqUrl', () => {
  it('builds URL with no products', () => {
    expect(buildRfqUrl({ sourceSlug: 'foo' }))
      .toBe('/rfq?source=insights%2Ffoo');
  });

  it('builds URL with one product', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'icp-rie-200' }],
      sourceSlug: 'rie-guide',
    })).toBe('/rfq?products=icp-rie-200&source=insights%2Frie-guide');
  });

  it('joins multiple products with commas', () => {
    expect(buildRfqUrl({
      products: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
      sourceSlug: 'foo',
    })).toBe('/rfq?products=a%2Cb%2Cc&source=insights%2Ffoo');
  });

  it('uses sourceArea when provided', () => {
    expect(buildRfqUrl({
      sourceSlug: 'apple-intel',
      sourceArea: 'news',
    })).toBe('/rfq?source=news%2Fapple-intel');
  });

  it('truncates to first 5 products', () => {
    const products = Array.from({ length: 7 }, (_, i) => ({ slug: `p${i}` }));
    expect(buildRfqUrl({ products, sourceSlug: 'foo' }))
      .toBe('/rfq?products=p0%2Cp1%2Cp2%2Cp3%2Cp4&source=insights%2Ffoo');
  });

  it('appends extra query params', () => {
    expect(buildRfqUrl({
      sourceSlug: 'foo',
      extraParams: { via: 'ask-checkbox' },
    })).toBe('/rfq?source=insights%2Ffoo&via=ask-checkbox');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/rfqAttribution.test.ts`
Expected: all fail with "Cannot find module './rfqAttribution'"

- [ ] **Step 3: Implement the helper**

Create `src/utils/rfqAttribution.ts`:

```ts
interface BuildRfqUrlOpts {
  products?: { slug: string }[];
  sourceSlug: string;
  sourceArea?: 'insights' | 'news' | 'products';
  extraParams?: Record<string, string>;
}

const MAX_PRODUCTS = 5;

export function buildRfqUrl(opts: BuildRfqUrlOpts): string {
  const params = new URLSearchParams();
  if (opts.products && opts.products.length > 0) {
    const slugs = opts.products.slice(0, MAX_PRODUCTS).map((p) => p.slug);
    params.set('products', slugs.join(','));
  }
  params.set('source', `${opts.sourceArea ?? 'insights'}/${opts.sourceSlug}`);
  if (opts.extraParams) {
    for (const [k, v] of Object.entries(opts.extraParams)) {
      params.set(k, v);
    }
  }
  return `/rfq?${params.toString()}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/rfqAttribution.test.ts`
Expected: all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/utils/rfqAttribution.ts src/utils/rfqAttribution.test.ts
git commit -m "feat(utils): add buildRfqUrl helper for article-attributed RFQ links"
```

---

## Phase 3 — Hook extraction (TDD-protected refactor)

### Task 5: Write tests for `useArticleQuestionForm` against the existing form behavior

**Files:**
- Create: `src/hooks/useArticleQuestionForm.test.ts`

- [ ] **Step 1: Mock `submitQuestion` service and write tests**

Create `src/hooks/useArticleQuestionForm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArticleQuestionForm } from './useArticleQuestionForm';
import * as svc from '../services/articleQuestionsService';

vi.mock('../services/articleQuestionsService');

const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');  // disable Turnstile for unit tests
});

function fillValidForm(result: ReturnType<typeof renderHook<ReturnType<typeof useArticleQuestionForm>, unknown>>['result']) {
  act(() => {
    result.current.update({ target: { name: 'name', value: 'Alice' } } as never);
    result.current.update({ target: { name: 'email', value: 'a@b.co' } } as never);
    result.current.update({ target: { name: 'question', value: 'A long enough question?' } } as never);
  });
}

describe('useArticleQuestionForm — validation', () => {
  it('rejects name shorter than 2 chars', async () => {
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    act(() => result.current.update({ target: { name: 'name', value: 'A' } } as never));
    act(() => result.current.update({ target: { name: 'email', value: 'a@b.co' } } as never));
    act(() => result.current.update({ target: { name: 'question', value: 'long enough q' } } as never));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toMatch(/name/i);
  });

  it('rejects invalid email', async () => {
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    act(() => result.current.update({ target: { name: 'name', value: 'Alice' } } as never));
    act(() => result.current.update({ target: { name: 'email', value: 'no-at-sign' } } as never));
    act(() => result.current.update({ target: { name: 'question', value: 'long enough q' } } as never));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toMatch(/email/i);
  });

  it('rejects question shorter than 10 chars', async () => {
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    act(() => result.current.update({ target: { name: 'name', value: 'Alice' } } as never));
    act(() => result.current.update({ target: { name: 'email', value: 'a@b.co' } } as never));
    act(() => result.current.update({ target: { name: 'question', value: 'short' } } as never));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toMatch(/10 characters/i);
  });
});

describe('useArticleQuestionForm — submission', () => {
  it('on success: sets isSuccess, resets form, does not redirect when purchaseIntent=false', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: true, message: '' });
    const onSuccessRedirect = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onSuccessRedirect }),
    );
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.form.name).toBe('');
    expect(onSuccessRedirect).not.toHaveBeenCalled();
  });

  it('on success with purchaseIntent=true: calls onSuccessRedirect', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: true, message: '' });
    const onSuccessRedirect = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onSuccessRedirect }),
    );
    fillValidForm(result);
    act(() => result.current.setPurchaseIntent(true));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(onSuccessRedirect).toHaveBeenCalledWith({ purchaseIntent: true });
  });

  it('on success with purchaseIntent=true: calls onPurchaseIntentSubmit with question length', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: true, message: '' });
    const onPurchaseIntentSubmit = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onPurchaseIntentSubmit }),
    );
    fillValidForm(result);
    act(() => result.current.setPurchaseIntent(true));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(onPurchaseIntentSubmit).toHaveBeenCalledWith({
      questionLength: 'A long enough question?'.length,
    });
  });

  it('on success with purchaseIntent=false: does not call onPurchaseIntentSubmit', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: true, message: '' });
    const onPurchaseIntentSubmit = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onPurchaseIntentSubmit }),
    );
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(onPurchaseIntentSubmit).not.toHaveBeenCalled();
  });

  it('on API failure: sets error, does not redirect even if purchaseIntent=true', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: false, message: 'rate limited' });
    const onSuccessRedirect = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onSuccessRedirect }),
    );
    fillValidForm(result);
    act(() => result.current.setPurchaseIntent(true));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toBe('rate limited');
    expect(result.current.isSuccess).toBe(false);
    expect(onSuccessRedirect).not.toHaveBeenCalled();
  });

  it('on network error: shows generic message', async () => {
    vi.spyOn(svc, 'submitQuestion').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toMatch(/network/i);
  });

  it('reset() clears state', () => {
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    fillValidForm(result);
    act(() => result.current.setPurchaseIntent(true));
    act(() => result.current.reset());
    expect(result.current.form.name).toBe('');
    expect(result.current.form.purchaseIntent).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/hooks/useArticleQuestionForm.test.ts`
Expected: all fail with "Cannot find module './useArticleQuestionForm'"

- [ ] **Step 3: Commit failing tests**

```bash
git add src/hooks/useArticleQuestionForm.test.ts
git commit -m "test(hooks): add failing tests for useArticleQuestionForm"
```

---

### Task 6: Implement `useArticleQuestionForm`

**Files:**
- Create: `src/hooks/useArticleQuestionForm.ts`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useArticleQuestionForm.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { submitQuestion } from '../services/articleQuestionsService';

interface UseArticleQuestionFormOpts {
  slug: string;
  onSuccessRedirect?: (form: { purchaseIntent: boolean }) => void;
  onPurchaseIntentSubmit?: (form: { questionLength: number }) => void;
}

interface FormState {
  name: string;
  email: string;
  question: string;
  purchaseIntent: boolean;
}

const INITIAL: FormState = { name: '', email: '', question: '', purchaseIntent: false };

export function useArticleQuestionForm({ slug, onSuccessRedirect, onPurchaseIntentSubmit }: UseArticleQuestionFormOpts) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Load Turnstile widget when ref attaches
  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return;
    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if ((window as unknown as { turnstile?: unknown }).turnstile) return resolve();
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    ensureScript().then(() => {
      try {
        const widget = widgetRef.current;
        const turnstile = (window as unknown as { turnstile?: { render: Function; reset: Function } }).turnstile;
        if (!widget || !turnstile) return;
        widgetIdRef.current = turnstile.render(widget, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t),
        }) as string;
      } catch (err) {
        console.warn('Turnstile render failed:', err);
      }
    });
  }, [turnstileSiteKey]);

  const update = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setPurchaseIntent = useCallback((v: boolean) => {
    setForm((prev) => ({ ...prev, purchaseIntent: v }));
  }, []);

  const resetToken = useCallback(() => {
    setToken('');
    const turnstile = (window as unknown as { turnstile?: { reset: Function } }).turnstile;
    if (widgetIdRef.current && turnstile) {
      turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    setForm(INITIAL);
    setIsSuccess(false);
    setError(null);
    resetToken();
  }, [resetToken]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (form.name.trim().length < 2) { setError('Please enter your name.'); return; }
      if (!form.email.includes('@')) { setError('Please enter a valid email address.'); return; }
      if (form.question.trim().length < 10) { setError('Please enter at least 10 characters for your question.'); return; }
      if (turnstileSiteKey && !token) { setError('Please complete the verification.'); return; }

      setIsSubmitting(true);
      try {
        const result = await submitQuestion({
          articleSlug: slug,
          name: form.name.trim(),
          email: form.email.trim(),
          question: form.question.trim(),
          turnstileToken: token || 'no-key',
          purchaseIntent: form.purchaseIntent,
        });
        if (!result.success) {
          setError(result.message || 'Submission failed. Please try again.');
          return;
        }
        const wasPurchaseIntent = form.purchaseIntent;
        const submittedQuestionLength = form.question.trim().length;
        setIsSuccess(true);
        setForm(INITIAL);
        resetToken();
        if (wasPurchaseIntent) {
          onPurchaseIntentSubmit?.({ questionLength: submittedQuestionLength });
          onSuccessRedirect?.({ purchaseIntent: true });
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, slug, token, turnstileSiteKey, onSuccessRedirect, onPurchaseIntentSubmit, resetToken],
  );

  return {
    form,
    update,
    setPurchaseIntent,
    handleSubmit,
    isSubmitting,
    isSuccess,
    error,
    reset,
    turnstileSiteKey,
    widgetRef,
    token,
    resetToken,
  };
}
```

- [ ] **Step 2: Update `submitQuestion` service signature**

Modify `src/services/articleQuestionsService.ts` `submitQuestion` payload type to include `purchaseIntent`:

```ts
export async function submitQuestion(payload: {
  articleSlug: string;
  name: string;
  email: string;
  question: string;
  turnstileToken: string;
  purchaseIntent?: boolean;  // NEW
}): Promise<{ success: boolean; message: string }> {
  // body unchanged
}
```

- [ ] **Step 3: Run hook tests to verify they pass**

Run: `npm test -- src/hooks/useArticleQuestionForm.test.ts`
Expected: all 9 tests pass

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useArticleQuestionForm.ts src/services/articleQuestionsService.ts
git commit -m "feat(hooks): add useArticleQuestionForm shared hook"
```

---

### Task 7: Refactor `ArticleQASection` to use the shared hook

**Files:**
- Modify: `src/components/insights/ArticleQASection.tsx`

- [ ] **Step 1: Replace inline form state with hook**

In `src/components/insights/ArticleQASection.tsx`, find `function ArticleQASection({ slug }: ArticleQASectionProps) {` (~line 200). Replace the inline state declarations and `handleSubmit` with the hook:

```tsx
import { useArticleQuestionForm } from '../../hooks/useArticleQuestionForm';
import { useNavigate } from 'react-router-dom';
import { buildRfqUrl } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';
// ...inside the component
export function ArticleQASection({ slug, post }: { slug: string; post?: InsightsPost }) {
  const { questions, loading, refetch } = useArticleQuestions(slug);
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const {
    form, update, setPurchaseIntent, handleSubmit,
    isSubmitting, isSuccess, error, turnstileSiteKey, widgetRef,
  } = useArticleQuestionForm({
    slug,
    onPurchaseIntentSubmit: ({ questionLength }) => {
      analytics.trackCustomEvent('insights_question_with_purchase_intent', {
        articleSlug: slug,
        questionLength,
      });
    },
    onSuccessRedirect: () => {
      navigate(buildRfqUrl({
        products: post?.relatedProducts,
        sourceSlug: slug,
        extraParams: { via: 'ask-checkbox' },
      }));
    },
  });
  // ...rest of component renders the form using form/update/handleSubmit/isSuccess/error/widgetRef from the hook
```

Delete the now-unused inline state hooks (`useState` for `form`, `isSubmitting`, `isSuccess`, `error`, `token`, `widgetRef`, `widgetIdRef`), the inline `handleSubmit`, and the inline Turnstile useEffect.

Update the form's name/email/question inputs to read from `form` and call `update(e)` (no change in attribute names).

- [ ] **Step 2: Add `post` prop to `ArticleQASection` interface**

Update the props type:
```tsx
interface ArticleQASectionProps {
  slug: string;
  post?: InsightsPost;  // NEW: needed for RFQ redirect URL
}
```

Update import: `import type { InsightsPost } from '../../types';`

- [ ] **Step 3: Update call site in `InsightsPostPage`**

In `src/pages/InsightsPostPage.tsx`, find `<ArticleQASection slug={post.slug} />` (line 381) and add the post prop:

```tsx
<ArticleQASection slug={post.slug} post={post} />
```

- [ ] **Step 4: Run hook tests + typecheck**

Run: `npm test -- src/hooks/useArticleQuestionForm.test.ts && npm run typecheck`
Expected: tests still pass, typecheck clean

- [ ] **Step 5: Manual verification**

Run: `npm run dev`

In a browser (port 5173), navigate to any insights article (e.g. `/insights/atomic-layer-etching-guide`), scroll to Q&A section, fill name + email + question, click Submit. Verify:
- Submission either succeeds (UI shows green checkmark) or shows error
- Form clears on success
- No console errors

- [ ] **Step 6: Commit**

```bash
git add src/components/insights/ArticleQASection.tsx src/pages/InsightsPostPage.tsx
git commit -m "refactor(qa): ArticleQASection uses useArticleQuestionForm hook"
```

---

### Task 8: Refactor `FloatingAskButton` to use the shared hook

**Files:**
- Modify: `src/components/insights/ArticleQASection.tsx` (file also contains `FloatingAskButton`)

- [ ] **Step 1: Replace inline form state with hook in `FloatingAskButton`**

In the same file, find `export function FloatingAskButton({ slug }: { slug: string }) {` (~line 11). Apply the same refactor pattern:

```tsx
export function FloatingAskButton({ slug, post }: { slug: string; post?: InsightsPost }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const {
    form, update, setPurchaseIntent, handleSubmit,
    isSubmitting, isSuccess, error, turnstileSiteKey, widgetRef, reset,
  } = useArticleQuestionForm({
    slug,
    onPurchaseIntentSubmit: ({ questionLength }) => {
      analytics.trackCustomEvent('insights_question_with_purchase_intent', {
        articleSlug: slug,
        questionLength,
      });
    },
    onSuccessRedirect: () => {
      navigate(buildRfqUrl({
        products: post?.relatedProducts,
        sourceSlug: slug,
        extraParams: { via: 'ask-checkbox' },
      }));
    },
  });
  // visibility / Escape handler / scroll listener: unchanged
  // form rendering: same as before but bind to hook return values
  const resetAndClose = () => { setOpen(false); reset(); };
```

Delete inline state and handlers as in Task 7.

- [ ] **Step 2: Update call site in `InsightsPostPage`**

In `src/pages/InsightsPostPage.tsx`, find `<FloatingAskButton slug={post.slug} />` (line 392) and update:

```tsx
<FloatingAskButton slug={post.slug} post={post} />
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm test -- src/hooks/useArticleQuestionForm.test.ts`
Expected: clean and passing

- [ ] **Step 4: Manual verification — both surfaces**

Run: `npm run dev`

In browser, on an insights article:
1. Scroll until floating Ask button appears (left side, after 400px scroll)
2. Click it → modal opens
3. Fill form → Submit → verify success state appears in modal
4. Close modal
5. Scroll to Q&A section at bottom → verify it's also still functional (re-test from Task 7)

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/ArticleQASection.tsx src/pages/InsightsPostPage.tsx
git commit -m "refactor(qa): FloatingAskButton uses useArticleQuestionForm hook"
```

---

## Phase 4 — Ask checkbox UI

### Task 9: Add purchase intent checkbox to both Ask surfaces

**Files:**
- Modify: `src/components/insights/ArticleQASection.tsx`

- [ ] **Step 1: Add checkbox markup in `ArticleQASection` form**

In the form JSX of `ArticleQASection` (just **above** the submit button), add:

```tsx
<label className="flex items-start gap-2 cursor-pointer text-sm text-on-surface-variant">
  <input
    type="checkbox"
    checked={form.purchaseIntent}
    onChange={(e) => setPurchaseIntent(e.target.checked)}
    className="mt-0.5"
  />
  <span>
    I'm also evaluating equipment for purchase
    <span className="block text-xs text-on-surface-variant/70 mt-0.5">
      Optional — if checked, we'll redirect you to our quote form after submitting your question.
    </span>
  </span>
</label>
```

- [ ] **Step 2: Add same checkbox in `FloatingAskButton` modal form**

Place identically — above the submit button in the modal form section.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. On an insights article:
1. Scroll to Q&A → verify checkbox visible above Submit
2. Open floating Ask modal → verify checkbox visible above Submit
3. Default unchecked in both
4. Check it → submit (use a real test email if backend live, or expect API error if sandbox not deployed) → if submission succeeds, verify URL changes to `/rfq?...&via=ask-checkbox` with prefilled fields

- [ ] **Step 4: Commit**

```bash
git add src/components/insights/ArticleQASection.tsx
git commit -m "feat(qa): add purchase-intent checkbox to Ask form surfaces"
```

---

## Phase 5 — RFQ CTA components

### Task 10: Build `RfqCtaCard` component (footer card)

**Files:**
- Create: `src/components/insights/RfqCtaCard.tsx`
- Create: `src/components/insights/RfqCtaCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/insights/RfqCtaCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RfqCtaCard } from './RfqCtaCard';
import type { InsightsPost } from '../../types';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const trackCustomEvent = vi.fn();
vi.mock('../../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({ trackCustomEvent }),
}));

const basePost = {
  slug: 'rie-guide',
  title: 'RIE Guide',
} as InsightsPost;

beforeEach(() => { vi.clearAllMocks(); });

function renderCard(post: InsightsPost) {
  return render(<MemoryRouter><RfqCtaCard post={post} ctaPosition="article-footer" /></MemoryRouter>);
}

describe('RfqCtaCard', () => {
  it('renders generic copy when no relatedProducts', () => {
    renderCard({ ...basePost, relatedProducts: [] });
    expect(screen.getByText(/Need help with this process/i)).toBeInTheDocument();
  });

  it('renders single-product copy when one relatedProduct', () => {
    renderCard({ ...basePost, relatedProducts: [{ slug: 'icp-rie-200', title: 'ICP-RIE 200', category: 'etching', readTime: 5, imageUrl: '' }] });
    expect(screen.getByText(/Looking to deploy ICP-RIE 200/i)).toBeInTheDocument();
  });

  it('renders multi-product copy when multiple relatedProducts', () => {
    renderCard({
      ...basePost,
      relatedProducts: [
        { slug: 'a', title: 'A', category: 'etching', readTime: 5, imageUrl: '' },
        { slug: 'b', title: 'B', category: 'etching', readTime: 5, imageUrl: '' },
      ],
    });
    expect(screen.getByText(/Compare and request quotes/i)).toBeInTheDocument();
  });

  it('navigates to /rfq with correct params on click', () => {
    renderCard({
      ...basePost,
      relatedProducts: [{ slug: 'icp-rie-200', title: 'ICP-RIE 200', category: 'etching', readTime: 5, imageUrl: '' }],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('products=icp-rie-200'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('source=insights%2Frie-guide'));
  });

  it('emits insights_cta_click analytics on click', () => {
    renderCard({ ...basePost, relatedProducts: [] });
    fireEvent.click(screen.getByRole('link'));
    expect(trackCustomEvent).toHaveBeenCalledWith('insights_cta_click', expect.objectContaining({
      ctaPosition: 'article-footer',
      articleSlug: 'rie-guide',
      productCount: 0,
      productSlugs: '',
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/insights/RfqCtaCard.test.tsx`
Expected: all fail with module not found

- [ ] **Step 3: Implement the component**

Create `src/components/insights/RfqCtaCard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import type { InsightsPost } from '../../types';
import { buildRfqUrl } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';
import { cdnUrl } from '../../config/imageConfig';

interface RfqCtaCardProps {
  post: InsightsPost;
  ctaPosition: 'article-footer';
}

export function RfqCtaCard({ post, ctaPosition }: RfqCtaCardProps) {
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const products = post.relatedProducts ?? [];
  const count = products.length;

  const url = buildRfqUrl({ products, sourceSlug: post.slug, sourceArea: 'insights' });

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    analytics.trackCustomEvent('insights_cta_click', {
      ctaPosition,
      articleSlug: post.slug,
      articleTitle: post.title,
      productCount: count,
      productSlugs: products.map((p) => p.slug).join(','),
    });
    navigate(url);
  };

  let title: string;
  let subcopy: string;
  let buttonText: string;

  if (count === 0) {
    title = 'Need help with this process?';
    subcopy = 'Talk to our application engineers about equipment options for your project.';
    buttonText = 'Get a quote';
  } else if (count === 1) {
    title = `Looking to deploy ${products[0].title}?`;
    subcopy = `Get pricing and lead time for ${products[0].title}, customized to your application.`;
    buttonText = 'Request a quote';
  } else {
    title = 'Compare and request quotes';
    subcopy = 'Get pricing for the systems referenced in this article.';
    buttonText = 'Get quotes for these systems';
  }

  return (
    <section className="my-10 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/15">
      <h3 className="text-xl font-semibold text-on-surface mb-2">{title}</h3>
      <p className="text-on-surface-variant text-sm sm:text-base mb-5">{subcopy}</p>
      {count >= 1 && (
        <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
          {products.slice(0, 5).map((p) => (
            <div key={p.slug} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface-container shadow-sm">
              {p.imageUrl && (
                <img
                  src={p.imageUrl.startsWith('http') ? p.imageUrl : cdnUrl(p.imageUrl)}
                  alt={p.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}
      <a
        href={url}
        onClick={onClick}
        className="inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors no-underline"
      >
        {buttonText} →
      </a>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/insights/RfqCtaCard.test.tsx`
Expected: all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/RfqCtaCard.tsx src/components/insights/RfqCtaCard.test.tsx
git commit -m "feat(insights): add RfqCtaCard adaptive footer CTA"
```

---

### Task 11: Build `RfqCtaSidebar` component (sticky sidebar)

**Files:**
- Create: `src/components/insights/RfqCtaSidebar.tsx`
- Create: `src/components/insights/RfqCtaSidebar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/insights/RfqCtaSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RfqCtaSidebar } from './RfqCtaSidebar';
import type { InsightsPost } from '../../types';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const trackCustomEvent = vi.fn();
vi.mock('../../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({ trackCustomEvent }),
}));

const post = {
  slug: 'rie-guide',
  title: 'RIE Guide',
  relatedProducts: [{ slug: 'icp-rie-200', title: 'ICP-RIE 200', category: 'etching', readTime: 5, imageUrl: '' }],
} as InsightsPost;

beforeEach(() => { vi.clearAllMocks(); });

describe('RfqCtaSidebar', () => {
  it('renders quote button', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Request a quote/i })).toBeInTheDocument();
  });

  it('navigates with correct URL on click', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('products=icp-rie-200'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('source=insights%2Frie-guide'));
  });

  it('emits sidebar analytics event', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link'));
    expect(trackCustomEvent).toHaveBeenCalledWith('insights_cta_click', expect.objectContaining({
      ctaPosition: 'sidebar',
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/insights/RfqCtaSidebar.test.tsx`
Expected: fail with module not found

- [ ] **Step 3: Implement the component**

Create `src/components/insights/RfqCtaSidebar.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import type { InsightsPost } from '../../types';
import { buildRfqUrl } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface RfqCtaSidebarProps {
  post: InsightsPost;
  ctaPosition: 'sidebar';
}

export function RfqCtaSidebar({ post, ctaPosition }: RfqCtaSidebarProps) {
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const products = post.relatedProducts ?? [];
  const count = products.length;

  const url = buildRfqUrl({ products, sourceSlug: post.slug, sourceArea: 'insights' });

  const subcopy =
    count === 0 ? 'Talk to our application engineers.'
    : count === 1 ? `Get pricing for ${products[0].title}.`
    : 'Get pricing for the systems in this article.';

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    analytics.trackCustomEvent('insights_cta_click', {
      ctaPosition,
      articleSlug: post.slug,
      articleTitle: post.title,
      productCount: count,
      productSlugs: products.map((p) => p.slug).join(','),
    });
    navigate(url);
  };

  return (
    <aside className="hidden lg:block bg-white p-5 rounded-xl shadow-md sticky top-20">
      <h3 className="text-base font-semibold text-on-surface mb-1">Get a quote</h3>
      <p className="text-sm text-on-surface-variant mb-4">{subcopy}</p>
      <a
        href={url}
        onClick={onClick}
        className="block w-full text-center px-4 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors no-underline"
      >
        Request a quote →
      </a>
    </aside>
  );
}
```

Note: `hidden lg:block` ensures mobile/tablet do not render the sidebar (per spec section 3.2).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/insights/RfqCtaSidebar.test.tsx`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/RfqCtaSidebar.tsx src/components/insights/RfqCtaSidebar.test.tsx
git commit -m "feat(insights): add RfqCtaSidebar sticky sidebar CTA"
```

---

### Task 12: Wire CTAs into `InsightsPostPage`

**Files:**
- Modify: `src/pages/InsightsPostPage.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/InsightsPostPage.tsx` add:

```tsx
import { RfqCtaCard } from '../components/insights/RfqCtaCard';
import { RfqCtaSidebar } from '../components/insights/RfqCtaSidebar';
```

- [ ] **Step 2: Render `RfqCtaCard` in the article body, above Q&A**

Locate the JSX where `<ArticleQASection slug={post.slug} post={post} />` is rendered (after the Task 7 edits, line ~381). Insert `<RfqCtaCard>` immediately above:

```tsx
<RfqCtaCard post={post} ctaPosition="article-footer" />
<ArticleQASection slug={post.slug} post={post} />
```

Important: this is the **insights** branch (non-news). The news branch (`isNews`) must **not** get the card.

- [ ] **Step 3: Render `RfqCtaSidebar` in `PostSidebar`**

Find `function PostSidebar({ post, allPosts })` (~line 156). Update:

```tsx
function PostSidebar({ post, allPosts }: { post: InsightsPost; allPosts?: InsightsPost[] }) {
  return (
    <div>
      <div className="bg-white p-6 rounded-xl shadow-md mb-5">
        <RelatedProductsSidebar products={post.relatedProducts} />
        {allPosts && <RelatedArticlesSidebar post={post} allPosts={allPosts} />}
      </div>
      <RfqCtaSidebar post={post} ctaPosition="sidebar" />
      <TableOfContents />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification — desktop and mobile**

Run: `npm run dev`

In browser:
1. Open `/insights/atomic-layer-etching-guide` (multi-product article)
2. **Desktop (>= 1024px wide)**: scroll → see sidebar Quote card sticky on right
3. Scroll to article end → see footer Quote card with multi-product copy
4. Click footer card → verify navigation to `/rfq?products=...&source=insights/...`
5. Verify URL has the correct article slug
6. Resize to mobile width (< 1024px) → sidebar Quote card disappears, footer card still renders

- [ ] **Step 5: Commit**

```bash
git add src/pages/InsightsPostPage.tsx
git commit -m "feat(insights): render RFQ CTA card and sidebar on article pages"
```

---

## Phase 6 — RFQ Page prefill enhancement

### Task 13: Add tests for new `RFQPage` URL parsing

**Files:**
- Create: `src/pages/RFQPage.test.tsx`

- [ ] **Step 1: Write failing integration test for RFQPage URL params**

Create `src/pages/RFQPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RFQPage } from './RFQPage';

vi.mock('../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({
    trackEvent: vi.fn(),
    trackCustomEvent: vi.fn(),
    trackRFQSubmission: vi.fn(),
    segment: { trackWithIPAnalysis: vi.fn() },
  }),
}));

function renderWith(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><RFQPage /></MemoryRouter>);
}

describe('RFQPage URL prefill', () => {
  it('prefills specificModel from ?products=', () => {
    renderWith('/rfq?products=icp-rie-200&source=insights/foo');
    const input = screen.getByLabelText(/Specific Model/i) as HTMLInputElement;
    expect(input.value).toBe('icp-rie-200');
  });

  it('prefills first product as primary when multiple products', () => {
    renderWith('/rfq?products=a-100,b-200,c-300&source=insights/foo');
    const input = screen.getByLabelText(/Specific Model/i) as HTMLInputElement;
    expect(input.value).toBe('a-100');
  });

  it('prefills additionalRequirements with product list when multiple products', () => {
    renderWith('/rfq?products=a-100,b-200&source=insights/foo');
    const textarea = screen.getByLabelText(/Application Description|Additional Comments/i) as HTMLTextAreaElement;
    // additionalComments should contain "Products of interest:"
    expect(screen.getByText(/Products of interest/i)).toBeInTheDocument();
  });

  it('still honors legacy ?product= when no ?products=', () => {
    renderWith('/rfq?product=legacy-model&category=etching');
    const input = screen.getByLabelText(/Specific Model/i) as HTMLInputElement;
    expect(input.value).toBe('legacy-model');
  });
});
```

Note: the actual textarea field name in `RFQPage` is `additionalComments` per the schema. Adjust selector if needed when running.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/RFQPage.test.tsx`
Expected: fail (current code doesn't read `?products=`)

- [ ] **Step 3: Commit failing tests**

```bash
git add src/pages/RFQPage.test.tsx
git commit -m "test(rfq): failing tests for multi-product and source URL prefill"
```

---

### Task 14: Implement RFQ multi-product and source prefill

**Files:**
- Modify: `src/pages/RFQPage.tsx`

- [ ] **Step 1: Parse new URL params and update initial state**

In `src/pages/RFQPage.tsx`, find `export function RFQPage()` (~line 214). Replace the URL param parsing block:

```tsx
const params = new URLSearchParams(location.search);
const productsParam = params.get('products');
const productsList = productsParam
  ? productsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5)
  : [];
const urlProduct = params.get('product') || productsList[0] || '';
const urlCategory = params.get('category') || '';
const referrerSource = params.get('source') || '';

const productListText =
  productsList.length >= 2
    ? `Products of interest:\n${productsList.map((p) => `- ${p}`).join('\n')}\n\n`
    : '';
```

- [ ] **Step 2: Update initial form state**

Find the `useState(() => ({ ...initialFormData, specificModel: urlProduct, ... }))` block and update:

```tsx
const [formData, setFormData] = useState<RFQFormData>(() => ({
  ...initialFormData,
  specificModel: urlProduct,
  equipmentCategory: inferCategory(urlProduct, urlCategory),
  additionalComments: productListText
    ? productListText + (initialFormData.additionalComments || '')
    : initialFormData.additionalComments,
}));
```

- [ ] **Step 3: Hold `referrerSource` in state and include in submit payload**

Add a state hook near the others:

```tsx
const [referrerSourceState] = useState(referrerSource);
```

Find the fetch call to `/api/rfq` (~line 542). The body is built from `formData`. Add `referrerSource`:

```tsx
const payload = {
  ...formData,
  // ...other existing keys...
  referrerSource: referrerSourceState || undefined,
};
```

(Look for the existing payload construction; if the request uses `FormData`, append `referrerSource` via `fd.append('referrerSource', referrerSourceState)` instead.)

- [ ] **Step 4: Emit attribution analytics on successful submit**

Find the success path of `handleSubmit` (after `setIsSuccess(true)` or similar). Add:

```tsx
if (referrerSourceState) {
  analytics.trackCustomEvent('rfq_submit_attribution', {
    referrerSource: referrerSourceState,
    productCount: productsList.length,
    viaAskCheckbox: params.get('via') === 'ask-checkbox',
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/pages/RFQPage.test.tsx`
Expected: all 4 tests pass

- [ ] **Step 6: Manual verification end-to-end**

Run: `npm run dev`. In browser:
1. From an article page, click footer Quote CTA
2. Verify URL on `/rfq` is `?products=...&source=insights/...`
3. Verify "Specific Model" field is prefilled
4. If multi-product, verify "Additional Comments" textarea contains "Products of interest:" and the list
5. Submit (use sandbox if backend live) → verify reference number returned

- [ ] **Step 7: Commit**

```bash
git add src/pages/RFQPage.tsx
git commit -m "feat(rfq): support multi-product and article source prefill via URL"
```

---

## Phase 7 — Admin display

### Task 15: Show `referrerSource` in admin RFQ detail and list

**Files:**
- Modify: `src/pages/admin/RFQDetailPage.tsx`
- Modify: `src/pages/admin/RFQListPage.tsx`

- [ ] **Step 1: Add Source row to RFQDetailPage**

In `src/pages/admin/RFQDetailPage.tsx`, locate the section where RFQ basic info fields are rendered (look for a list of label/value pairs near `rfq.email`, `rfq.phone`, etc.). Add:

```tsx
{rfq.referrerSource && (
  <div className="flex items-start gap-3">
    <span className="text-sm font-medium text-on-surface-variant w-32 shrink-0">Source</span>
    <span className="text-sm text-on-surface">
      {parseSource(rfq.referrerSource)}{' '}
      <a
        href={`/${rfq.referrerSource}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-xs hover:underline"
      >
        View article →
      </a>
    </span>
  </div>
)}
```

Add helper near the top of the file (or in `src/utils/rfqAttribution.ts` if you want to share):

```ts
function parseSource(src: string): string {
  const [area, slug] = src.split('/');
  if (!slug) return src;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const areaLabel = area === 'insights' ? 'Article' : area.charAt(0).toUpperCase() + area.slice(1);
  return `${areaLabel}: ${title}`;
}
```

- [ ] **Step 2: Add Source column to RFQListPage**

In `src/pages/admin/RFQListPage.tsx`, locate the table header definitions and add a "Source" column (between existing columns where it fits visually). Render `parseSource(rfq.referrerSource)` truncated to ~30 chars in the cell.

- [ ] **Step 3: Add `?source=` filter to RFQListPage**

Find where the list is filtered (likely a `useMemo` over the rfq array). Read `?source=` from URL search params and apply:

```tsx
const sourceFilter = new URLSearchParams(location.search).get('source');
const filtered = rfqs.filter((r) => !sourceFilter || r.referrerSource === sourceFilter);
```

- [ ] **Step 4: Manual verification**

If sandbox is deployed and you have a test RFQ submitted with `referrerSource`:
1. Open `/admin/rfqs` → verify Source column appears
2. Click into the RFQ → verify Source row with article link
3. Visit `/admin/rfqs?source=insights/foo` → verify list filtered

If no test data exists, mock by temporarily setting `referrerSource` on a known RFQ via `scripts/` (out of scope for this task, just visually confirm component renders without crashing on empty data).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/RFQDetailPage.tsx src/pages/admin/RFQListPage.tsx
git commit -m "feat(admin): display RFQ referrerSource with article links and filter"
```

---

### Task 16: Show purchase intent badge in admin Questions

**Files:**
- Modify: `src/pages/admin/AdminQuestionsPage.tsx`

- [ ] **Step 1: Add badge in question list rows**

In `src/pages/admin/AdminQuestionsPage.tsx`, locate the row rendering for each question. Add a badge near the question metadata:

```tsx
{q.purchaseIntent && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
    $ Purchase Intent
  </span>
)}
```

- [ ] **Step 2: Update `ArticleQuestionAdmin` type if needed**

Check `src/types/index.ts` (or wherever `ArticleQuestionAdmin` is defined). If it doesn't include `purchaseIntent`, add:

```ts
export interface ArticleQuestionAdmin extends ArticleQuestion {
  email: string;
  purchaseIntent?: boolean;  // NEW
}
```

Also add to `mapToArticleQuestionAdmin` in `src/services/articleQuestionsService.ts`:

```ts
function mapToArticleQuestionAdmin(item: DynamoQuestion): ArticleQuestionAdmin {
  return {
    ...mapToArticleQuestion(item),
    email: item.email,
    purchaseIntent: item.purchaseIntent ?? false,
  };
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Open `/admin/questions`. Verify:
- Page renders without crashes
- If any question has `purchaseIntent === true`, the badge is visible
- (If no such question exists yet, this is OK — Task 17 manual smoke will exercise it)

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminQuestionsPage.tsx src/types/index.ts src/services/articleQuestionsService.ts
git commit -m "feat(admin): show purchase intent badge on Q&A list"
```

---

## Phase 8 — Final verification

### Task 17: End-to-end manual smoke test and acceptance verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all new tests pass; pre-existing failures unchanged

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 3: Deploy backend to sandbox**

In a separate terminal: `npx ampx sandbox` (if not already running). Wait for `Deployment completed` message.

Verify in CloudWatch: invoke submit-rfq Lambda once with a test payload containing `referrerSource: "insights/test"` and confirm DDB Item contains the field.

- [ ] **Step 4: Manual smoke checklist**

Run: `npm run dev`. Walk through:

- [ ] Multi-product article (e.g. `/insights/atomic-layer-etching-guide`)
  - [ ] Footer card shows "Compare and request quotes" with product thumbnails
  - [ ] Sidebar card shows on desktop, sticky on scroll
  - [ ] Click footer card → URL is `/rfq?products=...&source=insights/atomic-layer-etching-guide`
  - [ ] RFQ page Specific Model field prefilled with first product
  - [ ] RFQ page Additional Comments contains "Products of interest:" with full list
- [ ] Single-product article
  - [ ] Footer card shows "Looking to deploy {product}" with single thumbnail
  - [ ] Sidebar card shows shorter copy
- [ ] Article with 0 relatedProducts (find one that has none, or test on a news article — wait, news articles should have NO RFQ CTAs)
  - [ ] News articles do **not** show footer or sidebar RFQ cards
- [ ] Mobile viewport (Chrome DevTools, narrow to 375px)
  - [ ] Footer card renders
  - [ ] Sidebar card does **not** render
  - [ ] Floating Ask button still works
- [ ] Ask form purchase intent flow
  - [ ] Open Q&A section, fill form, check "I'm also evaluating equipment for purchase"
  - [ ] Submit → form submits → redirected to `/rfq?...&via=ask-checkbox`
  - [ ] Same flow via floating Ask button modal works
- [ ] Submit a test RFQ with `referrerSource` populated
  - [ ] Check `/admin/rfqs/<id>` shows "Source: Article: ..." with link back to article
  - [ ] Click article link → opens correct article in new tab
- [ ] Submit a test Q&A with purchaseIntent=true (separately, without redirecting — temporarily comment out the navigate to test)
  - [ ] Check `/admin/questions` shows the "$ Purchase Intent" badge

- [ ] **Step 5: Verify analytics events fire**

Open browser DevTools Network tab, filter for Segment / GA requests. On an article:
1. Click footer Quote CTA → verify `insights_cta_click` event in Network with correct payload
2. Click sidebar Quote CTA → verify same event with `ctaPosition: 'sidebar'`
3. Submit RFQ from prefilled form → verify `rfq_submit_attribution` event fires

- [ ] **Step 6: Final commit (if any tweaks needed)**

If Step 5 revealed any analytics gaps, fix and commit. Otherwise no commit needed.

- [ ] **Step 7: Open PR**

```bash
git push -u origin claude/stoic-ellis-94a6ec
gh pr create --title "Insights → RFQ conversion: CTAs, prefill, attribution" --body "$(cat <<'EOF'
## Summary
- New RFQ CTAs on insights articles (footer card + desktop sidebar) adaptive to relatedProducts
- /rfq accepts ?products=a,b&source=insights/<slug>; prefills Specific Model and Additional Comments
- Submitted RFQs persist referrerSource; admin shows source with link back to article
- Ask form gains "evaluating purchase" checkbox → on submit, redirects to prefilled /rfq
- Refactored duplicated Ask form logic into useArticleQuestionForm hook
- Schema: RfqSubmission.referrerSource, ArticleQuestion.purchaseIntent

Spec: [docs/superpowers/specs/2026-05-09-insights-rfq-conversion-design.md](docs/superpowers/specs/2026-05-09-insights-rfq-conversion-design.md)
Plan: [docs/superpowers/plans/2026-05-09-insights-rfq-conversion.md](docs/superpowers/plans/2026-05-09-insights-rfq-conversion.md)

## Test plan
- [x] All new unit and component tests pass
- [x] Typecheck clean
- [x] Manual smoke: multi-product / single-product / 0-product / news / mobile / Ask checkbox flow / admin display
- [x] Analytics events visible in DevTools Network

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done criteria

- [ ] All 17 tasks complete with each step's checkbox checked
- [ ] All tests in scope pass
- [ ] Manual smoke checklist all green
- [ ] PR opened and linked to spec
