import type { RfqSubmission, LeadSubmission } from '../../../../types/admin';

interface LinkedLeadsPanelProps {
  linkedRfqs: RfqSubmission[];
  linkedInquiries: LeadSubmission[];
  linkedDownloads: LeadSubmission[];
  linkedNewsletters: LeadSubmission[];
}

export function LinkedLeadsPanel({ linkedRfqs, linkedInquiries, linkedDownloads, linkedNewsletters }: LinkedLeadsPanelProps) {
  return (
    <>
    {/* Linked RFQs Card */}
    {linkedRfqs.length > 0 && (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">request_quote</span>
          Linked RFQs
        </h3>
        <div className="space-y-3">
          {linkedRfqs.map(rfq => (
            <a
              key={rfq.rfqId}
              href={`/admin/rfqs/${rfq.rfqId}`}
              className="block p-3 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-primary">
                  {rfq.referenceNumber || rfq.rfqId.slice(0, 12)}
                </span>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                  rfq.status === 'pending' ? 'bg-tertiary/10 text-tertiary'
                    : rfq.status === 'converted' ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}>
                  {rfq.status}
                </span>
              </div>
              {rfq.institution && (
                <p className="text-xs font-medium text-on-surface">{rfq.institution}</p>
              )}
              {rfq.name && (
                <p className="text-xs text-on-surface-variant">{rfq.name} {rfq.email && `· ${rfq.email}`}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-on-surface-variant">
                {rfq.equipmentCategory && <span>{rfq.equipmentCategory}</span>}
                {rfq.specificModel && <span>· {rfq.specificModel}</span>}
                <span>· {new Date(rfq.submittedAt).toLocaleDateString()}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    )}

    {/* Linked Inquiries Card */}
    {linkedInquiries.length > 0 && (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">contact_mail</span>
          Linked Inquiries
        </h3>
        <div className="space-y-3">
          {linkedInquiries.map(lead => {
            const subject = lead.productName || lead.topic || lead.inquiryType || 'General Inquiry';
            return (
              <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                <div className="text-sm font-bold text-primary mb-1">{subject}</div>
                {lead.name && (
                  <p className="text-xs text-on-surface">
                    {lead.name}
                    {lead.email && (
                      <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                    )}
                  </p>
                )}
                {lead.phone && (
                  <p className="text-[11px] text-on-surface-variant">{lead.phone}</p>
                )}
                {lead.organization && (
                  <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                )}
                {lead.message && (
                  <p
                    className="mt-2 pt-2 border-t border-outline-variant/20 text-xs text-on-surface whitespace-pre-wrap line-clamp-3"
                    title={lead.message}
                  >
                    {lead.message}
                  </p>
                )}
                <div className="mt-2 text-[10px] text-on-surface-variant">
                  {new Date(lead.submittedAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Linked Downloads Card */}
    {linkedDownloads.length > 0 && (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Linked Downloads
        </h3>
        <div className="space-y-3">
          {linkedDownloads.map(lead => {
            const subject = lead.fileName || lead.productName || 'Download';
            return (
              <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                <div className="text-sm font-bold text-primary mb-1 break-all" title={subject}>{subject}</div>
                {lead.name && (
                  <p className="text-xs text-on-surface">
                    {lead.name}
                    {lead.email && (
                      <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                    )}
                  </p>
                )}
                {lead.organization && (
                  <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                )}
                {lead.jobTitle && (
                  <p className="text-[11px] text-on-surface-variant italic">{lead.jobTitle}</p>
                )}
                {(lead.researchAreas || lead.intent) && (
                  <div className="mt-2 pt-2 border-t border-outline-variant/20 space-y-1">
                    {lead.researchAreas && (
                      <p className="text-xs text-on-surface line-clamp-2" title={lead.researchAreas}>
                        <span className="font-semibold">Research Areas:</span> {lead.researchAreas}
                      </p>
                    )}
                    {lead.intent && (
                      <p className="text-xs text-on-surface line-clamp-2" title={lead.intent}>
                        <span className="font-semibold">Intent:</span> {lead.intent}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-on-surface-variant">
                  {new Date(lead.submittedAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Linked Newsletter Card */}
    {linkedNewsletters.length > 0 && (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">newspaper</span>
          Newsletter Signups
        </h3>
        <div className="space-y-3">
          {linkedNewsletters.map(lead => (
            <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
              <a
                href={`mailto:${lead.email}`}
                className="text-sm font-medium text-primary hover:underline break-all"
                onClick={(ev) => ev.stopPropagation()}
              >
                {lead.email}
              </a>
              {lead.source && (
                <p className="text-[11px] text-on-surface-variant mt-0.5 break-all" title={lead.source}>
                  from: {lead.source}
                </p>
              )}
              <div className="mt-1 text-[10px] text-on-surface-variant">
                {new Date(lead.submittedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  );
}
