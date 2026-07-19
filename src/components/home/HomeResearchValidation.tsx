import { useEffect, useState } from 'react';
import { fetchPublishedEvidence, fetchEvidenceStats, type PublishedEvidence } from '../../services/evidenceService';
import { selectShowcasePublications } from '../../config/evidence';

/**
 * Homepage "Research Validation" — dynamic, Evidence-driven. Replaces the old
 * hardcoded card list + frozen "245 citations" number (which drifted and needed
 * manual refresh). Shows the live count of published peer-reviewed publications
 * (non-drifting) and a curated marquee showcase.
 *
 * No citation counts (the Evidence framework deliberately doesn't store them) and
 * no OEM data (the public projection strips slug/meta; only journal/title/year/
 * doi/sourceUrl cross the boundary). Evergreen heading/intro always render; the
 * stat + cards appear once data loads, so a transient fetch failure degrades to
 * the intro rather than a broken empty grid.
 */
export function HomeResearchValidation() {
  const [pubs, setPubs] = useState<PublishedEvidence[] | null>(null);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    // Cards come from the published set; the headline count is the (larger)
    // verified tier-A total, which includes held drafts. If the stats query
    // isn't available, fall back to the published count.
    fetchPublishedEvidence().then((all) => {
      if (active) setPubs(all.filter((r) => r?.type === 'publication'));
    });
    fetchEvidenceStats().then((stats) => {
      if (active && stats) setVerifiedCount(stats.verifiedPublications);
    });
    return () => { active = false; };
  }, []);

  const cards = pubs ? selectShowcasePublications(pubs, 4) : [];
  const count = verifiedCount ?? pubs?.length ?? 0;
  const hasData = cards.length > 0;

  return (
    <section id="research" className="scroll-mt-24 border-y border-slate-200 bg-white px-6 py-24 md:px-10 lg:px-16">
      <div className="mx-auto max-w-screen-2xl">
        <div className={hasData ? 'grid gap-10 lg:grid-cols-[0.8fr_1.2fr]' : ''}>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Research Validation</p>
            <h2 className="mt-4 font-headline text-4xl font-semibold leading-tight tracking-normal text-slate-950 md:text-5xl">
              Peer-reviewed validation for the platforms we represent.
            </h2>
            <p className="mt-6 text-base leading-8 text-slate-600">
              Research using corresponding plasma, deposition, and vacuum process platforms has appeared
              in Nature Portfolio journals, Science Advances, Physical Review, and more.
            </p>
            {hasData ? (
              <>
                <p className="mt-8 font-mono text-5xl font-semibold tracking-normal text-slate-950">{count}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  peer-reviewed studies across the platforms we represent
                </p>
              </>
            ) : null}
          </div>
          {hasData ? (
            <div className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <article key={card.id} className="flex flex-col rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6">
                  <p className="font-serif text-2xl font-semibold text-slate-950">{card.journal}</p>
                  <p className="mt-4 text-base font-semibold leading-7 text-slate-900">{card.title}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {card.year ? `${card.year} · ` : ''}Peer-reviewed research using a process platform we represent.
                  </p>
                  {card.sourceUrl ? (
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 text-sm font-semibold text-sky-700 hover:underline"
                    >
                      View source ↗
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
