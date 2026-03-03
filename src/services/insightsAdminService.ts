import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface CreateInsightsPostInput {
  slug: string;
  title: string;
  content?: string | null;
  excerpt?: string | null;
  author: string;
  publishDate: string;
  category: string;
  readTime: number;
  imageUrl: string;
  tags?: string[];
  relatedProducts?: string | null;
  heroImages?: string | null;
  isStandaloneComponent?: boolean;
}

export interface UpdateInsightsPostInput extends CreateInsightsPostInput {
  id: string;
}

export async function createInsightsPost(input: CreateInsightsPostInput) {
  const { data, errors } = await client.models.InsightsPost.create(input, {
    authMode: 'userPool',
  });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateInsightsPost(input: UpdateInsightsPostInput) {
  const { data, errors } = await client.models.InsightsPost.update(input, {
    authMode: 'userPool',
  });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function deleteInsightsPost(id: string) {
  const { errors } = await client.models.InsightsPost.delete(
    { id },
    { authMode: 'userPool' }
  );
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
}

export async function fetchInsightsPostById(id: string) {
  const { data, errors } = await client.models.InsightsPost.get({ id });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
