import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class { send = (...a: unknown[]) => send(...a); },
  InvokeCommand: class { constructor(public input: Record<string, unknown>) {} },
}));
import { invokeCrmApi, emitTimelineEventToCrm } from './invoke-crm-api';

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
});
