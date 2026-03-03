import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InsightsForm, type InsightsFormData } from '../../components/admin/InsightsForm';
import {
  createInsightsPost,
  updateInsightsPost,
  fetchInsightsPostById,
} from '../../services/insightsAdminService';
import { fetchInsightsPostBySlug } from '../../services/insightsService';
import type { InsightsPost } from '../../types';

export function AdminInsightsFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [initialData, setInitialData] = useState<InsightsPost | null>(null);
  const [loading, setLoading] = useState(isEdit);
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
          heroImages: data.heroImages
            ? JSON.parse(
                typeof data.heroImages === 'string'
                  ? data.heroImages
                  : JSON.stringify(data.heroImages)
              )
            : undefined,
          isStandaloneComponent: data.isStandaloneComponent ?? undefined,
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
        heroImages: formData.heroImages || null,
        isStandaloneComponent: formData.isStandaloneComponent,
      };

      if (isEdit && id) {
        await updateInsightsPost({ ...input, id });
      } else {
        await createInsightsPost(input);
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
      <h1>{isEdit ? 'Edit Article' : 'New Article'}</h1>
      {submitError && <div className="admin-error">{submitError}</div>}
      <InsightsForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
