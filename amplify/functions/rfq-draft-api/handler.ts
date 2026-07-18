import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDraft, getDraft, updateDraft, type DraftStoreDeps } from '../../lib/rfq/draftStore';
import { draftCreateSchema, draftPatchRequestSchema, normalizeDraftPatch } from '../../lib/rfq/draftContract';
import { parsePepperSecret } from './pepperProvider';
import { createRateLimiter } from './rateLimiter';
import { decodeCredential } from '../../lib/rfq/draftCredentials';

const ALLOWED_ORIGINS = [
  'https://ninescrolls.com',
  'https://www.ninescrolls.com',
  'http://localhost:5173',
];

export function allowedOrigin(origin?: string): string | undefined {
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : undefined;
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
  statusCode: number, body: unknown, origin?: string,
): ApiResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST,GET,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-RFQ-Draft-Create-Nonce,X-RFQ-Draft-Token',
    'Access-Control-Max-Age': '300',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  headers['Cache-Control'] = 'no-store';
  headers['Referrer-Policy'] = 'no-referrer';
  return { statusCode, headers, body: JSON.stringify(body) };
}

/** The single non-disclosing failure for missing/wrong-token/expired/non-draft. */
export function DRAFT_UNAVAILABLE_RESPONSE(origin?: string): ApiResponse {
  return jsonResponse(404, { error: 'Draft unavailable' }, origin);
}

interface DraftEvent {
  requestContext?: { http?: { method?: string; path?: string; sourceIp?: string }; identity?: { sourceIp?: string } };
  httpMethod?: string;
  rawPath?: string;
  path?: string;
  pathParameters?: { rfqId?: string } | null;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

const MAX_BODY_BYTES = 16 * 1024;
const parseBody = (event: DraftEvent): { ok: true; value: unknown } | { ok: false } => {
  const contentType = header(event.headers, 'content-type');
  if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) return { ok: false };
  let raw = event.body ?? '';
  if (event.isBase64Encoded) {
    const encoded = raw;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) return { ok: false };
    try {
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return { ok: false };
      raw = bytes.toString('utf8');
    } catch { return { ok: false }; }
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { ok: false };
  try { return { ok: true, value: raw ? JSON.parse(raw) : {} }; } catch { return { ok: false }; }
};

type RateLimit = (sourceIp: string, rateClass: 'create' | 'access') => Promise<boolean>;
interface HandlerDeps extends DraftStoreDeps { rateLimit?: RateLimit }
const retryResponse = (origin?: string) => jsonResponse(503, { error: 'Service temporarily unavailable' }, origin);

/** Build the handler from injected deps (unit-tested). The deployed entry supplies real deps. */
export function makeHandler(deps: HandlerDeps) {
  return async (event: DraftEvent): Promise<ApiResponse> => {
    const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';
    const path = event.requestContext?.http?.path ?? event.rawPath ?? event.path ?? '';
    const origin = allowedOrigin(header(event.headers, 'origin'));
    if (!origin) return jsonResponse(403, { error: 'Origin not allowed' });
    if (method === 'OPTIONS') return jsonResponse(204, {}, origin);
    const rfqId = event.pathParameters?.rfqId ?? path.split('/').filter(Boolean).pop();
    const sourceIp = event.requestContext?.http?.sourceIp ?? event.requestContext?.identity?.sourceIp ?? 'unknown';
    const checkRate = deps.rateLimit ?? (async () => true);

    // POST /api/rfq/draft — create
    if (method === 'POST') {
      try { if (!await checkRate(sourceIp, 'create')) return jsonResponse(429, { error: 'Too many requests' }, origin); }
      catch { return retryResponse(origin); }
      const nonce = header(event.headers, 'x-rfq-draft-create-nonce');
      try { if (!nonce) throw new Error(); else decodeCredential(nonce); }
      catch { return DRAFT_UNAVAILABLE_RESPONSE(origin); }
      const body = parseBody(event);
      const parsed = body.ok ? draftCreateSchema.safeParse(body.value) : undefined;
      if (!parsed?.success) return jsonResponse(400, { error: 'Invalid request' }, origin);
      try {
        const r = await createDraft(deps, nonce, parsed.data);
        return jsonResponse(201, r, origin);
      } catch (error) {
        if ((error as { name?: string }).name === 'InvalidCredentialError') return jsonResponse(400, { error: 'Invalid request' }, origin);
        return retryResponse(origin);
      }
    }

    const token = header(event.headers, 'x-rfq-draft-token');
    if (!rfqId || !token) return DRAFT_UNAVAILABLE_RESPONSE(origin);
    if (method !== 'GET' && method !== 'PATCH') return jsonResponse(405, { error: 'Method not allowed' }, origin);

    let authenticated;
    try { authenticated = await getDraft(deps, rfqId, token); } catch { return retryResponse(origin); }
    if (!authenticated.ok) return DRAFT_UNAVAILABLE_RESPONSE(origin);
    try { if (!await checkRate(sourceIp, 'access')) return jsonResponse(429, { error: 'Too many requests' }, origin); }
    catch { return retryResponse(origin); }

    // GET /api/rfq/draft/{rfqId}
    if (method === 'GET') {
      return jsonResponse(200, {
        fields: authenticated.fields, draftVersion: authenticated.draftVersion, expiresAt: authenticated.expiresAt,
      }, origin);
    }

    // PATCH /api/rfq/draft/{rfqId}
    if (method === 'PATCH') {
      // Authenticate before parsing transport or fields so bad tokens always get the
      // same non-disclosing response (and exercise the store's dummy verifier).
      const decoded = parseBody(event);
      if (!decoded.ok || !decoded.value || typeof decoded.value !== 'object') return jsonResponse(400, { error: 'Invalid request' }, origin);
      const body = decoded.value as { draftVersion?: unknown; patch?: unknown };
      if (!Number.isSafeInteger(body.draftVersion) || (body.draftVersion as number) < 1) return jsonResponse(400, { error: 'Invalid request' }, origin);
      const parsed = draftPatchRequestSchema.safeParse(body.patch);
      if (!parsed.success) return jsonResponse(400, { error: 'Invalid draft fields' }, origin);
      let r;
      try { r = await updateDraft(deps, rfqId, token, body.draftVersion as number, normalizeDraftPatch(parsed.data)); }
      catch { return retryResponse(origin); }
      if (r.status === 'unavailable') return DRAFT_UNAVAILABLE_RESPONSE(origin);
      if (r.status === 'conflict') {
        return jsonResponse(409, { error: 'Version conflict', draft: r.fields, draftVersion: r.draftVersion }, origin);
      }
      return jsonResponse(200, {
        fields: r.status === 'updated' ? r.fields : undefined, draftVersion: r.draftVersion,
      }, origin);
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
  const send = (c: unknown) => doc.send(c as never) as Promise<{ Item?: Record<string, unknown> }>;
  const rateLimit = createRateLimiter({ send, tableName: process.env.INTELLIGENCE_TABLE! });
  cached = makeHandler({
    send,
    tableName: process.env.INTELLIGENCE_TABLE!,
    pepper, keyVersion, resolvePepper,
    now: () => new Date().toISOString(), rateLimit,
  });
  return cached;
}

export const handler = (event: unknown) => deployed()(event as never);
