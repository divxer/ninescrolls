import type { OrganizationRecord } from '../types';

export function PagesVisitedCard({ org }: { org: OrganizationRecord }) {
  const pageEvents = org.events.filter((e) => e.pathname);
  const uniquePages = new Map<string, number>();
  for (const e of pageEvents) {
    uniquePages.set(e.pathname!, (uniquePages.get(e.pathname!) || 0) + 1);
  }
  if (uniquePages.size === 0) return null;
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
      <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Pages Visited</h3>
      <div className="space-y-1">
        {Array.from(uniquePages.entries()).map(([path, count]) => (
          <div key={path} className="flex justify-between items-center bg-surface-container-low rounded px-3 py-2">
            <span className="text-sm font-medium text-on-surface">{path}</span>
            <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">{count}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
