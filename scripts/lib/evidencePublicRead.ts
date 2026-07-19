// scripts/lib/evidencePublicRead.ts
// Raw apiKey GraphQL for the PUBLIC evidence read boundary, shared by the live
// acceptance scripts (verify-evidence-no-oem, verify-evidence-boundary).
//
// Why raw graphql() instead of the typed client.queries.listPublishedEvidence /
// client.models.Evidence.list accessors: those accessors only exist when the
// local amplify_outputs.json model introspection is current. The committed copy
// is frequently stale (it predates the Evidence model), which made the typed
// call crash with "anon.queries.listPublishedEvidence is not a function" during
// a prod rollout. A raw graphql() call needs only the endpoint + apiKey from
// amplify_outputs.json — both present even in a stale copy — so it is robust to
// that drift. This mirrors how the seeders (evidenceSeedOperations.ts) already
// talk to the API.
import type { EvidenceGraphqlClient } from './evidenceSeedOperations';

// The public, published-only projection. Task-specified shape: a single JSON
// argument+return, so a stale outputs never changes what we send over the wire.
export const LIST_PUBLISHED_EVIDENCE_QUERY =
  'query($productSlug:String){ listPublishedEvidence(productSlug:$productSlug) }';

// Minimal base-model list, used ONLY to assert the anonymous (apiKey) read is
// DENIED by authorization. limit:1 keeps the expected-to-fail call cheap.
export const LIST_BASE_EVIDENCE_QUERY =
  'query{ listEvidences(limit:1){ items{ id } } }';

export interface GraphqlError {
  errorType?: string;
  message?: string;
}

/**
 * Amplify's raw graphql() REJECTS with the GraphQL result (`{ data, errors }`)
 * on an error response, while the seeder-style unit-test mocks RESOLVE with the
 * same shape. Normalize both — plus a genuine transport error (no `errors`) — to
 * a GraphqlError[].
 */
function errorsFrom(value: unknown): GraphqlError[] {
  const errors = (value as { errors?: unknown } | null | undefined)?.errors;
  return Array.isArray(errors) ? (errors as GraphqlError[]) : [];
}

/**
 * True only for an AppSync *authorization* denial — never a schema/resolver/
 * transport error that merely happens to be an error. AppSync surfaces auth
 * failures with errorType 'Unauthorized' (occasionally 'UnauthorizedException');
 * the message match is a fallback for deployments whose error shape lacks
 * errorType.
 */
export function isAuthorizationDenial(error: GraphqlError): boolean {
  return (
    error.errorType === 'Unauthorized' ||
    error.errorType === 'UnauthorizedException' ||
    /not\s*authorized|unauthorized/i.test(error.message ?? '')
  );
}

export interface PublishedEvidencePayload {
  /** The published JSON array in string form — for whole-payload token scans. */
  raw: string;
  /** The same payload parsed into an array of records. */
  records: Array<Record<string, unknown>>;
}

/**
 * Read published Evidence for a product (or every published record when
 * productSlug is omitted) over the public apiKey path via raw GraphQL. Throws on
 * GraphQL errors or a null / non-array payload, so callers may treat any of
 * those as a hard failure rather than an empty result.
 */
export async function readPublishedEvidence(
  client: EvidenceGraphqlClient,
  productSlug?: string,
): Promise<PublishedEvidencePayload> {
  const label = productSlug ?? 'ALL';
  let result: unknown;
  try {
    result = await client.graphql({
      query: LIST_PUBLISHED_EVIDENCE_QUERY,
      variables: { productSlug: productSlug ?? null },
      authMode: 'apiKey',
    });
  } catch (err) {
    const messages = errorsFrom(err).map((e) => e.message).filter(Boolean);
    const detail = messages.length ? messages.join(', ') : (err as Error).message ?? JSON.stringify(err);
    throw new Error(`listPublishedEvidence(${label}) errored: ${detail}`);
  }
  const errors = errorsFrom(result);
  if (errors.length) {
    throw new Error(`listPublishedEvidence(${label}) errored: ${errors.map((e) => e.message).join(', ')}`);
  }
  const value = (result as { data?: { listPublishedEvidence?: unknown } } | null)?.data?.listPublishedEvidence;
  if (value == null) {
    // A null/absent payload is a failure, not an empty set: the resolver ran but
    // returned nothing, which the callers must never mistake for "0 published".
    throw new Error(`listPublishedEvidence(${label}) returned no data (null payload)`);
  }
  // AWSJSON comes back as a JSON string; a data client may hand back the parsed
  // value. Accept both, re-stringify the parsed form for the token scan.
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  let records: unknown;
  try {
    records = JSON.parse(raw);
  } catch {
    throw new Error(`listPublishedEvidence(${label}) returned a non-JSON payload: ${raw}`);
  }
  if (!Array.isArray(records)) {
    throw new Error(`listPublishedEvidence(${label}) returned a non-array payload: ${raw}`);
  }
  return { raw, records: records as Array<Record<string, unknown>> };
}

/**
 * Assert the base Evidence model is NOT publicly readable via apiKey, and that
 * the failure is specifically an AUTHORIZATION denial (not a schema/resolver/
 * transport error mistaken for one). Returns the denial message on success.
 */
export async function assertBaseEvidenceReadDenied(
  client: EvidenceGraphqlClient,
): Promise<string> {
  let errors: GraphqlError[];
  try {
    const result = await client.graphql({
      query: LIST_BASE_EVIDENCE_QUERY,
      authMode: 'apiKey',
    });
    // Reaching here without a throw AND without errors means the anonymous read
    // SUCCEEDED — the base model is publicly readable.
    errors = errorsFrom(result);
  } catch (err) {
    errors = errorsFrom(err);
    if (errors.length === 0) throw err; // genuine transport error — surface it as-is
  }
  if (errors.length === 0) {
    throw new Error('SECURITY FAIL: base Evidence model is publicly readable via apiKey');
  }
  const denial = errors.find(isAuthorizationDenial);
  if (!denial) {
    throw new Error(
      `SECURITY FAIL: expected an authorization denial on the base model, got: ${JSON.stringify(errors)}`,
    );
  }
  return denial.message ?? '';
}
