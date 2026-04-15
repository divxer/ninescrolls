import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { InsightsPost, ContentType } from '../types';

const client = generateClient<Schema>();

type DynamoInsightsPost = Schema['InsightsPost']['type'];

// ─── In-memory cache ─────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const listCache = new Map<string, CacheEntry<InsightsPost[]>>();
const slugCache = new Map<string, CacheEntry<InsightsPost | null>>();

function getCacheKey(options?: { includeDrafts?: boolean; contentType?: ContentType }): string {
  return `${options?.contentType ?? 'all'}_${options?.includeDrafts ? 'drafts' : 'published'}`;
}

function isExpired<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return true;
  return Date.now() - entry.timestamp > CACHE_TTL;
}

/** Invalidate all caches (call after create/update/delete) */
export function invalidateInsightsCache(): void {
  listCache.clear();
  slugCache.clear();
}

/** Synchronous cache read — returns cached data if still valid, undefined otherwise */
export function getCachedPosts(options?: { includeDrafts?: boolean; contentType?: ContentType }): InsightsPost[] | undefined {
  const entry = listCache.get(getCacheKey(options));
  return isExpired(entry) ? undefined : entry!.data;
}

export function getCachedPostBySlug(slug: string): InsightsPost | null | undefined {
  const entry = slugCache.get(slug);
  return isExpired(entry) ? undefined : entry!.data;
}

/** Fields to fetch when listing posts (excludes heavy `content` field) */
const LISTING_SELECTION_SET = [
  'id', 'slug', 'title', 'excerpt', 'author', 'publishDate',
  'category', 'readTime', 'imageUrl', 'tags', 'relatedProducts',
  'heroImages', 'isStandaloneComponent', 'isDraft', 'contentType',
] as const;

function mapToInsightsPost(item: DynamoInsightsPost): InsightsPost {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    content: item.content ?? undefined,
    excerpt: item.excerpt ?? undefined,
    author: item.author,
    publishDate: item.publishDate,
    category: item.category,
    readTime: item.readTime,
    imageUrl: item.imageUrl,
    tags: (item.tags as string[]) ?? [],
    relatedProducts: item.relatedProducts
      ? JSON.parse(typeof item.relatedProducts === 'string' ? item.relatedProducts : JSON.stringify(item.relatedProducts))
      : undefined,
    heroImages: item.heroImages
      ? JSON.parse(typeof item.heroImages === 'string' ? item.heroImages : JSON.stringify(item.heroImages))
      : undefined,
    isStandaloneComponent: item.isStandaloneComponent ?? undefined,
    isDraft: item.isDraft ?? undefined,
    contentType: (item.contentType as ContentType) ?? 'insight',
  };
}

export async function fetchAllInsightsPosts(options?: {
  includeDrafts?: boolean;
  contentType?: ContentType;
}): Promise<InsightsPost[]> {
  // Check cache first
  const cacheKey = getCacheKey(options);
  const cached = listCache.get(cacheKey);
  if (!isExpired(cached)) return cached!.data;

  const filterConditions: Record<string, any> = {};
  if (!options?.includeDrafts) {
    filterConditions.isDraft = { ne: true };
  }
  if (options?.contentType) {
    filterConditions.contentType = { eq: options.contentType };
  }
  const filter = Object.keys(filterConditions).length > 0 ? filterConditions : undefined;

  const firstPage = await client.models.InsightsPost.list({
    limit: 100,
    selectionSet: [...LISTING_SELECTION_SET],
    ...(filter ? { filter } : {}),
  });
  const allPosts: InsightsPost[] = (firstPage.data as DynamoInsightsPost[]).map(mapToInsightsPost);
  let cursor = firstPage.nextToken;

  while (cursor) {
    const page = await client.models.InsightsPost.list({
      limit: 100,
      selectionSet: [...LISTING_SELECTION_SET],
      nextToken: cursor,
      ...(filter ? { filter } : {}),
    });
    allPosts.push(...(page.data as DynamoInsightsPost[]).map(mapToInsightsPost));
    cursor = page.nextToken;
  }

  // Store in cache
  listCache.set(cacheKey, { data: allPosts, timestamp: Date.now() });
  return allPosts;
}

export async function fetchInsightsPostBySlug(slug: string): Promise<InsightsPost | null> {
  // Check cache first
  const cached = slugCache.get(slug);
  if (!isExpired(cached)) return cached!.data;

  const { data } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });

  const post = (!data || data.length === 0) ? null : mapToInsightsPost(data[0]);

  // Store in cache
  slugCache.set(slug, { data: post, timestamp: Date.now() });
  return post;
}

/**
 * Prefetch a post by slug — warms the cache without blocking UI.
 * Call on link hover / intersection for instant navigation.
 */
export function prefetchInsightsPost(slug: string): void {
  if (!isExpired(slugCache.get(slug))) return; // already cached
  fetchInsightsPostBySlug(slug).catch(() => {}); // fire-and-forget
}
