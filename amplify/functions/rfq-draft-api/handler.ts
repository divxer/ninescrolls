import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDraft, getDraft, updateDraft, type DraftStoreDeps } from '../../lib/rfq/draftStore';
import { draftCreateSchema, draftPatchRequestSchema, normalizeDraftPatch } from '../../lib/rfq/draftContract';
import { parsePepperSecret } from './pepperProvider';

const ALLOWED_ORIGINS = [
  'https://ninescrolls.com',
  'https://www.ninescrolls.com',
  'http://localhost:5173',
];

export function allowedOrigin(origin?: string): string {
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

/** Case-insensitive header read (API Gateway lower-cases v2 but not always v1). */
export function header(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === target) return v;
  return undefined;
}

interface ApiResponse { statusCode: number; headers: Record<string, string>; body: string }

export function jsonResponse(
  statusCode: number, body: unknown, origin: string, opts: { credential?: boolean } = {},
): ApiResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,GET,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-RFQ-Draft-Create-Nonce,X-RFQ-Draft-Token',
    'Access-Control-Max-Age': '300',
  };
  if (opts.credential) {
    headers['Cache-Control'] = 'no-store';
    headers['Referrer-Policy'] = 'no-referrer';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

/** The single non-disclosing failure for missing/wrong-token/expired/non-draft. */
export function DRAFT_UNAVAILABLE_RESPONSE(origin: string): ApiResponse {
  return jsonResponse(404, { error: 'Draft unavailable' }, origin, { credential: true });
}

interface DraftEvent {
  requestContext?: { http?: { method?: string; path?: string; sourceIp?: string } };
  httpMethod?: string;
  rawPath?: string;
  path?: string;
  pathParameters?: { rfqId?: string } | null;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

const parseBody = (event: DraftEvent): unknown => {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return null; }
};

/** Build the handler from injected deps (unit-tested). The deployed entry supplies real deps. */
export function makeHandler(deps: DraftStoreDeps) {
  return async (event: DraftEvent): Promise<ApiResponse> => {
    const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';
    const path = event.requestContext?.http?.path ?? event.rawPath ?? event.path ?? '';
    const origin = allowedOrigin(header(event.headers, 'origin'));
    if (method === 'OPTIONS') return jsonResponse(200, {}, origin);
    const rfqId = event.pathParameters?.rfqId ?? path.split('/').filter(Boolean).pop();

    // POST /api/rfq/draft — create
    if (method === 'POST') {
      const nonce = header(event.headers, 'x-rfq-draft-create-nonce');
      const parsed = draftCreateSchema.safeParse(parseBody(event));
      if (!nonce || !parsed.success) return DRAFT_UNAVAILABLE_RESPONSE(origin);
      try {
        const r = await createDraft(deps, nonce, parsed.data);
        return jsonResponse(201, r, origin, { credential: true });
      } catch { return DRAFT_UNAVAILABLE_RESPONSE(origin); }
    }

    const token = header(event.headers, 'x-rfq-draft-token');
    if (!rfqId || !token) return DRAFT_UNAVAILABLE_RESPONSE(origin);

    // GET /api/rfq/draft/{rfqId}
    if (method === 'GET') {
      const r = await getDraft(deps, rfqId, token);
      if (!r.ok) return DRAFT_UNAVAILABLE_RESPONSE(origin);
      return jsonResponse(200, {
        fields: r.fields, draftVersion: r.draftVersion, expiresAt: r.expiresAt,
      }, origin, { credential: true });
    }

    // PATCH /api/rfq/draft/{rfqId}
    if (method === 'PATCH') {
      const body = parseBody(event) as { draftVersion?: unknown; patch?: unknown } | null;
      if (!body || typeof body.draftVersion !== 'number') return DRAFT_UNAVAILABLE_RESPONSE(origin);
      const parsed = draftPatchRequestSchema.safeParse(body.patch);
      if (!parsed.success) return jsonResponse(400, { error: 'Invalid draft fields' }, origin, { credential: true });
      const r = await updateDraft(deps, rfqId, token, body.draftVersion, normalizeDraftPatch(parsed.data));
      if (r.status === 'unavailable') return DRAFT_UNAVAILABLE_RESPONSE(origin);
      if (r.status === 'conflict') {
        return jsonResponse(409, { error: 'Version conflict', fields: r.fields, draftVersion: r.draftVersion }, origin, { credential: true });
      }
      return jsonResponse(200, {
        fields: r.status === 'updated' ? r.fields : undefined, draftVersion: r.draftVersion,
      }, origin, { credential: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  };
}

// --------------------------------------------------------------------------
// Deployed entry — resolves the pepper once per cold start, then delegates.
// --------------------------------------------------------------------------
let cached: ReturnType<typeof makeHandler> | undefined;
function deployed() {
  if (cached) return cached;
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const { pepper, keyVersion, resolvePepper } = parsePepperSecret(process.env.RFQ_DRAFT_PEPPER!);
  cached = makeHandler({
    send: (c) => doc.send(c as never) as Promise<{ Item?: Record<string, unknown> }>,
    tableName: process.env.INTELLIGENCE_TABLE!,
    pepper, keyVersion, resolvePepper,
    now: () => new Date().toISOString(),
  });
  return cached;
}

export const handler = (event: unknown) => deployed()(event as never);
