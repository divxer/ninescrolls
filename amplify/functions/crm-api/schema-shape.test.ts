import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const src = readFileSync(resolve(__dirname, '../../data/resource.ts'), 'utf8');

describe('data schema CRM customTypes', () => {
  it('defines TimelineEvent, Contact, LinkAuditLog', () => {
    expect(src).toMatch(/TimelineEvent:\s*a\.customType/);
    expect(src).toMatch(/Contact:\s*a\.customType/);
    expect(src).toMatch(/LinkAuditLog:\s*a\.customType/);
  });
  it('TimelineEvent reserves comms fields', () => {
    const block = src.slice(src.indexOf('TimelineEvent:'), src.indexOf('TimelineEvent:') + 1200);
    for (const f of ['direction', 'externalId', 'threadId', 'from', 'to', 'subject', 'bodySnippet']) {
      expect(block).toContain(f);
    }
  });
});
