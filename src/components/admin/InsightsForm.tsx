import { useState, useEffect } from 'react';
import { RichTextEditor } from './RichTextEditor';
import type { InsightsPost } from '../../types';

const CATEGORIES = ['Materials Science', 'Photonics', 'Nanotechnology', 'Energy'];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

interface InsightsFormProps {
  initialData?: InsightsPost | null;
  onSubmit: (data: InsightsFormData) => Promise<void>;
  isSubmitting: boolean;
}

export interface InsightsFormData {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  author: string;
  publishDate: string;
  category: string;
  readTime: number;
  imageUrl: string;
  tags: string[];
  relatedProducts: string;
  heroImages: string;
  isStandaloneComponent: boolean;
}

export function InsightsForm({ initialData, onSubmit, isSubmitting }: InsightsFormProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [author, setAuthor] = useState('NineScrolls Team');
  const [publishDate, setPublishDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [readTime, setReadTime] = useState(5);
  const [imageUrl, setImageUrl] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [relatedProducts, setRelatedProducts] = useState('');
  const [heroImages, setHeroImages] = useState('');
  const [isStandaloneComponent, setIsStandaloneComponent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setSlug(initialData.slug);
      setSlugManuallyEdited(true);
      setContent(initialData.content || '');
      setExcerpt(initialData.excerpt || '');
      setAuthor(initialData.author);
      setPublishDate(initialData.publishDate);
      setCategory(initialData.category);
      setReadTime(initialData.readTime);
      setImageUrl(initialData.imageUrl);
      setTagsStr(initialData.tags?.join(', ') || '');
      setRelatedProducts(
        initialData.relatedProducts ? JSON.stringify(initialData.relatedProducts, null, 2) : ''
      );
      setHeroImages(
        initialData.heroImages ? JSON.stringify(initialData.heroImages, null, 2) : ''
      );
      setIsStandaloneComponent(initialData.isStandaloneComponent || false);
    }
  }, [initialData]);

  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManuallyEdited]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    if (!author.trim()) newErrors.author = 'Author is required';
    if (!publishDate) newErrors.publishDate = 'Publish date is required';
    if (!category) newErrors.category = 'Category is required';
    if (!readTime || readTime < 1) newErrors.readTime = 'Read time must be at least 1';
    if (!imageUrl.trim()) newErrors.imageUrl = 'Image URL is required';

    if (relatedProducts.trim()) {
      try {
        JSON.parse(relatedProducts);
      } catch {
        newErrors.relatedProducts = 'Invalid JSON';
      }
    }
    if (heroImages.trim()) {
      try {
        JSON.parse(heroImages);
      } catch {
        newErrors.heroImages = 'Invalid JSON';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await onSubmit({
      title: title.trim(),
      slug: slug.trim(),
      content,
      excerpt: excerpt.trim(),
      author: author.trim(),
      publishDate,
      category,
      readTime,
      imageUrl: imageUrl.trim(),
      tags,
      relatedProducts: relatedProducts.trim(),
      heroImages: heroImages.trim(),
      isStandaloneComponent,
    });
  }

  return (
    <form className="insights-form" onSubmit={handleSubmit}>
      <div className="insights-form-grid">
        <div className="insights-form-main">
          <div className="form-field">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
            />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="slug">Slug *</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
              placeholder="url-friendly-slug"
            />
            {errors.slug && <span className="field-error">{errors.slug}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="excerpt">Excerpt</label>
            <textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short description for article cards"
              rows={3}
            />
          </div>

          <div className="form-field">
            <label>Content</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Article content..."
            />
          </div>
        </div>

        <div className="insights-form-sidebar">
          <div className="form-field">
            <label htmlFor="author">Author *</label>
            <input
              id="author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            {errors.author && <span className="field-error">{errors.author}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="publishDate">Publish Date *</label>
            <input
              id="publishDate"
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
            {errors.publishDate && <span className="field-error">{errors.publishDate}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <span className="field-error">{errors.category}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="readTime">Read Time (minutes) *</label>
            <input
              id="readTime"
              type="number"
              min={1}
              value={readTime}
              onChange={(e) => setReadTime(Number(e.target.value))}
            />
            {errors.readTime && <span className="field-error">{errors.readTime}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="imageUrl">Image URL *</label>
            <input
              id="imageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/assets/images/insights/..."
            />
            {errors.imageUrl && <span className="field-error">{errors.imageUrl}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="tags">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="plasma, etching, semiconductor"
            />
          </div>

          <div className="form-field">
            <label htmlFor="relatedProducts">Related Products (JSON)</label>
            <textarea
              id="relatedProducts"
              value={relatedProducts}
              onChange={(e) => setRelatedProducts(e.target.value)}
              placeholder='[{"href": "/products/...", "label": "..."}]'
              rows={4}
            />
            {errors.relatedProducts && (
              <span className="field-error">{errors.relatedProducts}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="heroImages">Hero Images (JSON)</label>
            <textarea
              id="heroImages"
              value={heroImages}
              onChange={(e) => setHeroImages(e.target.value)}
              placeholder='{"prefix": "cover-name", "fallbackExt": "png"}'
              rows={3}
            />
            {errors.heroImages && <span className="field-error">{errors.heroImages}</span>}
          </div>

          <div className="form-field form-checkbox">
            <label>
              <input
                type="checkbox"
                checked={isStandaloneComponent}
                onChange={(e) => setIsStandaloneComponent(e.target.checked)}
              />
              Standalone Component
            </label>
          </div>

          <button type="submit" className="admin-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : initialData ? 'Update Article' : 'Create Article'}
          </button>
        </div>
      </div>
    </form>
  );
}
