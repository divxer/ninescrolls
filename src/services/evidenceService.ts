import { getAmplifyDataClient } from './amplifyClient';

export interface PublishedEvidence {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary?: string | null;
  products: string[];
  process?: string | null;
  materials?: (string | null)[] | null;
  keywords?: (string | null)[] | null;
  metrics?: unknown;
  articleSlug?: string | null;
  pdfUrl?: string | null;
  images?: (string | null)[] | null;
  sourceUrl?: string | null;
  meta?: unknown;
  publishDate?: string | null;
  status: string;
}

/** Public read of published Evidence for a product. Never throws. */
export async function fetchPublishedEvidence(productSlug: string): Promise<PublishedEvidence[]> {
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
