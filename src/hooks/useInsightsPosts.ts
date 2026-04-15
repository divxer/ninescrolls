import { useState, useEffect } from 'react';
import type { InsightsPost, ContentType } from '../types';
import {
  fetchAllInsightsPosts,
  fetchInsightsPostBySlug,
  getCachedPosts,
  getCachedPostBySlug,
} from '../services/insightsService';

export function useInsightsPosts(options?: {
  includeDrafts?: boolean;
  contentType?: ContentType;
}) {
  // Initialise from cache synchronously — avoids loading flash on repeat visits
  const cached = getCachedPosts(options);

  const [posts, setPosts] = useState<InsightsPost[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // If we already have cached data, skip loading state
    const alreadyCached = getCachedPosts(options);
    if (alreadyCached) {
      setPosts(alreadyCached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchAllInsightsPosts(options)
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [options?.contentType, options?.includeDrafts]);

  return { posts, loading, error };
}

export function useInsightsPost(slug: string | undefined) {
  // Initialise from cache synchronously
  const cached = slug ? getCachedPostBySlug(slug) : undefined;

  const [post, setPost] = useState<InsightsPost | null>(cached ?? null);
  const [loading, setLoading] = useState(slug ? !cached : false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const alreadyCached = getCachedPostBySlug(slug);
    if (alreadyCached !== undefined) {
      setPost(alreadyCached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchInsightsPostBySlug(slug)
      .then((data) => {
        if (!cancelled) {
          setPost(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { post, loading, error };
}

// Convenience hooks for News content
export function useNewsPosts(options?: { includeDrafts?: boolean }) {
  return useInsightsPosts({ ...options, contentType: 'news' });
}

export function useNewsPost(slug: string | undefined) {
  return useInsightsPost(slug);
}
