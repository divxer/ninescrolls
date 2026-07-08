import { useMemo, useState } from 'react';
import type { OrganizationTimelineItem } from '../../hooks/useOrganizationTimeline';
import { CHIP_LABELS, ICON_GLYPH, TONE_LABEL, toneBadge, composeTimelineText } from './timelineItemTemplates';

interface Props {
  items: OrganizationTimelineItem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  includeInternal: boolean;
  setIncludeInternal: (v: boolean) => void;
}

const CHIPS = ['all', 'rfq', 'lead', 'order', 'quote', 'logistics', 'site_visits'] as const;

export function OrganizationTimeline({ items, loading, error, hasMore, loadMore, reload, includeInternal, setIncludeInternal }: Props) {
  const [chip, setChip] = useState<string>('all');
  const filtered = useMemo(
    () => (chip === 'all' ? items : items.filter((i) => i.sourceFilterGroup === chip)),
    [items, chip],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`px-3 py-1 rounded-full text-xs border ${chip === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {CHIP_LABELS[c]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={includeInternal} onChange={(e) => setIncludeInternal(e.target.checked)} />
          Show internal
        </label>
      </div>

      {loading && items.length === 0 ? (
        <div data-testid="timeline-skeleton" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load timeline. <button className="underline" onClick={reload}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
          No recorded interactions yet.
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
              No results in the loaded range — Load more.
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {filtered.map((item) => {
                const { title, snippet } = composeTimelineText(item);
                return (
                  <li key={item.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="text-lg leading-none">{ICON_GLYPH[item.icon] ?? ICON_GLYPH.event}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800">{title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${toneBadge(item.tone)}`}>
                          {TONE_LABEL[item.tone] ?? item.tone}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}%` : ''}
                        </span>
                        {item.isInternalOnly && <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">internal</span>}
                      </div>
                      {snippet && <div className="text-xs text-slate-500 truncate">{snippet}</div>}
                    </div>
                    <time className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(item.occurredAt).toLocaleDateString()}</time>
                  </li>
                );
              })}
            </ol>
          )}
          {error ? (
            <div className="self-center text-xs text-red-600">
              Couldn’t load more. <button className="underline" onClick={loadMore}>Retry</button>
            </div>
          ) : hasMore && !loading ? (
            <button onClick={loadMore} className="self-center px-4 py-2 text-xs rounded-full border border-slate-300 text-slate-600">
              Load more
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
