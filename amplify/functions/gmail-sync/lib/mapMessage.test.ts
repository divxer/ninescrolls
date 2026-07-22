import { describe, it, expect } from 'vitest';
import { mapMessage } from './mapMessage';

const msg = (over: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({
  id: 'g1', threadId: 'th1', internalDate: '1783600000000', snippet: 'snip', labelIds: ['INBOX'],
  payload: { headers: Object.entries({ From: 'Bob <Bob@Ext.com>', To: 'sales@ninescrolls.com', Subject: 'Hi', 'Message-ID': '<M1@ext.com>', ...headers }).map(([name, value]) => ({ name, value })) },
  ...over,
});

describe('mapMessage', () => {
  it('inbound: customer = From (normalized); alias allowlist keeps sales@; emits full payload', () => {
    const r = mapMessage(msg(), 'info@ninescrolls.com');
    expect(r.kind).toBe('emit');
    if (r.kind !== 'emit') return;
    expect(r.emit.direction).toBe('inbound');
    expect(r.emit.payload.customerEmail).toBe('bob@ext.com');
    expect(r.emit.occurredAt).toBe(new Date(1783600000000).toISOString());   // internalDate, NOT the Date header
    expect(r.emit.idInput).toEqual({ source: 'gmail', rfc822MessageId: '<M1@ext.com>' });
    expect(r.emit.externalId).toBe('m1@ext.com');
    expect(r.emit.resolveInput).toMatchObject({ channel: 'gmail', email: 'bob@ext.com', sourceEntityType: 'gmail', sourceEntityId: 'm1@ext.com' });
    expect(r.emit.payload.gmailLink).toBe(`https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent('m1@ext.com')}`);
  });
  it('outbound: From is ours → customer = first external in To/Cc (Bcc for bcc-only)', () => {
    const r = mapMessage(msg({}, { From: 'info@ninescrolls.com', To: 'cust@acme.com' }), 'info@ninescrolls.com');
    if (r.kind !== 'emit') throw new Error('expected emit');
    expect(r.emit.direction).toBe('outbound');
    expect(r.emit.payload.customerEmail).toBe('cust@acme.com');
    const bccOnly = mapMessage(msg({}, { From: 'info@ninescrolls.com', To: 'info@ninescrolls.com', Bcc: 'hidden@ext.com' }), 'info@ninescrolls.com');
    if (bccOnly.kind !== 'emit') throw new Error('expected emit');
    expect(bccOnly.emit.payload.customerEmail).toBe('hidden@ext.com');
  });
  it('skips: all-internal; DRAFT/CHAT labels; non-customer alias (ap@); ZERO visible our-aliases (bcc-delivery); each with a reason', () => {
    expect(mapMessage(msg({}, { From: 'a@ninescrolls.com', To: 'b@ninescrolls.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'all_internal' });
    expect(mapMessage(msg({ labelIds: ['DRAFT'] }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'draft_or_chat' });
    expect(mapMessage(msg({}, { To: 'ap@ninescrolls.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'non_customer_alias' });
    expect(mapMessage(msg({}, { From: 'a@ext.com', To: 'b@ext.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'non_customer_alias' }); // reached us invisibly → unverifiable → skip
  });
  it('keep-if-ANY-recipient-is-customer-alias', () => {
    const r = mapMessage(msg({}, { To: 'ap@ninescrolls.com', Cc: 'sales@ninescrolls.com' }), 'info@ninescrolls.com');
    expect(r.kind).toBe('emit');
  });
  it('missing Message-ID → mailbox-namespaced fallback identity + THREAD link; both absent → externalUrl null', () => {
    const r = mapMessage(msg({}, { 'Message-ID': '' }), 'info@ninescrolls.com');
    if (r.kind !== 'emit') throw new Error('expected emit');
    expect(r.emit.idInput).toEqual({ source: 'gmail', mailbox: 'info@ninescrolls.com', gmailMessageId: 'g1' });
    expect(r.emit.externalId).toBe('info@ninescrolls.com:g1');
    expect(r.emit.payload.gmailLink).toBe('https://mail.google.com/mail/u/0/#all/th1');
    const noThread = mapMessage(msg({ threadId: undefined }, { 'Message-ID': '' }), 'info@ninescrolls.com');
    if (noThread.kind !== 'emit') throw new Error('expected emit');
    expect(noThread.emit.payload.gmailLink).toBeNull();
  });
});
