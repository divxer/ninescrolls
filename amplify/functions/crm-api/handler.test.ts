import { describe, it, expect } from 'vitest';
import { handler } from './handler';

describe('crm-api handler', () => {
  it('throws for an unknown fieldName', async () => {
    const event = { info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {} };
    await expect(handler(event as never)).rejects.toThrow(/unknown.*nope/i);
  });
});
