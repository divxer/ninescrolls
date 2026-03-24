import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RichTextEditor } from './RichTextEditor';
import type { InsightsPost, RelatedProduct, ContentType } from '../../types';
import { insightCategories, newsCategories } from '../../types';
import { generateArticleMeta } from '../../services/insightsAIService';
import {
  getImageUploadUrl,
  uploadImageToS3,
  processImage,
} from '../../services/insightsImageService';
import { InsightsPostPreview } from '../../pages/InsightsPostPage';

const INSIGHT_CATEGORIES = insightCategories.filter(c => c !== 'All');
const NEWS_CATEGORIES = newsCategories.filter(c => c !== 'All');
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
  contentType: ContentType;
}

type ImageUploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function InsightsForm({ initialData, onSubmit, isSubmitting }: InsightsFormProps) {
  const [contentType, setContentType] = useState<ContentType>('insight');
  const availableCategories = contentType === 'news' ? NEWS_CATEGORIES : INSIGHT_CATEGORIES;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [excerptManuallyEdited, setExcerptManuallyEdited] = useState(false);
  const [author, setAuthor] = useState('NineScrolls Team');
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [publishDate, setPublishDate] = useState(todayISO());
  const [category, setCategory] = useState(availableCategories[0]);
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
    contentType,
  }), [slug, title, content, excerpt, author, publishDate, category, readTime, imageUrl, imagePreviewUrl, tags, relatedProducts, contentType]);

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
      setContentType((initialData.contentType as ContentType) || 'insight');
      if (initialData.imageUrl) {
        if (!initialData.imageUrl.startsWith('/assets/')) {
          setUseCustomUrl(true);
          setImageUploadState('done');
          const url = initialData.imageUrl;
          setImagePreviewUrl(url.endsWith('.webp') || url.endsWith('.png') || url.endsWith('.jpg') ? url : `${url}-lg.webp`);
        } else {
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

  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManuallyEdited]);

  useEffect(() => {
    if (!readTimeManuallyEdited && content) {
      setReadTime(estimateReadTime(content));
    }
  }, [content, readTimeManuallyEdited]);

  useEffect(() => {
    if (!excerptManuallyEdited && content) {
      setExcerpt(stripHtml(content).slice(0, 160));
    }
  }, [content, excerptManuallyEdited]);

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
      const { uploadUrl, s3Key } = await getImageUploadUrl(slug, file.name, file.type);
      await uploadImageToS3(uploadUrl, file, setImageUploadProgress);
      setImageUploadState('processing');
      const result = await processImage(s3Key, slug);

      if (result.error) {
        console.warn('Image processing had partial errors:', result.error);
      }

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
    e.target.value = '';
  }

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
    if (contentType === 'insight' && !imageUrl.trim()) newErrors.imageUrl = 'Cover image is required';

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
      contentType,
    });

    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  const excerptLen = excerpt.length;

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Editor header bar */}
        <div className="bg-surface-container-low rounded-2xl p-8 border-t-4 border-secondary overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary text-white flex items-center justify-center">
                <span className="material-symbols-outlined">article</span>
              </div>
              <div>
                <h3 className="text-xl font-bold font-headline">
                  {initialData ? 'Edit Article' : 'New Article'}
                </h3>
                {isDraft && (
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Draft</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-sm font-semibold text-on-surface-variant hover:text-on-surface px-4 py-2 transition-all"
                onClick={handleSaveDraft}
              >
                {draftSaved ? 'Saved!' : 'Save Local'}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-on-surface-variant hover:text-on-surface px-4 py-2 transition-all"
                onClick={() => setShowPreview(true)}
                disabled={!title.trim()}
              >
                Preview
              </button>
              {(!initialData || isDraft) && (
                <button
                  type="button"
                  className="px-5 py-2.5 bg-surface-container-lowest border-none rounded text-xs font-label uppercase tracking-widest font-bold hover:bg-surface-container-low transition-all"
                  disabled={isSubmitting}
                  onClick={(e) => handleSubmit(e as any, true)}
                >
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </button>
              )}
              <button
                type="button"
                className="px-6 py-2.5 bg-primary text-white rounded text-xs font-label uppercase tracking-widest font-bold hover:shadow-lg transition-all"
                disabled={isSubmitting}
                onClick={(e) => handleSubmit(e as any, false)}
              >
                {isSubmitting ? 'Publishing...' : initialData && !isDraft ? 'Update' : 'Publish Now'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Main content area */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-sm">
              {/* Title */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="title" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Title *</label>
                  <span className={`text-[10px] font-medium ${title.length > TITLE_MAX ? 'text-error' : 'text-on-surface-variant'}`}>
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title..."
                  className="w-full border-none focus:ring-0 text-3xl font-bold font-headline placeholder:text-outline-variant bg-transparent"
                />
                {errors.title && <span className="text-error text-[10px] mt-1">{errors.title}</span>}
              </div>

              {/* Slug */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slug" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">URL Slug *</label>
                  <span className="text-[10px] text-on-surface-variant">Auto-generated</span>
                </div>
                <div className="flex items-center bg-surface-container-low rounded px-3 py-2">
                  <span className="text-[10px] text-on-surface-variant/50">ninescrolls.com/</span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="article-title-here"
                    className="bg-transparent border-none p-0 text-xs focus:ring-0 ml-0.5 text-on-surface font-medium w-full"
                  />
                </div>
                {errors.slug && <span className="text-error text-[10px] mt-1">{errors.slug}</span>}
              </div>

              {/* Excerpt */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="excerpt" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Excerpt</label>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-medium ${excerptLen > EXCERPT_MAX ? 'text-error' : excerptLen > EXCERPT_MAX * 0.9 ? 'text-amber-600' : 'text-on-surface-variant'}`}>
                      {excerptLen}/{EXCERPT_MAX}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline disabled:opacity-50"
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
                  placeholder="Brief summary for search results..."
                  rows={3}
                  className="w-full bg-surface-container-low border-none rounded p-2 text-xs focus:ring-1 focus:ring-secondary/30 resize-none"
                />
                {errors.ai && <span className="text-error text-[10px] mt-1">{errors.ai}</span>}
              </div>

              {/* Rich text toolbar placeholder + editor */}
              <div className="mb-4">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Content</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Article content..."
                  slug={slug}
                />
              </div>
            </div>

            {/* SEO Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Content Type */}
              <div className="bg-surface-container-lowest p-5 rounded-xl">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Content Type</label>
                <div className="flex bg-surface-container-low p-1 rounded-lg">
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${contentType === 'insight' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    onClick={() => {
                      setContentType('insight');
                      setCategory(INSIGHT_CATEGORIES[0]);
                    }}
                  >
                    Insight
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${contentType === 'news' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    onClick={() => {
                      setContentType('news');
                      setCategory(NEWS_CATEGORIES[0]);
                    }}
                  >
                    News
                  </button>
                </div>
              </div>

              {/* Cover Image Upload */}
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-dashed border-outline-variant/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cover Image *</label>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-secondary hover:underline"
                    onClick={() => setUseCustomUrl(!useCustomUrl)}
                  >
                    {useCustomUrl ? 'Upload' : 'URL'}
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
                      placeholder="/assets/images/insights/..."
                      className="w-full bg-surface-container-low border-none rounded p-2 text-xs focus:ring-1 focus:ring-secondary/30 mb-2"
                    />
                    {imageUrl && (
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-surface-container-low">
                        <img
                          src={imageUrl.endsWith('.png') || imageUrl.endsWith('.jpg') || imageUrl.endsWith('.webp') || imageUrl.endsWith('.svg') ? imageUrl : `${imageUrl}.webp`}
                          alt="Preview"
                          className="w-full h-full object-cover"
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
                      className={`w-full h-32 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed border-secondary bg-secondary/5'
                          : imageUploadState === 'done'
                          ? 'bg-surface-container-low'
                          : 'bg-surface-container-low hover:border-secondary'
                      }`}
                      onClick={() => imageUploadState !== 'uploading' && imageUploadState !== 'processing' && fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                    >
                      {imageUploadState === 'idle' && (
                        <div className="flex flex-col items-center">
                          <span className="material-symbols-outlined text-outline-variant text-4xl">cloud_upload</span>
                          <p className="text-xs font-bold text-on-surface mt-1">Featured Image</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                      {imageUploadState === 'uploading' && (
                        <div className="flex flex-col items-center gap-2 w-full px-6">
                          <div className="w-full bg-surface-container-high rounded-full h-1.5">
                            <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${imageUploadProgress}%` }} />
                          </div>
                          <span className="text-[10px] text-secondary font-medium">Uploading... {imageUploadProgress}%</span>
                        </div>
                      )}
                      {imageUploadState === 'processing' && (
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-secondary animate-spin">progress_activity</span>
                          <span className="text-[10px] text-on-surface-variant">Optimizing...</span>
                        </div>
                      )}
                      {imageUploadState === 'done' && imagePreviewUrl && (
                        <div className="w-full h-full relative">
                          <img
                            src={imagePreviewUrl}
                            alt="Uploaded preview"
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span className="absolute bottom-1 right-1 text-[10px] text-on-surface-variant bg-white/80 px-1.5 py-0.5 rounded">Click to replace</span>
                        </div>
                      )}
                      {imageUploadState === 'error' && (
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                          <span className="text-[10px] text-error">{imageUploadError}</span>
                          <button
                            type="button"
                            className="text-[10px] font-bold text-secondary hover:underline"
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
                {errors.imageUrl && <span className="text-error text-[10px] mt-1 block">{errors.imageUrl}</span>}
              </div>

              {/* SEO Fields */}
              <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant">SEO & Meta</h4>

                {/* Author */}
                <div ref={authorRef} className="relative">
                  <label htmlFor="author" className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Author *</label>
                  <div className="relative">
                    <input
                      id="author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      onFocus={() => setShowAuthorDropdown(true)}
                      autoComplete="off"
                      className="w-full bg-surface-container-low border-none rounded py-2 px-3 text-xs focus:ring-1 focus:ring-secondary/30 pr-8"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs"
                      onClick={() => setShowAuthorDropdown(!showAuthorDropdown)}
                      tabIndex={-1}
                      aria-label="Toggle author list"
                    >
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </button>
                    {showAuthorDropdown && (
                      <ul className="absolute z-10 w-full bg-surface-container-lowest rounded-lg shadow-elevated mt-1 py-1">
                        {AUTHORS.filter(a => a.toLowerCase().includes(author.toLowerCase())).map((a) => (
                          <li
                            key={a}
                            className={`px-3 py-2 text-xs cursor-pointer hover:bg-primary-fixed/30 ${a === author ? 'text-secondary font-bold' : 'text-on-surface'}`}
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
                  {errors.author && <span className="text-error text-[10px] mt-1">{errors.author}</span>}
                </div>

                {/* Publish Date */}
                <div>
                  <label htmlFor="publishDate" className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Publish Date *</label>
                  <input
                    id="publishDate"
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded py-2 px-3 text-xs focus:ring-1 focus:ring-secondary/30"
                  />
                  {errors.publishDate && <span className="text-error text-[10px] mt-1">{errors.publishDate}</span>}
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Category *</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded py-2 px-3 text-xs focus:ring-1 focus:ring-secondary/30"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && <span className="text-error text-[10px] mt-1">{errors.category}</span>}
                </div>

                {/* Read Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="readTime" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Read Time *</label>
                    <span className="text-[10px] text-on-surface-variant">Auto-calculated</span>
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
                    className="w-full bg-surface-container-low border-none rounded py-2 px-3 text-xs focus:ring-1 focus:ring-secondary/30"
                  />
                  {errors.readTime && <span className="text-error text-[10px] mt-1">{errors.readTime}</span>}
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="tagInput" className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag, i) => (
                      <span key={i} className="bg-primary-fixed text-[10px] font-bold px-2 py-0.5 rounded text-on-primary-fixed flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          aria-label={`Remove tag ${tag}`}
                          className="hover:text-error"
                        >
                          <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    id="tagInput"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                    placeholder={tags.length === 0 ? 'Type and press Enter' : 'Add tag...'}
                    className="w-full bg-surface-container-low border-none rounded p-2 text-xs focus:ring-1 focus:ring-secondary/30"
                  />
                </div>
              </div>

              {/* Related Products (insights only) */}
              {contentType === 'insight' && (
                <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant">Related Products</h4>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-secondary hover:underline"
                      onClick={addRelatedProduct}
                    >
                      + Add
                    </button>
                  </div>
                  {relatedProducts.length === 0 && (
                    <p className="text-[10px] text-on-surface-variant">No related products.</p>
                  )}
                  {relatedProducts.map((product, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={product.label}
                        onChange={(e) => updateRelatedProduct(i, 'label', e.target.value)}
                        placeholder="Product name"
                        className="flex-1 bg-surface-container-low border-none rounded py-1.5 px-2 text-xs focus:ring-1 focus:ring-secondary/30"
                      />
                      <input
                        type="text"
                        value={product.href}
                        onChange={(e) => updateRelatedProduct(i, 'href', e.target.value)}
                        placeholder="/products/..."
                        className="flex-1 bg-surface-container-low border-none rounded py-1.5 px-2 text-xs focus:ring-1 focus:ring-secondary/30"
                      />
                      <button
                        type="button"
                        onClick={() => removeRelatedProduct(i)}
                        aria-label="Remove product"
                        className="text-on-surface-variant hover:text-error p-1"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                  {errors.relatedProducts && (
                    <span className="text-error text-[10px]">{errors.relatedProducts}</span>
                  )}
                </div>
              )}

              {/* Standalone Component (insights only) */}
              {contentType === 'insight' && (
                <div className="bg-surface-container-lowest p-5 rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isStandaloneComponent}
                      onChange={(e) => setIsStandaloneComponent(e.target.checked)}
                      className="rounded border-outline-variant text-secondary focus:ring-secondary/30"
                    />
                    Standalone Component
                    <span
                      className="material-symbols-outlined text-sm text-on-surface-variant cursor-help"
                      title="Renders as independent component with own layout"
                    >help</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh]" onClick={() => setShowPreview(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-float w-[90vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold text-on-surface">Article Preview</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${previewMode === 'desktop' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setPreviewMode('desktop')}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${previewMode === 'mobile' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setPreviewMode('mobile')}
                >
                  Mobile
                </button>
                <button
                  className="ml-4 p-1 hover:bg-surface-container-low rounded-full transition-all"
                  onClick={() => setShowPreview(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-6 ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}`}>
              <InsightsPostPreview post={previewPost} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
