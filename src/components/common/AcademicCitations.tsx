interface Publication {
  journal: string;
  tier: 'top' | 'high' | 'mid';
  title: string;
  authors: string;
  year: string;
  citations: number;
}

interface StatItem {
  value: string;
  suffix?: string;
  label: string;
}

interface AcademicCitationsProps {
  /** Section heading — defaults to generic text */
  heading?: string;
  subtitle?: string;
  stats: StatItem[];
  publications: Publication[];
  /** Journal names shown in the "published in" strip */
  journalNames: string[];
  /** Product-specific quote CTA label */
  ctaLabel?: string;
  onRequestQuote?: () => void;
  onDownloadDatasheet?: () => void;
}

const tierJournalColors: Record<string, string> = {
  top: 'text-primary',
  high: 'text-emerald-600',
  mid: 'text-amber-600',
};

const tierDotColors: Record<string, string> = {
  top: 'bg-primary',
  high: 'bg-emerald-500',
  mid: 'bg-amber-500',
};

export function AcademicCitations({
  heading = 'Trusted by Leading Research Labs',
  subtitle,
  stats,
  publications,
  journalNames,
  ctaLabel = 'View All Publications',
  onRequestQuote,
  onDownloadDatasheet,
}: AcademicCitationsProps) {
  return (
    <section className="py-20 bg-gradient-to-b from-[#f8faff] to-[#eef3fb] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[1.5px] uppercase text-primary mb-3.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Proven in Research
          </div>
          <h2 className="text-4xl font-extrabold text-on-surface mb-3.5">{heading}</h2>
          {subtitle && <p className="text-[17px] text-on-surface-variant max-w-[640px] mx-auto leading-relaxed">{subtitle}</p>}
        </div>

        {/* Stats banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 bg-white rounded-2xl overflow-hidden shadow-md mb-13">
          {stats.map((s, i) => (
            <div className="py-8 px-5 text-center bg-white relative transition-colors hover:bg-blue-50" key={i}>
              <div className="text-3xl font-extrabold text-primary">
                {s.value}
                {s.suffix && <span className="text-lg">{s.suffix}</span>}
              </div>
              <div className="text-sm text-on-surface-variant mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Featured publications */}
        <div className="text-lg font-bold text-on-surface mb-4">Featured Publications</div>
        <div className="grid gap-4 mb-10">
          {publications.map((pub, i) => (
            <div className="grid grid-cols-[1fr_auto] items-center gap-6 bg-white rounded-xl px-7 py-6 shadow-sm border border-[#eef1f6] transition-all hover:shadow-md hover:border-blue-200" key={i}>
              <div>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1.5 ${tierJournalColors[pub.tier]}`}>
                  <span className={`w-2 h-2 rounded-full ${tierDotColors[pub.tier]}`} />
                  {pub.journal}
                </div>
                <div className="text-[15px] font-semibold text-on-surface leading-normal mb-1.5 line-clamp-2">{pub.title}</div>
                <div className="text-xs text-on-surface-variant">
                  {pub.authors} · <span>{pub.year}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-primary">{pub.citations}</div>
                <div className="text-xs text-on-surface-variant uppercase tracking-wider">citations</div>
              </div>
            </div>
          ))}
        </div>

        {/* Journal strip */}
        <div className="text-center my-8">
          <div className="text-sm text-on-surface-variant mb-3">Research published in journals including</div>
          <div className="flex flex-wrap justify-center gap-4">
            {journalNames.map((name, i) => (
              <span className="text-xs font-medium text-on-surface-variant bg-white px-3 py-1.5 rounded-full border border-gray-200" key={i}>{name}</span>
            ))}
          </div>
        </div>

        {/* CTA bar */}
        <div className="flex justify-center items-center gap-4 flex-wrap">
          {onRequestQuote && (
            <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-primary text-white border border-primary hover:bg-primary-container hover:-translate-y-0.5 transition-all cursor-pointer" onClick={onRequestQuote}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              {ctaLabel}
            </button>
          )}
          {onDownloadDatasheet && (
            <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer" onClick={onDownloadDatasheet}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Product Datasheet
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
