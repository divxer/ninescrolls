import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { InsightsForm, type InsightsFormData } from '../../components/admin/InsightsForm';
import {
  createInsightsPost,
  updateInsightsPost,
  fetchInsightsPostById,
} from '../../services/insightsAdminService';
import { fetchInsightsPostBySlug } from '../../services/insightsService';
import type { InsightsPost, ContentType } from '../../types';

const INDEXNOW_KEY = 'b8f4e2a1c7d94f3e8a6b0c5d7e9f1a2b';
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.ninescrolls.com';

function pingIndexNow(url: string) {
  fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'ninescrolls.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://ninescrolls.com/${INDEXNOW_KEY}.txt`,
      urlList: [url],
    }),
  }).catch(() => {}); // fire-and-forget
}

function regenerateSitemaps() {
  fetch(`${API_BASE}/generate-sitemaps`, { method: 'POST' }).catch(() => {}); // fire-and-forget
}

export function AdminInsightsFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fromId = searchParams.get('from');
  const typeParam = searchParams.get('type') as ContentType | null;
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [initialData, setInitialData] = useState<InsightsPost | null>(null);
  const [loading, setLoading] = useState(isEdit || Boolean(fromId));
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchInsightsPostById(id!);
        if (cancelled) return;
        if (!data) {
          setLoadError('Article not found');
          return;
        }

        setInitialData({
          id: data.id,
          slug: data.slug,
          title: data.title,
          content: data.content ?? undefined,
          excerpt: data.excerpt ?? undefined,
          author: data.author,
          publishDate: data.publishDate,
          category: data.category,
          readTime: data.readTime,
          imageUrl: data.imageUrl,
          tags: (data.tags as string[]) ?? [],
          relatedProducts: data.relatedProducts
            ? JSON.parse(
                typeof data.relatedProducts === 'string'
                  ? data.relatedProducts
                  : JSON.stringify(data.relatedProducts)
              )
            : undefined,
          isStandaloneComponent: data.isStandaloneComponent ?? undefined,
          isDraft: data.isDraft ?? undefined,
          contentType: (data.contentType as ContentType) ?? 'insight',
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load article');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Set default contentType for new articles based on URL param
  useEffect(() => {
    if (!isEdit && !fromId && typeParam === 'news') {
      setInitialData({
        id: '',
        slug: '',
        title: '',
        author: 'NineScrolls Team',
        publishDate: new Date().toISOString().split('T')[0],
        category: 'Industry',
        readTime: 3,
        imageUrl: '',
        tags: [],
        contentType: 'news',
      });
    }
  }, [isEdit, fromId, typeParam]);

  // Duplicate article: load source and prepare as new
  useEffect(() => {
    if (!fromId || isEdit) return;
    let cancelled = false;

    async function loadSource() {
      setLoading(true);
      try {
        const data = await fetchInsightsPostById(fromId!);
        if (cancelled || !data) return;

        const today = new Date().toISOString().split('T')[0];
        setInitialData({
          id: '', // not editing — will create new
          slug: `${data.slug}-copy`,
          title: data.title,
          content: data.content ?? undefined,
          excerpt: data.excerpt ?? undefined,
          author: data.author,
          publishDate: today,
          category: data.category,
          readTime: data.readTime,
          imageUrl: data.imageUrl,
          tags: (data.tags as string[]) ?? [],
          relatedProducts: data.relatedProducts
            ? JSON.parse(
                typeof data.relatedProducts === 'string'
                  ? data.relatedProducts
                  : JSON.stringify(data.relatedProducts)
              )
            : undefined,
          isStandaloneComponent: data.isStandaloneComponent ?? undefined,
          contentType: (data.contentType as 'insight' | 'news') ?? 'insight',
          isDraft: true, // duplicates start as drafts
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load source article');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSource();
    return () => { cancelled = true; };
  }, [fromId, isEdit]);

  async function handleSubmit(formData: InsightsFormData) {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Check slug uniqueness (skip for edit if slug unchanged)
      if (!isEdit || (initialData && formData.slug !== initialData.slug)) {
        const existing = await fetchInsightsPostBySlug(formData.slug);
        if (existing && existing.id !== id) {
          setSubmitError(`Slug "${formData.slug}" is already in use by another article.`);
          setIsSubmitting(false);
          return;
        }
      }

      const input = {
        slug: formData.slug,
        title: formData.title,
        content: formData.content || null,
        excerpt: formData.excerpt || null,
        author: formData.author,
        publishDate: formData.publishDate,
        category: formData.category,
        readTime: formData.readTime,
        imageUrl: formData.imageUrl,
        tags: formData.tags,
        relatedProducts: formData.relatedProducts || null,
        isStandaloneComponent: formData.isStandaloneComponent,
        isDraft: formData.isDraft,
        contentType: formData.contentType,
      };

      if (isEdit && id) {
        await updateInsightsPost({ ...input, id });
      } else {
        await createInsightsPost(input);
      }

      // When publishing (not draft), update sitemaps and notify search engines
      if (!formData.isDraft) {
        regenerateSitemaps();
        if (formData.contentType === 'news') {
          pingIndexNow(`https://ninescrolls.com/news/${formData.slug}`);
        }
      }

      navigate('/admin/insights');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="admin-loading">Loading article...</div>;
  }

  if (loadError) {
    return <div className="admin-error">Error: {loadError}</div>;
  }

  return (
    <div className="admin-insights-form-page">
      <h1>{isEdit ? 'Edit Article' : fromId ? 'Duplicate Article' : 'New Article'}</h1>
      {submitError && <div className="admin-error">{submitError}</div>}
      <InsightsForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
