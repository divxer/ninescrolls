import { useEffect, useState } from 'react';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_ORDER,
  EVIDENCE_TYPE_HELP,
  evidenceTypeLabel,
  hasPayload,
} from '../../config/evidence';
import { productOptions } from '../products/productDetailConfigs';
import { fetchAllInsightsPosts } from '../../services/insightsService';
import { getContentImageUploadUrl, uploadImageToS3 } from '../../services/insightsImageService';
import type { EvidenceInput, EvidenceUpdateInput } from '../../services/evidenceAdminService';

type Metric = { label: string; value: string; unit: string };
export interface EvidenceFormValue extends Partial<EvidenceUpdateInput> {}

interface EvidenceFormProps {
  initial?: EvidenceFormValue;
  onSubmit: (value: EvidenceInput | EvidenceUpdateInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// metrics/meta are a.json() fields: on read they may come back as a JSON string
// (Lambda/raw-DDB path) or an already-parsed value (Amplify model API). Accept both.
function parseMetrics(v: unknown): Metric[] {
  const val = typeof v === 'string' && v.trim() ? safeJson(v) : v;
  return Array.isArray(val) ? (val as Metric[]) : [];
}
function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
function metaToText(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}
function toLines(arr?: (string | null)[] | null): string {
  return (arr ?? []).filter(Boolean).join('\n');
}
function fromLines(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

export function EvidenceForm({ initial, onSubmit, onCancel, submitting }: EvidenceFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [type, setType] = useState<string>(initial?.type ?? EVIDENCE_TYPE.APPLICATION_NOTE);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [products, setProducts] = useState<string[]>(initial?.products ?? []);
  const [process, setProcess] = useState(initial?.process ?? '');
  const [materials, setMaterials] = useState(toLines(initial?.materials));
  const [keywords, setKeywords] = useState(toLines(initial?.keywords));
  const [metrics, setMetrics] = useState<Metric[]>(parseMetrics(initial?.metrics));
  const [articleSlug, setArticleSlug] = useState(initial?.articleSlug ?? '');
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl ?? '');
  const [images, setImages] = useState<string[]>((initial?.images ?? []).filter(Boolean) as string[]);
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [metaText, setMetaText] = useState(metaToText(initial?.meta));
  const [status, setStatus] = useState<string>(initial?.status ?? EVIDENCE_STATUS.DRAFT);
  const [insightSlugs, setInsightSlugs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(title);

  useEffect(() => {
    fetchAllInsightsPosts()
      .then((posts) => setInsightSlugs((posts ?? []).map((p: { slug: string }) => p.slug)))
      .catch(() => setInsightSlugs([]));
  }, []);

  function toggleProduct(s: string) {
    setProducts((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function updateMetric(i: number, field: keyof Metric, value: string) {
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  async function handleUpload(file: File) {
    if (!effectiveSlug) { setError('Set a title/slug before uploading images.'); return; }
    setUploading(true);
    setError(null);
    try {
      const { uploadUrl, cdnUrl } = await getContentImageUploadUrl(effectiveSlug, file.name, file.type);
      await uploadImageToS3(uploadUrl, file);
      setImages((prev) => [...prev, cdnUrl]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasPayload({ articleSlug, pdfUrl, sourceUrl, images })) {
      setError('Provide at least one payload/target: a non-blank Article slug, PDF URL, or Source URL, or one or more uploaded images.');
      return;
    }
    if (products.length === 0) { setError('Select at least one product.'); return; }

    let meta: unknown = undefined;
    if (metaText.trim()) {
      try { meta = JSON.parse(metaText); } catch { setError('Meta must be valid JSON.'); return; }
    }

    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      slug: effectiveSlug,
      title: title.trim(),
      type,
      summary: summary.trim() || null,
      products,
      process: process.trim() || null,
      materials: fromLines(materials),
      keywords: fromLines(keywords),
      metrics: metrics.filter((m) => m.label.trim() || m.value.trim()),
      articleSlug: articleSlug.trim() || null,
      pdfUrl: pdfUrl.trim() || null,
      images,
      sourceUrl: sourceUrl.trim() || null,
      meta,
      status,
      publishDate: initial?.publishDate ?? null,
    } as EvidenceInput | EvidenceUpdateInput);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <label className="flex flex-col gap-1"><span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>

      <label className="flex flex-col gap-1"><span>Slug</span>
        <input value={effectiveSlug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} required /></label>

      <label className="flex flex-col gap-1"><span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
        </select>
        {EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP] && (
          <small>{EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP]}</small>
        )}
      </label>

      <label className="flex flex-col gap-1"><span>Summary</span>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>

      <fieldset className="flex flex-col gap-1"><legend>Products</legend>
        {productOptions.map((p) => (
          <label key={p.slug} className="flex items-center gap-2">
            <input type="checkbox" aria-label={p.slug} checked={products.includes(p.slug)} onChange={() => toggleProduct(p.slug)} />
            <span>{p.label} <code>({p.slug})</code></span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1"><span>Process</span>
        <input value={process} onChange={(e) => setProcess(e.target.value)} /></label>

      <label className="flex flex-col gap-1"><span>Materials (one per line)</span>
        <textarea value={materials} onChange={(e) => setMaterials(e.target.value)} rows={3} /></label>

      <label className="flex flex-col gap-1"><span>Keywords (one per line)</span>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} /></label>

      <fieldset className="flex flex-col gap-2"><legend>Metrics</legend>
        {metrics.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`metric-label-${i}`} placeholder="label" value={m.label} onChange={(e) => updateMetric(i, 'label', e.target.value)} />
            <input aria-label={`metric-value-${i}`} placeholder="value" value={m.value} onChange={(e) => updateMetric(i, 'value', e.target.value)} />
            <input aria-label={`metric-unit-${i}`} placeholder="unit" value={m.unit} onChange={(e) => updateMetric(i, 'unit', e.target.value)} />
            <button type="button" onClick={() => setMetrics((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setMetrics((prev) => [...prev, { label: '', value: '', unit: '' }])}>Add metric</button>
      </fieldset>

      <label className="flex flex-col gap-1"><span>Article slug (link to an Insights post)</span>
        <select value={articleSlug} onChange={(e) => setArticleSlug(e.target.value)}>
          <option value="">— none —</option>
          {insightSlugs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1"><span>PDF URL</span>
        <input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} /></label>

      <fieldset className="flex flex-col gap-2"><legend>Images</legend>
        <label className="flex flex-col gap-1"><span>Upload image</span>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} disabled={uploading} />
        </label>
        <ul>
          {images.map((url, i) => (
            <li key={url} className="flex items-center gap-2">
              <span>{url}</span>
              <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="flex flex-col gap-1"><span>Source URL</span>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /></label>

      <label className="flex flex-col gap-1"><span>Meta (JSON, optional)</span>
        <textarea value={metaText} onChange={(e) => setMetaText(e.target.value)} rows={4} /></label>

      <label className="flex flex-col gap-1"><span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
          <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
          <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
        </select>
      </label>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={submitting || uploading}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
