// AI Article Metadata Generation Service
// Calls the /generate-article-meta Lambda to get Claude-powered excerpt & tags

import outputs from '../../amplify_outputs.json';

export interface ArticleMeta {
  excerpt: string;
  tags: string[];
}

function getApiEndpoint(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

function getAdminToken(): string {
  return import.meta.env.VITE_ADMIN_API_SECRET || '';
}

export async function generateArticleMeta(
  title: string,
  content: string,
  category: string,
): Promise<ArticleMeta> {
  const apiEndpoint = getApiEndpoint();
  const response = await fetch(`${apiEndpoint}/generate-article-meta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      category,
      adminToken: getAdminToken(),
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error || `API error ${response.status}`);
  }

  return response.json();
}
