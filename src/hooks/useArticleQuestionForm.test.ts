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
    // Real 403 shape from submit-question/handler.ts — `error`, never `message`.
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({
      success: false,
      error: 'CAPTCHA verification failed',
    });
    const onSuccessRedirect = vi.fn();
    const { result } = renderHook(() =>
      useArticleQuestionForm({ slug: 's', onSuccessRedirect }),
    );
    fillValidForm(result);
    act(() => result.current.setPurchaseIntent(true));
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toBe('CAPTCHA verification failed');
    expect(result.current.isSuccess).toBe(false);
    expect(onSuccessRedirect).not.toHaveBeenCalled();
  });

  it('on 400: surfaces the field-level validation detail, not a generic string', async () => {
    // Real 400 shape from submit-question/handler.ts — error + details[], no message.
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({
      success: false,
      error: 'Validation failed',
      details: [{ field: 'email', message: 'Invalid email address' }],
    });
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toBe('Validation failed — email: Invalid email address');
  });

  it('on 500: surfaces the server error rather than a generic string', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({
      success: false,
      error: 'Internal server error',
    });
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toBe('Internal server error');
  });

  it('falls back to a generic message when the body carries no reason', async () => {
    vi.spyOn(svc, 'submitQuestion').mockResolvedValue({ success: false });
    const { result } = renderHook(() => useArticleQuestionForm({ slug: 's' }));
    fillValidForm(result);
    await act(async () => { await result.current.handleSubmit(fakeEvent); });
    expect(result.current.error).toBe('Failed to submit request. Please try again.');
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
