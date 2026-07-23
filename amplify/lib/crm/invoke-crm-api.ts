import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { CrmEmitPayload, EmitArgs } from './types';

const lambda = new LambdaClient({});
const FUNCTION_NAME = () => process.env.CRM_API_FUNCTION_NAME!;

/**
 * Invoke crm-api. Default is async `Event` (fire-and-forget): a 202 means Lambda ACCEPTED the
 * event for delivery — NOT that the CRM projection succeeded. Projection failures are observed via
 * crm-api logs / AWS async retries / the 2C reconciliation sweep, never by the caller. Dispatch
 * failures on the async path are logged and swallowed so a business mutation is never blocked.
 *
 * `{ sync: true }` (tests / backfill-debug ONLY, never on the business path) uses RequestResponse
 * and throws on invoke or FunctionError so the caller can observe failure.
 */
export async function invokeCrmApi(payload: CrmEmitPayload, opts?: { sync?: boolean }): Promise<void> {
  const sync = opts?.sync ?? false;
  try {
    const res = await lambda.send(new InvokeCommand({
      FunctionName: FUNCTION_NAME(),
      InvocationType: sync ? 'RequestResponse' : 'Event',
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
    if (sync && res.FunctionError) {
      const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
      const parsed = text ? JSON.parse(text) : null;
      const err = new Error(`crm-api error: ${parsed?.errorMessage ?? res.FunctionError}`);
      // Carry the Lambda error payload's errorType as the error NAME — structured metadata that
      // downstream sanitizers (gmail-sync sanitizeDiagnostic) can allowlist without ever
      // forwarding the prose message.
      if (typeof parsed?.errorType === 'string' && parsed.errorType) err.name = parsed.errorType;
      throw err;
    }
  } catch (err) {
    if (sync) throw err;
    // async business path: log + swallow — the source write already committed; the sweep heals.
    console.error(JSON.stringify({
      event: 'crm.emit.dispatch_failed',
      kind: payload.args.kind,
      sourceEntityType: payload.args.sourceEntityType,
      sourceEntityId: payload.args.sourceEntityId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

export async function emitTimelineEventToCrm(args: EmitArgs, opts?: { sync?: boolean }): Promise<void> {
  return invokeCrmApi({ action: 'emitTimelineEvent', args }, opts);
}

/**
 * Generic async action invoke (fire-and-forget, Event). Same contract as invokeCrmApi: a dispatch
 * failure is logged and swallowed — the business mutation is never blocked. Used for non-emit
 * actions (e.g. reResolveVisitorSessions); emit stays on the typed emitTimelineEventToCrm path.
 */
export async function invokeCrmAction(payload: { action: string } & Record<string, unknown>): Promise<void> {
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: FUNCTION_NAME(),
      InvocationType: 'Event',
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: 'crm.action.dispatch_failed', action: payload.action,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}
