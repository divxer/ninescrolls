import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emitTimelineEvent: vi.fn() }));
vi.mock('./lib/emitTimelineEvent', () => ({
  emitTimelineEvent: (a: unknown) => mocks.emitTimelineEvent(a),
}));

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
