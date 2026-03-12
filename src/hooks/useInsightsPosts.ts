import { useState, useEffect } from 'react';
import type { InsightsPost } from '../types';
import { fetchAllInsightsPosts, fetchInsightsPostBySlug } from '../services/insightsService';

export function useInsightsPosts(options?: { includeDrafts?: boolean }) {
  const [posts, setPosts] = useState<InsightsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

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
  }, []);

  return { posts, loading, error };
}

export function useInsightsPost(slug: string | undefined) {
  const [post, setPost] = useState<InsightsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
