import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class { send = (...a: unknown[]) => send(...a); },
  InvokeCommand: class { constructor(public input: Record<string, unknown>) {} },
}));
import { emitTimelineEventToCrm, invokeCrmAction } from './invoke-crm-api';

const args = {
  source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
  occurredAt: '2026-06-19T10:00:00Z', summary: 'x',
  idInput: { kind: 'rfq_submitted', rfqId: 'rfq-1' },
  resolveInput: { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' },
} as never;

beforeEach(() => { send.mockReset(); process.env.CRM_API_FUNCTION_NAME = 'crm-fn'; });

describe('invokeCrmApi', () => {
  it('default is async Event invoke with the emitTimelineEvent action payload', async () => {
    send.mockResolvedValueOnce({ StatusCode: 202 });
    await emitTimelineEventToCrm(args);
    const input = send.mock.calls[0][0].input;
    expect(input.FunctionName).toBe('crm-fn');
    expect(input.InvocationType).toBe('Event');
    const payload = JSON.parse(new TextDecoder().decode(input.Payload));
    expect(payload.action).toBe('emitTimelineEvent');
    expect(payload.args.kind).toBe('rfq_submitted');
  });
  it('async path swallows + logs a dispatch failure (never throws into the business path)', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(emitTimelineEventToCrm(args)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
  it('sync mode uses RequestResponse and THROWS on invoke error (tests/backfill only)', async () => {
    send.mockRejectedValueOnce(new Error('boom'));
    await expect(emitTimelineEventToCrm(args, { sync: true })).rejects.toThrow(/boom/);
    expect(send.mock.calls[0][0].input.InvocationType).toBe('RequestResponse');
  });
  it('sync mode throws on a FunctionError result', async () => {
    send.mockResolvedValueOnce({ FunctionError: 'Unhandled', Payload: new TextEncoder().encode('{"errorMessage":"bad"}') });
    await expect(emitTimelineEventToCrm(args, { sync: true })).rejects.toThrow(/bad/);
  });
  it('sync-mode FunctionError carries the payload errorType as the error NAME (structured metadata for sanitizers)', async () => {
    send.mockResolvedValueOnce({ FunctionError: 'Unhandled', Payload: new TextEncoder().encode('{"errorType":"ValidationError","errorMessage":"bad"}') });
    await expect(emitTimelineEventToCrm(args, { sync: true })).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

describe('invokeCrmAction (generic direct-invoke)', () => {
  it('fires an async Event invoke with the raw action payload', async () => {
    send.mockResolvedValueOnce({ StatusCode: 202 });
    await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: 'v-1' });
    const input = send.mock.calls[0][0].input;
    expect(input.FunctionName).toBe('crm-fn');
    expect(input.InvocationType).toBe('Event');
    const payload = JSON.parse(new TextDecoder().decode(input.Payload));
    expect(payload).toEqual({ action: 'reResolveVisitorSessions', visitorId: 'v-1' });
  });
  it('swallows + logs dispatch failure (business path never blocked)', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: 'v-1' })).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('crm.action.dispatch_failed'));
    errSpy.mockRestore();
  });
  it('sync mode uses RequestResponse (order-path retry loops depend on observing execution)', async () => {
    send.mockResolvedValueOnce({ StatusCode: 200 });
    await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: 'v-1', maxSessions: 10 }, { sync: true });
    const input = send.mock.calls[0][0].input;
    expect(input.InvocationType).toBe('RequestResponse');
    expect(JSON.parse(new TextDecoder().decode(input.Payload)))
      .toEqual({ action: 'reResolveVisitorSessions', visitorId: 'v-1', maxSessions: 10 });
  });
  it('sync mode THROWS on SDK rejection', async () => {
    send.mockRejectedValueOnce(new Error('lambda unreachable'));
    await expect(invokeCrmAction({ action: 'reResolveVisitorSessions' }, { sync: true }))
      .rejects.toThrow('lambda unreachable');
  });
  it('sync mode THROWS on FunctionError with the remote errorMessage', async () => {
    send.mockResolvedValueOnce({
      FunctionError: 'Unhandled',
      Payload: new TextEncoder().encode('{"errorMessage":"retro exploded"}'),
    });
    await expect(invokeCrmAction({ action: 'reResolveVisitorSessions' }, { sync: true }))
      .rejects.toThrow('crm-api reResolveVisitorSessions error: retro exploded');
  });
});
