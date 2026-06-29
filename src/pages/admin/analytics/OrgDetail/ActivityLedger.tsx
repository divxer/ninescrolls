import { type Dispatch, type SetStateAction } from 'react';
import { resolveTrafficChannel, hasCampaignAttribution, formatCampaignAttribution } from '../../../../services/behaviorAnalytics';
import type { AnalyticsEvent, OrganizationRecord } from '../types';
import { formatDuration, maskIP } from '../format';
import { getSearchQuery } from '../keywords';
import { computePerPageDuration } from '../flush';

export function ActivityLedger({ org, showFullIP, setShowFullIP, hasMultipleNetworks }: { org: OrganizationRecord; showFullIP: boolean; setShowFullIP: Dispatch<SetStateAction<boolean>>; hasMultipleNetworks: boolean }) {
  const visitorKey = (e: AnalyticsEvent) => (e as Record<string, unknown>).visitorId as string || e.ip || 'unknown';
  const uniqueVisitors = Array.from(new Set(org.events.map(visitorKey).filter((v) => v !== 'unknown')));

  return (
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">timeline</span>
              Activity Ledger
              {uniqueVisitors.length > 1 && (
                <span className="bg-surface-container-low px-2 py-0.5 rounded text-[10px] font-medium text-on-surface-variant ml-2 normal-case tracking-normal">{uniqueVisitors.length} visitors</span>
              )}
            </h3>

            {/* Hint: visit started before the selected date range */}
            {org.events.length > 0 && org.events.every((e) => e.eventType === 'page_time_flush') && (
              <div className="bg-tertiary-fixed/30 text-on-surface p-3 rounded-lg text-xs mb-4" style={{ lineHeight: 1.6 }}>
                Page opened before selected date range — only the unload event is within the current filter.
                {(org.orgName || org.country) && (
                  <span className="block mt-0.5 font-medium">
                    {org.orgName && org.orgName !== org.key && <>{org.orgName}</>}
                    {org.city && <>{org.orgName && org.orgName !== org.key ? ' · ' : ''}{org.city}{org.region ? `, ${org.region}` : ''}</>}
                    {org.country && <>{(org.orgName && org.orgName !== org.key) || org.city ? ' · ' : ''}{org.country}</>}
                  </span>
                )}
              </div>
            )}

            {(() => {
              const perPageDurations = computePerPageDuration(org.events);
              const byVisitor = new Map<string, AnalyticsEvent[]>();
              for (const e of org.events) {
                const key = visitorKey(e);
                const group = byVisitor.get(key);
                if (group) group.push(e);
                else byVisitor.set(key, [e]);
              }
              const channelColorsTimeline: Record<string, { bg: string; color: string; label: string }> = {
                paid_search: { bg: '#fff3e0', color: '#e65100', label: 'Paid Search' },
                organic_search: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Search' },
                ai_referral: { bg: '#ede7f6', color: '#4527a0', label: 'AI Referral' },
                paid_social: { bg: '#fff3e0', color: '#e65100', label: 'Paid Social' },
                organic_social: { bg: '#e3f2fd', color: '#1565c0', label: 'Organic Social' },
                email: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Email' },
                referral: { bg: '#e0f2f1', color: '#00695c', label: 'Referral' },
                direct: { bg: '#f5f5f5', color: '#616161', label: 'Direct' },
              };
              const fallbackChannelStyle = { bg: '#f5f5f5', color: '#616161', label: 'Other' };
              const hasExternalReferrer = (e: AnalyticsEvent): boolean => {
                if (!e.referrer) return false;
                try {
                  const host = new URL(e.referrer).hostname.toLowerCase();
                  return !host.includes('ninescrolls') && !host.includes('localhost') && !host.includes('127.0.0.1');
                } catch { return false; }
              };
              const referrerBadge = (e: AnalyticsEvent) => {
                const channel = resolveTrafficChannel(e);
                const style = channelColorsTimeline[channel] || fallbackChannelStyle;
                const label = e.referrer
                  ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
                  : style.label;
                const sq = getSearchQuery(e);
                const isSearch = channel === 'paid_search' || channel === 'organic_search';
                const isPaid = channel === 'paid_search';
                return (
                  <>
                    <span className="inline-block rounded px-1.5 py-px text-[11px] ml-1" style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                      {label}
                    </span>
                    {isSearch && (
                      <span className="inline-block rounded px-1.5 py-px text-[11px] ml-1 font-bold uppercase" style={{ background: isPaid ? '#fff3e0' : '#e3f2fd', color: isPaid ? '#e65100' : '#1565c0', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', marginLeft: '4px' }}>
                        {isPaid ? 'paid' : 'organic'}
                      </span>
                    )}
                    {(sq || e.utmTerm) && (
                      <span className="inline-block rounded px-1.5 py-px text-[11px] ml-1" style={{ background: isPaid ? '#fff3e0' : '#e3f2fd', color: isPaid ? '#e65100' : '#1565c0', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}>
                        {sq || e.utmTerm}
                      </span>
                    )}
                  </>
                );
              };
              // Campaign (UTM) attribution badge — rendered independently of the
              // referrer/channel badge so direct QR/print traffic (no referrer)
              // still shows where it came from. Returns null when no UTM present.
              const campaignBadge = (e: AnalyticsEvent) => {
                if (!hasCampaignAttribution(e)) return null;
                return (
                  <span
                    className="inline-flex items-center gap-0.5 rounded text-[11px] ml-1"
                    title={`utm_source=${e.utmSource || ''} · utm_medium=${e.utmMedium || ''} · utm_campaign=${e.utmCampaign || ''} · utm_content=${e.utmContent || ''}`}
                    style={{ background: '#ede7f6', color: '#5e35b1', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '4px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>sell</span>
                    {formatCampaignAttribution(e)}
                  </span>
                );
              };
              const entryEventIds = new Set<string>();
              for (const [, vEvents] of byVisitor) {
                const externalEvents = vEvents.filter(hasExternalReferrer);
                if (externalEvents.length > 0) {
                  const earliest = externalEvents.reduce((a, b) =>
                    new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b
                  );
                  entryEventIds.add(earliest.id);
                }
              }

              // Timeline event icon
              const eventIcon = (e: AnalyticsEvent) => {
                if (e.eventType === 'page_time_flush') return 'timer';
                if (e.eventType === 'page_view') return e.pathname === '/' ? 'home' : 'description';
                if (e.eventType === 'pdf_download' || e.eventName === 'Document Downloaded') return 'download';
                if (e.eventType === 'contact_form' || e.eventType === 'rfq_submission') return 'mail';
                return 'mouse';
              };

              // Timeline event row renderer
              const renderTimelineEvent = (e: AnalyticsEvent, isLast: boolean) => {
                const pageDuration = perPageDurations.get(e.id);
                const icon = eventIcon(e);
                const isFinal = (e as Record<string, unknown>).isFinal;
                const eventLabel = e.eventType === 'page_view'
                  ? (e.eventName || e.pathname || '/')
                  : e.eventType === 'page_time_flush'
                    ? (e.pathname || '/')
                    : (e.eventName || e.pathname || e.eventType);
                const sd = (e as Record<string, unknown>).maxScrollDepth as number;
                const idleSec = (e as Record<string, unknown>).idleSeconds as number | undefined;
                const hiddenSec = (e as Record<string, unknown>).hiddenSeconds as number | undefined;

                return (
                  <div key={e.id} className={`relative pl-10 ${isLast ? '' : 'pb-8'}`}>
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center z-10 ${isFinal ? 'bg-primary-fixed' : 'bg-surface-container'}`}>
                      <span className={`material-symbols-outlined text-[14px] ${isFinal ? 'text-primary' : 'text-on-surface-variant'}`}>{icon}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">{eventLabel}</h4>
                        {e.pathname && <p className="text-xs text-secondary font-mono">{e.pathname}</p>}
                        {e.productName && <p className="text-xs text-secondary font-medium">{e.productName}</p>}
                        {(e.eventType === 'pdf_download' || e.eventType === 'lead_capture') && (() => {
                          const props = typeof e.properties === 'string' ? (() => { try { return JSON.parse(e.properties); } catch { return null; } })() : e.properties;
                          const fileName = props?.fileName as string | undefined;
                          const fileUrl = props?.fileUrl as string | undefined;
                          const display = fileName || (fileUrl ? fileUrl.split('/').pop()?.split('?')[0] : null);
                          if (!display) return null;
                          return <p className="text-xs text-secondary font-medium" title={fileUrl}>{display}</p>;
                        })()}
                        {e.eventType === 'rfq_submission' && (() => {
                          const props = typeof e.properties === 'string' ? (() => { try { return JSON.parse(e.properties); } catch { return null; } })() : e.properties;
                          const rfqId = props?.rfqId as string | undefined;
                          const rfqInstitution = props?.rfqInstitution as string | undefined;
                          if (!rfqId && !rfqInstitution) return null;
                          return (
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              {rfqInstitution && <span className="text-on-surface-variant font-medium">{rfqInstitution}</span>}
                              {rfqId && (
                                <a href={`/admin/rfqs/${rfqId}`} className="text-primary hover:underline font-mono" onClick={(ev) => { ev.stopPropagation(); }}>
                                  {rfqId.slice(0, 16)}
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-right flex items-center gap-4">
                        {e.eventType === 'page_time_flush' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isFinal ? 'text-on-surface-variant bg-surface-container' : 'text-on-surface-variant bg-surface-container'}`}>
                            {isFinal ? 'FINAL' : isFinal === false ? 'PARTIAL' : e.eventType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {e.eventType !== 'page_time_flush' && e.eventType !== 'page_view' && (
                          <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded uppercase">
                            {e.eventType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {entryEventIds.has(e.id) && referrerBadge(e)}
                        {campaignBadge(e)}
                        <div className="text-right whitespace-nowrap">
                          {e.eventType === 'page_time_flush' ? (
                            <>
                              <p className="text-xs font-bold text-on-surface">
                                {e.activeSeconds != null ? formatDuration(e.activeSeconds) : ''}
                                {idleSec != null && idleSec > 0 && (
                                  <span className="font-normal text-on-surface-variant ml-1">+{formatDuration(idleSec)} idle</span>
                                )}
                              </p>
                              {hiddenSec != null && hiddenSec > 0 && (
                                <p className="text-[10px] text-on-surface-variant">{formatDuration(hiddenSec)} hidden</p>
                              )}
                              {sd > 0 && (
                                <p className="text-[10px] text-on-surface-variant">↓{sd}% scroll</p>
                              )}
                            </>
                          ) : (
                            <>
                              {pageDuration != null && pageDuration > 0 && (
                                <p className="text-xs font-bold text-on-surface">{formatDuration(pageDuration)}</p>
                              )}
                            </>
                          )}
                          <p className="text-[10px] text-on-surface-variant">
                            {new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                          {hasMultipleNetworks && e.ip && (
                            <p className="text-[10px] font-mono text-on-surface-variant/60">
                              {showFullIP ? e.ip : maskIP(e.ip)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              if (byVisitor.size <= 1) {
                const allEvents = org.events;
                return (
                  <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-outline-variant/30">
                    {allEvents.map((e, i) => renderTimelineEvent(e, i === allEvents.length - 1))}
                  </div>
                );
              }

              // Multiple visitors
              return Array.from(byVisitor.entries()).map(([vKey, events], idx) => {
                const ip = events.find((e) => e.ip)?.ip || '';
                const ua = events.find((e) => e.userAgent)?.userAgent || '';
                const shortUA = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : ua.split('/')[0] || '';
                return (
                  <div key={vKey} className="mb-6 last:mb-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant mb-3">
                      <span className="font-bold text-on-surface text-sm">Visitor {idx + 1}</span>
                      {ip && (
                        <span className="font-mono cursor-pointer hover:text-on-surface" onClick={() => setShowFullIP((v) => !v)}>
                          {showFullIP ? ip : maskIP(ip)}
                        </span>
                      )}
                      {shortUA && <span>{shortUA}</span>}
                      <span>{events.length} events</span>
                      {vKey && !vKey.includes('.') && <span className="font-mono" title={vKey}>{vKey.slice(0, 8)}</span>}
                    </div>
                    <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-outline-variant/30">
                      {events.map((e, i) => renderTimelineEvent(e, i === events.length - 1))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
  );
}
