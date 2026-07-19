import { getAmplifyDataClient } from './amplifyClient';

// Mirrors the Lambda whitelist projection (handler.ts projectPublicEvidence).
// No `slug`, no raw `meta` — those never cross the public boundary.
export interface PublishedEvidence {
  id: string;
  type: string;
  status?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  publishDate?: string | null;
  products?: string[] | null;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  publicSummary?: string | null;
}

/**
 * Public read of published Evidence. Pass a `productSlug` to scope to one product
 * line; omit it to read every published record (used by the homepage aggregate).
 * Never throws.
 */
export async function fetchPublishedEvidence(productSlug?: string): Promise<PublishedEvidence[]> {
  try {
    const { data, errors } = await getAmplifyDataClient().queries.listPublishedEvidence(
      { productSlug },
      { authMode: 'apiKey' }
    );
    if (errors || !data) return [];
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? (parsed as PublishedEvidence[]) : [];
  } catch {
    return [];
  }
}
