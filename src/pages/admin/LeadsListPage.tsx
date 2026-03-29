import { useState, useMemo, useEffect } from 'react';
import { useLeads } from '../../hooks/useLeads';
import { formatDateTime } from '../../types/admin';
import type { LeadSubmission, LeadType } from '../../types/admin';
import { LEAD_TYPE_LABELS, LEAD_TYPE_COLORS } from '../../types/admin';

const TYPE_OPTIONS: Array<'All' | LeadType> = ['All', 'contact', 'download_gate', 'newsletter'];

function LeadTypeBadge({ type }: { type: LeadType }) {
  const color = LEAD_TYPE_COLORS[type] || '#6b7280';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {LEAD_TYPE_LABELS[type] || type}
    </span>
  );
}

export function LeadsListPage() {
  const { leads, loading, error } = useLeads();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | LeadType>('All');
  const [selectedLead, setSelectedLead] = useState<LeadSubmission | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const stats = useMemo(() => {
    const contact = leads.filter(l => l.type === 'contact').length;
    const download = leads.filter(l => l.type === 'download_gate').length;
    const newsletter = leads.filter(l => l.type === 'newsletter').length;
    return { contact, download, newsletter, total: leads.length };
  }, [leads]);

  const filtered = useMemo(() => {
    let result = [...leads].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
    if (typeFilter !== 'All') {
      result = result.filter(l => l.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.email?.toLowerCase().includes(q) ||
        l.name?.toLowerCase().includes(q) ||
        l.organization?.toLowerCase().includes(q) ||
        l.productName?.toLowerCase().includes(q) ||
        l.leadId?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [leads, search, typeFilter]);

  function openPanel(lead: LeadSubmission) {
    setSelectedLead(lead);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedLead(null), 300);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) closePanel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen]);

  if (loading) return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading Leads...</div>;
  if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;

  return (
    <div>
      {/* Header Stats */}
      <div className="grid grid-cols-12 gap-4 md:gap-8 mb-6 md:mb-12">
        <div className="col-span-12 md:col-span-6 flex flex-col justify-end">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Lead Pipeline</p>
          <h1 className="font-headline text-3xl md:text-5xl font-black text-on-surface tracking-tighter">Leads</h1>
        </div>
        <div className="col-span-4 md:col-span-2">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform p-4 md:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Contact</p>
            <span className="font-headline text-3xl md:text-4xl font-bold tracking-tight mt-3" style={{ color: LEAD_TYPE_COLORS.contact }}>{stats.contact}</span>
          </div>
        </div>
        <div className="col-span-4 md:col-span-2">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform p-4 md:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Download</p>
            <span className="font-headline text-3xl md:text-4xl font-bold tracking-tight mt-3" style={{ color: LEAD_TYPE_COLORS.download_gate }}>{stats.download}</span>
          </div>
        </div>
        <div className="col-span-4 md:col-span-2">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform p-4 md:p-6">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Newsletter</p>
            <span className="font-headline text-3xl md:text-4xl font-bold tracking-tight mt-3" style={{ color: LEAD_TYPE_COLORS.newsletter }}>{stats.newsletter}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:justify-between md:items-center mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_OPTIONS.map(t => (
            <button
              key={t}
              className={`px-4 py-1.5 rounded-full text-xs border-none cursor-pointer transition-colors ${
                typeFilter === t
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container'
              }`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'All' ? `All (${stats.total})` : `${LEAD_TYPE_LABELS[t]} (${leads.filter(l => l.type === t).length})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            placeholder="Search by name, email, org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-container-low pl-10 pr-4 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-72"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)]">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-outline-variant/5">
          {filtered.map(lead => (
            <div
              key={lead.leadId}
              className="p-4 cursor-pointer hover:bg-primary-fixed/30 transition-colors"
              onClick={() => openPanel(lead)}
            >
              <div className="flex items-center justify-between mb-2">
                <LeadTypeBadge type={lead.type} />
                <span className="text-[10px] text-on-surface-variant">{formatDateTime(lead.submittedAt)}</span>
              </div>
              <div className="text-sm font-medium text-on-surface">{lead.name || lead.email}</div>
              {lead.organization && <div className="text-xs text-on-surface-variant italic">{lead.organization}</div>}
              {lead.productName && <div className="text-xs text-on-surface-variant mt-1">{lead.productName}</div>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant text-sm">No leads found.</div>
          )}
        </div>
        {/* Desktop table */}
        <table className="hidden md:table w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Name / Email</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Organization</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Details</th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em]">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filtered.map(lead => {
              const isActive = selectedLead?.leadId === lead.leadId && panelOpen;
              return (
                <tr
                  key={lead.leadId}
                  className={`hover:bg-primary-fixed/30 transition-colors cursor-pointer group ${
                    isActive ? 'bg-primary-fixed/10 border-l-4 border-l-secondary' : ''
                  }`}
                  onClick={() => openPanel(lead)}
                >
                  <td className="px-6 py-5"><LeadTypeBadge type={lead.type} /></td>
                  <td className="px-6 py-5">
                    <div className="font-medium text-on-surface">{lead.name || '-'}</div>
                    <div className="text-xs text-on-surface-variant">{lead.email}</div>
                  </td>
                  <td className="px-6 py-5 text-on-surface-variant text-sm italic">{lead.organization || '-'}</td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">
                    {lead.type === 'contact' && (lead.productName || lead.inquiryType || '-')}
                    {lead.type === 'download_gate' && (lead.intent || lead.fileName || '-')}
                    {lead.type === 'newsletter' && (lead.source || '-')}
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant whitespace-nowrap">{formatDateTime(lead.submittedAt)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-on-surface-variant text-sm">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div
            className={`fixed inset-0 bg-black/10 z-40 transition-opacity duration-300 ${
              panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closePanel}
          />

          <div
            className={`fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest z-50 shadow-[0px_0px_60px_rgba(2,36,72,0.12)] flex flex-col border-l border-outline-variant/10 transition-transform duration-300 ease-out ${
              panelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Panel Header */}
            <div className="px-5 py-5 md:px-10 md:py-8 border-b border-outline-variant/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-primary-fixed text-primary rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">
                    {selectedLead.type === 'contact' ? 'mail' : selectedLead.type === 'download_gate' ? 'download' : 'newspaper'}
                  </span>
                </span>
                <div>
                  <h2 className="font-headline text-xl font-bold text-on-surface">
                    {LEAD_TYPE_LABELS[selectedLead.type]} Lead
                  </h2>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">{selectedLead.leadId}</p>
                </div>
              </div>
              <button
                className="p-2 hover:bg-surface-container rounded-full transition-colors"
                onClick={closePanel}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 md:p-10 md:space-y-10" style={{ scrollbarWidth: 'none' }}>
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-7">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Name</p>
                  <p className="font-medium text-on-surface">{selectedLead.name || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Email</p>
                  <a href={`mailto:${selectedLead.email}`} className="font-medium text-primary text-sm hover:underline">{selectedLead.email}</a>
                </div>
                {selectedLead.phone && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Phone</p>
                    <p className="font-medium text-on-surface">{selectedLead.phone}</p>
                  </div>
                )}
                {selectedLead.organization && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Organization</p>
                    <p className="font-medium text-on-surface">{selectedLead.organization}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Type</p>
                  <LeadTypeBadge type={selectedLead.type} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Submitted</p>
                  <p className="font-medium text-on-surface text-sm">{formatDateTime(selectedLead.submittedAt)}</p>
                </div>
              </div>

              {/* Type-specific details */}
              {selectedLead.type === 'contact' && (
                <div className="bg-surface-container-low p-4 md:p-8 rounded-xl border-l-2 border-primary space-y-5">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-[0.1em]">Contact Details</h3>
                  {selectedLead.productName && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Product</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.productName}</span>
                    </div>
                  )}
                  {selectedLead.inquiryType && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Inquiry Type</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.inquiryType}</span>
                    </div>
                  )}
                  {selectedLead.topic && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Topic</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.topic}</span>
                    </div>
                  )}
                  {selectedLead.message && (
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">Message</p>
                      <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">{selectedLead.message}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedLead.type === 'download_gate' && (
                <div className="bg-surface-container-low p-4 md:p-8 rounded-xl border-l-2 border-primary space-y-5">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-[0.1em]">Download Details</h3>
                  {selectedLead.researchAreas && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Research Areas</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.researchAreas}</span>
                    </div>
                  )}
                  {selectedLead.jobTitle && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Job Title</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.jobTitle}</span>
                    </div>
                  )}
                  {selectedLead.intent && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Intent</span>
                      <span className="font-headline font-semibold text-secondary">{selectedLead.intent}</span>
                    </div>
                  )}
                  {selectedLead.fileName && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">File</span>
                      <span className="font-medium text-on-surface text-sm">{selectedLead.fileName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Marketing Opt-in</span>
                    <span className="font-headline font-semibold text-on-surface">{selectedLead.marketingOptIn ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}

              {selectedLead.type === 'newsletter' && (
                <div className="bg-surface-container-low p-4 md:p-8 rounded-xl border-l-2 border-primary space-y-5">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-[0.1em]">Newsletter Details</h3>
                  {selectedLead.source && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Source</span>
                      <span className="font-headline font-semibold text-on-surface">{selectedLead.source}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-5 md:px-10 md:py-6 border-t border-outline-variant/10 bg-surface">
              <a
                href={`mailto:${selectedLead.email}`}
                className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-headline font-bold text-sm hover:bg-primary-container transition-all flex items-center justify-center gap-2 no-underline"
              >
                <span className="material-symbols-outlined">reply</span>
                Reply to {selectedLead.name || selectedLead.email}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
