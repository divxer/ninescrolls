import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { InsightsPost, ContentType } from '../types';

const client = generateClient<Schema>();

type DynamoInsightsPost = Schema['InsightsPost']['type'];

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
    ...(filter ? { filter } : {}),
  });
  const allPosts: InsightsPost[] = firstPage.data.map(mapToInsightsPost);
  let cursor = firstPage.nextToken;

  while (cursor) {
    const page = await client.models.InsightsPost.list({
      limit: 100,
      nextToken: cursor,
      ...(filter ? { filter } : {}),
    });
    allPosts.push(...page.data.map(mapToInsightsPost));
    cursor = page.nextToken;
  }

  return allPosts;
}

export async function fetchInsightsPostBySlug(slug: string): Promise<InsightsPost | null> {
  const { data } = await client.models.InsightsPost.listInsightsPostBySlug({ slug });

  if (!data || data.length === 0) return null;
  return mapToInsightsPost(data[0]);
}
