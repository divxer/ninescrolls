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
