import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RichTextEditor } from './RichTextEditor';
import type { InsightsPost, RelatedProduct } from '../../types';
import { generateArticleMeta } from '../../services/insightsAIService';
import {
  getImageUploadUrl,
  uploadImageToS3,
  processImage,
} from '../../services/insightsImageService';
import { InsightsPostPreview } from '../../pages/InsightsPostPage';

const CATEGORIES = ['Materials Science', 'Photonics', 'Nanotechnology', 'Energy'];
const AUTHORS = ['NineScrolls Team', 'Dr. Wei Chen', 'Dr. Sarah Kim'];
const EXCERPT_MAX = 200;
const TITLE_MAX = 120;
const DRAFT_STORAGE_KEY = 'ninescrolls-article-draft';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function estimateReadTime(html: string): number {
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
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
  isStandaloneComponent: boolean;
  isDraft: boolean;
}

type ImageUploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function InsightsForm({ initialData, onSubmit, isSubmitting }: InsightsFormProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [excerptManuallyEdited, setExcerptManuallyEdited] = useState(false);
  const [author, setAuthor] = useState('NineScrolls Team');
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [publishDate, setPublishDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [readTime, setReadTime] = useState(5);
  const [readTimeManuallyEdited, setReadTimeManuallyEdited] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlManuallyEdited, setImageUrlManuallyEdited] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [isStandaloneComponent, setIsStandaloneComponent] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draftSaved, setDraftSaved] = useState(false);
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [imageUploadState, setImageUploadState] = useState<ImageUploadState>('idle');
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authorRef = useRef<HTMLDivElement>(null);

  // Construct a temporary InsightsPost for the real preview component
  const previewPost = useMemo<InsightsPost>(() => ({
    id: '',
    slug,
    title: title || 'Untitled Article',
    content: (content || '').replace(/&nbsp;/g, ' '),
    excerpt: excerpt || '',
    author,
    publishDate,
    category,
    readTime,
    imageUrl: imagePreviewUrl || imageUrl,
    tags,
    relatedProducts: relatedProducts.filter(p => p.href.trim() || p.label.trim()),
  }), [slug, title, content, excerpt, author, publishDate, category, readTime, imageUrl, imagePreviewUrl, tags, relatedProducts]);

  // Close author dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (authorRef.current && !authorRef.current.contains(e.target as Node)) {
        setShowAuthorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setSlug(initialData.slug);
      setSlugManuallyEdited(true);
      setContent(initialData.content || '');
      setExcerpt(initialData.excerpt || '');
      setExcerptManuallyEdited(true);
      setAuthor(initialData.author);
      setPublishDate(initialData.publishDate);
      setCategory(initialData.category);
      setReadTime(initialData.readTime);
      setReadTimeManuallyEdited(true);
      setImageUrl(initialData.imageUrl);
      setImageUrlManuallyEdited(true);
      setTags(initialData.tags || []);
      setRelatedProducts(initialData.relatedProducts || []);
      setIsStandaloneComponent(initialData.isStandaloneComponent || false);
      setIsDraft(initialData.isDraft || false);
      // Show cover image preview when editing an existing article
      if (initialData.imageUrl) {
        if (!initialData.imageUrl.startsWith('/assets/')) {
          // CDN image URL
          setUseCustomUrl(true);
          setImageUploadState('done');
          const url = initialData.imageUrl;
          setImagePreviewUrl(url.endsWith('.webp') || url.endsWith('.png') || url.endsWith('.jpg') ? url : `${url}-lg.webp`);
        } else {
          // Local image path
          setImageUploadState('done');
          setImagePreviewUrl(initialData.imageUrl);
        }
      }
    }
  }, [initialData]);

  // Load saved draft (only for new articles)
  useEffect(() => {
    if (initialData) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.slug) { setSlug(draft.slug); setSlugManuallyEdited(true); }
        if (draft.content) setContent(draft.content);
        if (draft.excerpt) { setExcerpt(draft.excerpt); setExcerptManuallyEdited(true); }
        if (draft.author) setAuthor(draft.author);
        if (draft.publishDate) setPublishDate(draft.publishDate);
        if (draft.category) setCategory(draft.category);
        if (draft.imageUrl) { setImageUrl(draft.imageUrl); setImageUrlManuallyEdited(true); }
        if (draft.tags?.length) setTags(draft.tags);
        if (draft.relatedProducts?.length) setRelatedProducts(draft.relatedProducts);
        if (draft.isStandaloneComponent) setIsStandaloneComponent(true);
      }
    } catch {
      // ignore invalid draft
    }
  }, [initialData]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManuallyEdited]);

  // Auto-calculate read time from content
  useEffect(() => {
    if (!readTimeManuallyEdited && content) {
      setReadTime(estimateReadTime(content));
    }
  }, [content, readTimeManuallyEdited]);

  // Auto-extract excerpt from content
  useEffect(() => {
    if (!excerptManuallyEdited && content) {
      setExcerpt(stripHtml(content).slice(0, 160));
    }
  }, [content, excerptManuallyEdited]);

  // Auto-fill image URL from slug
  useEffect(() => {
    if (!imageUrlManuallyEdited && slug) {
      setImageUrl(`/assets/images/insights/${slug}`);
    }
  }, [slug, imageUrlManuallyEdited]);

  const handleSaveDraft = useCallback(() => {
    const draft = {
      title, slug, content, excerpt, author, publishDate,
      category, imageUrl, tags, relatedProducts,
      isStandaloneComponent, savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }, [title, slug, content, excerpt, author, publishDate, category, imageUrl, tags, relatedProducts, isStandaloneComponent]);

  async function handleAIGenerate() {
    if (!stripHtml(content).trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generateArticleMeta(title, stripHtml(content), category);
      setExcerpt(result.excerpt);
      setExcerptManuallyEdited(true);
      setTags(result.tags);
    } catch (err) {
      console.error('AI generation failed:', err);
      setErrors((prev) => ({ ...prev, ai: 'AI generation failed. Please try again.' }));
    } finally {
      setIsGenerating(false);
    }
  }

  // Tag management
  function addTag(value: string) {
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  // Image upload
  async function handleImageUpload(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError('Unsupported file type. Use JPEG, PNG, or WebP.');
      setImageUploadState('error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageUploadError(`File too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`);
      setImageUploadState('error');
      return;
    }
    if (!slug.trim()) {
      setImageUploadError('Please set a title or slug before uploading an image.');
      setImageUploadState('error');
      return;
    }

    setImageUploadState('uploading');
    setImageUploadProgress(0);
    setImageUploadError('');

    try {
      // Step 1: Get presigned URL
      const { uploadUrl, s3Key } = await getImageUploadUrl(slug, file.name, file.type);

      // Step 2: Upload to S3
      await uploadImageToS3(uploadUrl, file, setImageUploadProgress);

      // Step 3: Process (resize + WebP)
      setImageUploadState('processing');
      const result = await processImage(s3Key, slug);

      if (result.error) {
        console.warn('Image processing had partial errors:', result.error);
      }

      // Auto-fill imageUrl with CDN path (extensionless, -lg suffix for hero derivation)
      const cdnImageUrl = `${result.cdnBaseUrl}/insights/${slug}/${result.heroPrefix}-lg`;
      setImageUrl(cdnImageUrl);
      setImageUrlManuallyEdited(true);
      setImagePreviewUrl(`${result.cdnBaseUrl}/insights/${slug}/${result.heroPrefix}-lg.webp`);
      setImageUploadState('done');
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Upload failed');
      setImageUploadState('error');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  // Related products management
  function addRelatedProduct() {
    setRelatedProducts([...relatedProducts, { href: '', label: '' }]);
  }

  function updateRelatedProduct(index: number, field: keyof RelatedProduct, value: string) {
    const updated = [...relatedProducts];
    updated[index] = { ...updated[index], [field]: value };
    setRelatedProducts(updated);
  }

  function removeRelatedProduct(index: number) {
    setRelatedProducts(relatedProducts.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    if (!author.trim()) newErrors.author = 'Author is required';
    if (!publishDate) newErrors.publishDate = 'Publish date is required';
    if (!category) newErrors.category = 'Category is required';
    if (!readTime || readTime < 1) newErrors.readTime = 'Read time must be at least 1';
    if (!imageUrl.trim()) newErrors.imageUrl = 'Cover image is required';

    // Validate related products
    const validProducts = relatedProducts.filter(p => p.href.trim() || p.label.trim());
    for (const p of validProducts) {
      if (!p.href.trim() || !p.label.trim()) {
        newErrors.relatedProducts = 'Each product needs both a URL and label';
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent, asDraft?: boolean) {
    e.preventDefault();
    const submitAsDraft = asDraft ?? isDraft;
    if (!validate()) return;

    const validProducts = relatedProducts.filter(p => p.href.trim() && p.label.trim());

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
      relatedProducts: validProducts.length > 0 ? JSON.stringify(validProducts) : '',
      isStandaloneComponent,
      isDraft: submitAsDraft,
    });

    // Clear draft on successful submit
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  const excerptLen = excerpt.length;

  return (
    <>
      <form className="insights-form" onSubmit={handleSubmit}>
        <div className="insights-form-grid">
          <div className="insights-form-main">
            {/* Title */}
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="title">Title *</label>
                <span className={`char-count ${title.length > TITLE_MAX ? 'char-count-over' : ''}`}>
                  {title.length}/{TITLE_MAX}
                </span>
              </div>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            {/* Slug */}
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="slug">Slug *</label>
                <span className="form-hint">Auto-generated from title</span>
              </div>
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

            {/* Excerpt */}
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="excerpt">Excerpt</label>
                <div className="form-label-row-right">
                  <span className={`char-count ${excerptLen > EXCERPT_MAX ? 'char-count-over' : excerptLen > EXCERPT_MAX * 0.9 ? 'char-count-warn' : ''}`}>
                    {excerptLen}/{EXCERPT_MAX}
                  </span>
                  <button
                    type="button"
                    className="ai-generate-btn"
                    onClick={handleAIGenerate}
                    disabled={!stripHtml(content).trim() || isGenerating}
                  >
                    {isGenerating ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
              </div>
              <textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  setExcerptManuallyEdited(true);
                }}
                placeholder="Short description for article cards (150-200 chars recommended)"
                rows={3}
              />
              {errors.ai && <span className="field-error">{errors.ai}</span>}
            </div>

            {/* Content */}
            <div className="form-field">
              <label>Content</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Article content..."
                slug={slug}
              />
            </div>
          </div>

          <div className="insights-form-sidebar">
            {/* Action buttons at top of sidebar */}
            <div className="sidebar-actions">
              {isDraft && (
                <div className="draft-indicator">Draft</div>
              )}
              <div className="sidebar-actions-row">
                {(!initialData || isDraft) && (
                  <button
                    type="button"
                    className="admin-btn-outline sidebar-btn-half"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e as any, true)}
                  >
                    {isSubmitting ? 'Saving...' : 'Save as Draft'}
                  </button>
                )}
                <button
                  type="button"
                  className={`admin-submit-btn ${!initialData || isDraft ? 'sidebar-btn-half' : 'sidebar-btn-full'}`}
                  disabled={isSubmitting}
                  onClick={(e) => handleSubmit(e as any, false)}
                >
                  {isSubmitting ? 'Publishing...' : initialData && !isDraft ? 'Update' : 'Publish'}
                </button>
              </div>
              <div className="sidebar-actions-row">
                <button
                  type="button"
                  className="admin-btn-outline sidebar-btn-half"
                  onClick={handleSaveDraft}
                >
                  {draftSaved ? 'Local Saved!' : 'Save Local'}
                </button>
                <button
                  type="button"
                  className="admin-btn-outline sidebar-btn-half"
                  onClick={() => setShowPreview(true)}
                  disabled={!title.trim()}
                >
                  Preview
                </button>
              </div>
            </div>

            <hr className="sidebar-divider" />

            {/* Author */}
            <div className="form-field" ref={authorRef}>
              <label htmlFor="author">Author *</label>
              <div className="author-combobox">
                <input
                  id="author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  onFocus={() => setShowAuthorDropdown(true)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="author-combobox-toggle"
                  onClick={() => setShowAuthorDropdown(!showAuthorDropdown)}
                  tabIndex={-1}
                  aria-label="Toggle author list"
                >
                  &#9662;
                </button>
                {showAuthorDropdown && (
                  <ul className="author-dropdown">
                    {AUTHORS.filter(a => a.toLowerCase().includes(author.toLowerCase())).map((a) => (
                      <li
                        key={a}
                        className={`author-option ${a === author ? 'author-option-selected' : ''}`}
                        onMouseDown={() => {
                          setAuthor(a);
                          setShowAuthorDropdown(false);
                        }}
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.author && <span className="field-error">{errors.author}</span>}
            </div>

            {/* Publish Date */}
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

            {/* Category */}
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

            {/* Read Time */}
            <div className="form-field">
              <div className="form-label-row">
                <label htmlFor="readTime">Read Time (minutes) *</label>
                <span className="form-hint">Auto-calculated</span>
              </div>
              <input
                id="readTime"
                type="number"
                min={1}
                value={readTime}
                onChange={(e) => {
                  setReadTime(Number(e.target.value));
                  setReadTimeManuallyEdited(true);
                }}
              />
              {errors.readTime && <span className="field-error">{errors.readTime}</span>}
            </div>

            {/* Cover Image Upload */}
            <div className="form-field">
              <div className="form-label-row">
                <label>Cover Image *</label>
                <button
                  type="button"
                  className="admin-btn-sm"
                  onClick={() => setUseCustomUrl(!useCustomUrl)}
                >
                  {useCustomUrl ? 'Use Upload' : 'Use URL'}
                </button>
              </div>

              {useCustomUrl ? (
                <>
                  <input
                    id="imageUrl"
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImageUrlManuallyEdited(true);
                    }}
                    placeholder="/assets/images/insights/... or CDN URL"
                  />
                  {imageUrl && (
                    <div className="image-preview">
                      <img
                        src={imageUrl.endsWith('.png') || imageUrl.endsWith('.jpg') || imageUrl.endsWith('.webp') || imageUrl.endsWith('.svg') ? imageUrl : `${imageUrl}.webp`}
                        alt="Preview"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`image-dropzone ${isDragOver ? 'image-dropzone-active' : ''} ${imageUploadState === 'done' ? 'image-dropzone-done' : ''}`}
                    onClick={() => imageUploadState !== 'uploading' && imageUploadState !== 'processing' && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    {imageUploadState === 'idle' && (
                      <div className="image-dropzone-content">
                        <span className="image-dropzone-icon">+</span>
                        <span>Drop image or click to select</span>
                        <span className="image-dropzone-hint">JPEG, PNG, WebP (max 10MB)</span>
                      </div>
                    )}
                    {imageUploadState === 'uploading' && (
                      <div className="image-dropzone-content">
                        <div className="image-upload-progress">
                          <div className="image-upload-progress-bar" style={{ width: `${imageUploadProgress}%` }} />
                        </div>
                        <span>Uploading... {imageUploadProgress}%</span>
                      </div>
                    )}
                    {imageUploadState === 'processing' && (
                      <div className="image-dropzone-content">
                        <span className="image-dropzone-spinner" />
                        <span>Optimizing image...</span>
                      </div>
                    )}
                    {imageUploadState === 'done' && imagePreviewUrl && (
                      <div className="image-dropzone-content">
                        <img
                          src={imagePreviewUrl}
                          alt="Uploaded preview"
                          className="image-dropzone-preview"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="image-dropzone-hint">Click to replace</span>
                      </div>
                    )}
                    {imageUploadState === 'error' && (
                      <div className="image-dropzone-content image-dropzone-error">
                        <span>{imageUploadError}</span>
                        <button
                          type="button"
                          className="admin-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageUploadState('idle');
                            setImageUploadError('');
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {errors.imageUrl && <span className="field-error">{errors.imageUrl}</span>}
            </div>

            {/* Tags */}
            <div className="form-field">
              <label htmlFor="tagInput">Tags</label>
              <div className="tags-input-wrapper">
                {tags.map((tag, i) => (
                  <span key={i} className="tag-pill">
                    {tag}
                    <button
                      type="button"
                      className="tag-pill-remove"
                      onClick={() => removeTag(i)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  id="tagInput"
                  type="text"
                  className="tags-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? 'Type and press Enter to add tags' : 'Add tag...'}
                />
              </div>
            </div>

            {/* Related Products */}
            <div className="form-field">
              <div className="form-label-row">
                <label>Related Products</label>
                <button
                  type="button"
                  className="admin-btn-sm"
                  onClick={addRelatedProduct}
                >
                  + Add
                </button>
              </div>
              {relatedProducts.length === 0 && (
                <p className="form-empty-hint">No related products. Click "+ Add" to link products.</p>
              )}
              {relatedProducts.map((product, i) => (
                <div key={i} className="related-product-row">
                  <input
                    type="text"
                    value={product.label}
                    onChange={(e) => updateRelatedProduct(i, 'label', e.target.value)}
                    placeholder="Product name"
                    className="related-product-input"
                  />
                  <input
                    type="text"
                    value={product.href}
                    onChange={(e) => updateRelatedProduct(i, 'href', e.target.value)}
                    placeholder="/products/..."
                    className="related-product-input"
                  />
                  <button
                    type="button"
                    className="related-product-remove"
                    onClick={() => removeRelatedProduct(i)}
                    aria-label="Remove product"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {errors.relatedProducts && (
                <span className="field-error">{errors.relatedProducts}</span>
              )}
            </div>

            {/* Standalone Component */}
            <div className="form-field form-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={isStandaloneComponent}
                  onChange={(e) => setIsStandaloneComponent(e.target.checked)}
                />
                Standalone Component
                <span
                  className="form-tooltip-icon"
                  title="When enabled, this article renders as an independent component with its own layout, outside the standard article template."
                >
                  ?
                </span>
              </label>
            </div>
          </div>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="admin-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Article Preview</h2>
              <div className="article-preview-device-toggle">
                <button
                  type="button"
                  className={`admin-btn-sm${previewMode === 'desktop' ? ' active' : ''}`}
                  onClick={() => setPreviewMode('desktop')}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={`admin-btn-sm${previewMode === 'mobile' ? ' active' : ''}`}
                  onClick={() => setPreviewMode('mobile')}
                >
                  Mobile
                </button>
              </div>
              <button className="admin-modal-close" onClick={() => setShowPreview(false)}>
                &times;
              </button>
            </div>
            <div className={`admin-modal-body admin-preview-frame${previewMode === 'mobile' ? ' admin-preview-mobile' : ''}`}>
              <InsightsPostPreview post={previewPost} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
