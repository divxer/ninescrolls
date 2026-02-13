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
    <section className="citations-section">
      <div className="container">
        {/* Header */}
        <div className="citations-header">
          <div className="citations-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Proven in Research
          </div>
          <h2 className="citations-title">{heading}</h2>
          {subtitle && <p className="citations-subtitle">{subtitle}</p>}
        </div>

        {/* Stats banner */}
        <div className="citations-stats-banner">
          {stats.map((s, i) => (
            <div className="citations-stat-item" key={i}>
              <div className="citations-stat-number">
                {s.value}
                {s.suffix && <span>{s.suffix}</span>}
              </div>
              <div className="citations-stat-desc">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Featured publications */}
        <div className="citations-pub-heading">Featured Publications</div>
        <div className="citations-pub-grid">
          {publications.map((pub, i) => (
            <div className="citations-pub-card" key={i}>
              <div className="citations-pub-info">
                <div className={`citations-pub-journal tier-${pub.tier}`}>
                  <span className="citations-pub-journal-dot" />
                  {pub.journal}
                </div>
                <div className="citations-pub-title">{pub.title}</div>
                <div className="citations-pub-meta">
                  {pub.authors} · <span>{pub.year}</span>
                </div>
              </div>
              <div className="citations-pub-cited">
                <div className="citations-pub-cited-num">{pub.citations}</div>
                <div className="citations-pub-cited-label">citations</div>
              </div>
            </div>
          ))}
        </div>

        {/* Journal strip */}
        <div className="citations-journal-strip">
          <div className="citations-journal-strip-label">Research published in journals including</div>
          <div className="citations-journal-logos">
            {journalNames.map((name, i) => (
              <span className="citations-journal-logo-item" key={i}>{name}</span>
            ))}
          </div>
        </div>

        {/* CTA bar */}
        <div className="citations-cta-bar">
          {onRequestQuote && (
            <button className="btn btn-primary" onClick={onRequestQuote}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              {ctaLabel}
            </button>
          )}
          {onDownloadDatasheet && (
            <button className="btn btn-secondary" onClick={onDownloadDatasheet}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
