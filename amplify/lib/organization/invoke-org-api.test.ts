import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    InvokeCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('ORGANIZATION_API_FUNCTION_NAME', 'organization-api-test');

beforeEach(() => {
    mockSend.mockReset();
});

describe('invokeOrganizationApi', () => {
    it('sends RequestResponse invocation and parses response payload', async () => {
        const responsePayload = { matchedOrgId: 'stanford.edu' };
        mockSend.mockResolvedValueOnce({
            Payload: new TextEncoder().encode(JSON.stringify(responsePayload)),
            FunctionError: undefined,
        });

        const { invokeOrganizationApi } = await import('./invoke-org-api');
        const result = await invokeOrganizationApi({
            action: 'upsertFromSubmission',
            source: 'rfq',
            email: 'harvey@stanford.edu',
            submittedAt: '2026-05-16T00:00:00Z',
            scoreDelta: 8,
        });

        expect(result).toEqual(responsePayload);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.FunctionName).toBe('organization-api-test');
        expect(cmd.input.InvocationType).toBe('RequestResponse');
        const payload = JSON.parse(new TextDecoder().decode(cmd.input.Payload));
        expect(payload.action).toBe('upsertFromSubmission');
    });

    it('throws when FunctionError is set', async () => {
        mockSend.mockResolvedValueOnce({
            Payload: new TextEncoder().encode(JSON.stringify({ errorMessage: 'boom' })),
            FunctionError: 'Unhandled',
        });

        const { invokeOrganizationApi } = await import('./invoke-org-api');
        await expect(invokeOrganizationApi({
            action: 'upsertFromSubmission', source: 'rfq', email: 'a@b.com', submittedAt: '', scoreDelta: 0,
        })).rejects.toThrow(/boom|Unhandled/);
    });
});
