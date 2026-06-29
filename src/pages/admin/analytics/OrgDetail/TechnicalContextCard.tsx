import { useMemo } from 'react';
import type { OrganizationRecord } from '../types';

export function TechnicalContextCard({ org }: { org: OrganizationRecord }) {
  const uniqueUAs = Array.from(new Set(org.events.map((e) => e.userAgent).filter(Boolean))) as string[];

  // Parse UA for OS/Browser display
  const parsedUA = useMemo(() => {
    const ua = uniqueUAs[0] || '';
    let os = 'Unknown';
    let browser = 'Unknown';
    if (ua.includes('Mac OS X')) {
      const m = ua.match(/Mac OS X (\d+[._]\d+)/);
      os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    } else if (ua.includes('Windows')) {
      const m = ua.match(/Windows NT (\d+\.\d+)/);
      os = m ? `Windows ${m[1] === '10.0' ? '10/11' : m[1]}` : 'Windows';
    } else if (ua.includes('Linux')) os = 'Linux';
    if (ua.includes('Chrome/')) {
      const m = ua.match(/Chrome\/(\d+)/);
      browser = m ? `Chrome ${m[1]}` : 'Chrome';
    } else if (ua.includes('Firefox/')) {
      const m = ua.match(/Firefox\/(\d+)/);
      browser = m ? `Firefox ${m[1]}` : 'Firefox';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const m = ua.match(/Version\/(\d+)/);
      browser = m ? `Safari ${m[1]}` : 'Safari';
    }
    return { os, browser };
  }, [uniqueUAs]);

  if (uniqueUAs.length === 0) return null;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
      <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Technical Context</h3>
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">User Agent</p>
          <p className="text-[11px] font-mono leading-relaxed bg-surface p-3 rounded text-on-surface-variant break-all">
            {uniqueUAs[0]}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">OS</p>
            <p className="text-sm font-semibold">{parsedUA.os}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Browser</p>
            <p className="text-sm font-semibold">{parsedUA.browser}</p>
          </div>
        </div>
        {(() => {
          const vids = [...new Set(org.events.map(e => (e as Record<string, unknown>).visitorId).filter(Boolean).map(String))];
          // Hide when multiple visitors — Activity Ledger already shows per-group visitorId
          if (vids.length > 1) return null;
          return (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Visitor ID</p>
              <p className="text-xs font-mono text-on-surface-variant">
                {vids.length === 1 ? vids[0].substring(0, 12) : org.key.substring(0, 12)}
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
