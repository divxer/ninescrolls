import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emitTimelineEvent: vi.fn() }));
vi.mock('./lib/emitTimelineEvent', () => ({
  emitTimelineEvent: (a: unknown) => mocks.emitTimelineEvent(a),
}));

const mockReconcile = vi.hoisted(() => ({ reconcileSweep: vi.fn() }));
vi.mock('./lib/sweep/reconcileSweep', () => ({ reconcileSweep: (a: unknown) => mockReconcile.reconcileSweep(a) }));

import { handler } from './handler';

describe('crm-api direct-invoke dispatch', () => {
  it('routes {action:emitTimelineEvent} to emitTimelineEvent and ignores AppSync markers', async () => {
    mocks.emitTimelineEvent.mockResolvedValueOnce(undefined);
    const args = { source: 'rfq', kind: 'rfq_submitted' };
    await handler({ action: 'emitTimelineEvent', args } as never);
    expect(mocks.emitTimelineEvent).toHaveBeenCalledWith(args);
  });
  it('throws on an unknown action', async () => {
    await expect(handler({ action: 'nope' } as never)).rejects.toThrow(/unknown action.*nope/i);
  });
  it('preserves the AppSync field dispatch error path', async () => {
    const event = { info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {} };
    await expect(handler(event as never)).rejects.toThrow(/unknown.*nope/i);
  });
});

describe('crm-api reconcileSweep action', () => {
  it('routes {action:reconcileSweep, mode, limit} to reconcileSweep with the right args', async () => {
    mockReconcile.reconcileSweep.mockResolvedValueOnce({ mode: 'hot', summary: {} });
    const { handler } = await import('./handler');
    await handler({ action: 'reconcileSweep', mode: 'hot', limit: 50 } as never);
    expect(mockReconcile.reconcileSweep).toHaveBeenCalledWith({ mode: 'hot', limit: 50, cursor: undefined });
  });
});
