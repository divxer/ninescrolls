import { type Dispatch, type SetStateAction } from 'react';
import { maskIP } from '../format';
import type { OrganizationRecord } from '../types';
import type { OrgDetection } from './useOrgDetection';

export function DetectionDetailsCard({ org, detection, showFullIP, setShowFullIP }: {
  org: OrganizationRecord;
  detection: OrgDetection;
  showFullIP: boolean;
  setShowFullIP: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    networkContexts, hasMultipleNetworks, ipOrgType, hasAI,
    effectiveAiOrgType, effectiveAiConf, effectiveAiReason, aiUpgraded,
    classificationSource, aiProviderLabel,
  } = detection;
  const uniqueIPs = Array.from(new Set(org.events.map((e) => e.ip).filter(Boolean))) as string[];
  const uniqueISPs = Array.from(new Set(org.events.map((e) => e.isp).filter(Boolean))) as string[];

  return (
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">security</span>
              Detection Details
            </h3>
            <div className="space-y-6">
              {/* IP Details */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  {hasMultipleNetworks ? 'Networks Detected' : 'IP Lookup'}
                </p>
                {hasMultipleNetworks ? (
                  <div className="space-y-2">
                    {networkContexts.map((ctx) => {
                      const label = ctx.orgName || ctx.org || ctx.isp || 'Unknown';
                      const typeLabel = ctx.organizationType && ctx.organizationType !== 'unknown'
                        ? ctx.organizationType : '';
                      return (
                        <div key={ctx.ip} className="p-3 bg-surface rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="font-mono text-xs font-bold cursor-pointer hover:text-on-surface"
                                onClick={() => setShowFullIP((v) => !v)}
                                title={showFullIP ? 'Click to mask' : 'Click to reveal'}
                              >
                                {showFullIP ? ctx.ip : maskIP(ctx.ip)}
                              </span>
                              {showFullIP && (
                                <a href={`https://ipinfo.io/${ctx.ip}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                              )}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {ctx.count} event{ctx.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-on-surface">{label}</span>
                            {typeLabel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                                {typeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs font-bold cursor-pointer hover:text-on-surface"
                          onClick={() => setShowFullIP((v) => !v)}
                          title={showFullIP ? 'Click to mask' : 'Click to reveal'}
                        >
                          {uniqueIPs.length > 0
                            ? (showFullIP ? uniqueIPs[0] : maskIP(uniqueIPs[0]))
                            : 'N/A'}
                        </span>
                        {showFullIP && uniqueIPs.length > 0 && (
                          <a href={`https://ipinfo.io/${uniqueIPs[0]}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </a>
                        )}
                      </span>
                      {aiUpgraded && (
                        <span className="text-[10px] font-bold bg-primary-fixed text-primary px-2 py-0.5 rounded">UPGRADED</span>
                      )}
                    </div>
                    {uniqueIPs.length > 1 && (
                      <div className="space-y-1 mt-2">
                        {uniqueIPs.slice(1).map((ip) => (
                          <div key={ip} className="flex items-center p-2 bg-surface rounded-lg">
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-on-surface-variant cursor-pointer hover:text-on-surface" onClick={() => setShowFullIP((v) => !v)}>
                                {showFullIP ? ip : maskIP(ip)}
                              </span>
                              {showFullIP && (
                                <a href={`https://ipinfo.io/${ip}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-on-surface-variant mt-2">
                      Type: <span className="text-on-surface font-medium">
                        {org.companyType || ipOrgType || 'Unknown'}
                        {uniqueISPs.length > 0 && ` / ${uniqueISPs[0]}`}
                      </span>
                    </p>
                  </>
                )}
              </div>

              {/* AI Classification */}
              {hasAI && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">AI Classification</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-on-surface">{effectiveAiOrgType}</span>
                    <span className="text-sm font-bold text-secondary">{(effectiveAiConf * 100).toFixed(0)}% Confidence</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: `${effectiveAiConf * 100}%` }} />
                  </div>
                  {effectiveAiReason && (
                    <div className="mt-4 p-3 border-l-4 border-outline-variant bg-surface-container-low">
                      <p className="text-xs italic text-on-surface-variant leading-relaxed">
                        "{effectiveAiReason}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Indicators */}
              <div className="pt-4" style={{ borderTop: '1px solid rgba(196, 198, 207, 0.2)' }}>
                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                  {classificationSource === 'ai' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      AI Classified{aiProviderLabel ? ` via ${aiProviderLabel}` : ''}
                    </>
                  )}
                  {classificationSource === 'manual' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                      Manual Override
                    </>
                  )}
                  {classificationSource === 'ip' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">dns</span>
                      IP Lookup Classification
                    </>
                  )}
                  {classificationSource === 'behavior' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim">trending_up</span>
                      Behavior-based Classification
                    </>
                  )}
                  {classificationSource === 'none' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">help_outline</span>
                      Unclassified
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
  );
}
