import { getAmplifyDataClient } from './amplifyClient';
import { EVIDENCE_STATUS, hasPayload } from '../config/evidence';
import type { Schema } from '../../amplify/data/resource';

const client = getAmplifyDataClient;

type DynamoEvidence = Schema['Evidence']['type'];

// Mirrors Amplify's generated JSON scalar type (a.json()) — see metrics/meta
// on the Evidence model in amplify/data/resource.ts.
type EvidenceJson = string | number | boolean | object | unknown[] | null;

export interface EvidenceInput {
  slug: string;
  title: string;
  type: string;
  summary?: string | null;
  products: string[];
  process?: string | null;
  materials?: string[] | null;
  keywords?: string[] | null;
  metrics?: EvidenceJson;
  articleSlug?: string | null;
  pdfUrl?: string | null;
  images?: string[] | null;
  sourceUrl?: string | null;
  meta?: EvidenceJson;
  publishDate?: string | null;
  status: string;
}
export interface EvidenceUpdateInput extends EvidenceInput {
  id: string;
}

function assertPayload(input: EvidenceInput) {
  if (!hasPayload(input)) {
    throw new Error(
      'Evidence needs at least one payload/target: a non-blank articleSlug, pdfUrl, or sourceUrl, or a non-empty images array.'
    );
  }
}

// Recursive rather than a `let`-reassigning loop: passing nextToken as a
// fresh parameter on each call avoids a TS7022 circular-inference error that
// otherwise arises from reassigning a loop variable that also feeds into the
// same generic call's argument type.
async function assertSlugFreePage(slug: string, ignoreId: string | undefined, token: string | undefined): Promise<void> {
  const result = await client().models.Evidence.listEvidenceBySlug(
    { slug },
    { authMode: 'userPool', nextToken: token }
  );
  if ((result.data ?? []).some((r: { id: string }) => r.id !== ignoreId)) {
    throw new Error(`Evidence slug "${slug}" already exists — choose a unique slug.`);
  }
  if (result.nextToken) {
    await assertSlugFreePage(slug, ignoreId, result.nextToken);
  }
}

async function assertSlugFree(slug: string, ignoreId?: string) {
  await assertSlugFreePage(slug, ignoreId, undefined);
}

function withPublishDate<T extends { status: string; publishDate?: string | null }>(input: T): T {
  if (input.status === EVIDENCE_STATUS.PUBLISHED && !input.publishDate) {
    return { ...input, publishDate: new Date().toISOString() };
  }
  return input;
}

/**
 * a.json() fields (AWSJSON) MUST be sent as JSON *strings*, not raw arrays /
 * objects — AppSync rejects a raw value with "Variable 'X' has an invalid
 * value". Empty or absent → null. Mirrors the InsightsPost relatedProducts /
 * heroImages / faqs convention. The read side parses back (the edit form
 * accepts either a string or an already-parsed value).
 */
function toJsonField(v: EvidenceJson | undefined): string | null {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return JSON.stringify(v);
}

function serializeJsonFields<T extends EvidenceInput>(input: T) {
  return { ...input, metrics: toJsonField(input.metrics), meta: toJsonField(input.meta) };
}

export async function createEvidence(input: EvidenceInput) {
  assertPayload(input);
  await assertSlugFree(input.slug);
  const { data, errors } = await client().models.Evidence.create(
    serializeJsonFields(withPublishDate(input)),
    { authMode: 'userPool' }
  );
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateEvidence(input: EvidenceUpdateInput) {
  assertPayload(input);
  await assertSlugFree(input.slug, input.id);
  const { data, errors } = await client().models.Evidence.update(
    serializeJsonFields(withPublishDate(input)),
    { authMode: 'userPool' }
  );
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function deleteEvidence(id: string) {
  const { errors } = await client().models.Evidence.delete({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
}

/** Status-only update (e.g. bulk archive). Skips slug/payload re-validation. */
export async function setEvidenceStatus(id: string, status: string) {
  const { data, errors } = await client().models.Evidence.update({ id, status }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

async function listEvidencePage(token: string | undefined, acc: DynamoEvidence[]): Promise<DynamoEvidence[]> {
  const result = await client().models.Evidence.list({ authMode: 'userPool', nextToken: token });
  if (result.errors) throw new Error(result.errors.map((e: { message: string }) => e.message).join(', '));
  const combined = result.data ? acc.concat(result.data) : acc;
  return result.nextToken ? listEvidencePage(result.nextToken, combined) : combined;
}

export async function listAllEvidence(): Promise<DynamoEvidence[]> {
  return listEvidencePage(undefined, []);
}

export async function getEvidence(id: string) {
  const { data, errors } = await client().models.Evidence.get({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
