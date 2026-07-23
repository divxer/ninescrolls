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
      throw new Error(`crm-api error: ${parsed?.errorMessage ?? res.FunctionError}`);
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
 * Generic action invoke. Default is async `Event` (fire-and-forget) with the invokeCrmApi
 * contract: a dispatch failure is logged and swallowed — a user-facing business mutation is
 * never blocked. Used for non-emit actions (e.g. reResolveVisitorSessions); emit stays on the
 * typed emitTimelineEventToCrm path.
 *
 * `{ sync: true }` uses RequestResponse and THROWS on invoke failure or FunctionError. For
 * callers whose transport has its own durable retry loop (the Stripe webhook's 500→retry →
 * duplicate-path self-heal) — a swallowed reResolve failure there would close the retry window
 * silently. Never use sync on a user-facing form path.
 */
export async function invokeCrmAction(
  payload: { action: string } & Record<string, unknown>,
  opts?: { sync?: boolean },
): Promise<void> {
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
      throw new Error(`crm-api ${payload.action} error: ${parsed?.errorMessage ?? res.FunctionError}`);
    }
  } catch (err) {
    if (sync) throw err;
    console.error(JSON.stringify({
      event: 'crm.action.dispatch_failed', action: payload.action,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}
