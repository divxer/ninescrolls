import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// Shared dark hero for the probe-station cluster (hub, SEMISHARE, cryo, silicon
// photonics). Mirrors ProductDetailPage's dark band, but the background is an
// abstract CSS motif per page — there is no hero-suitable probe-station photo in
// the asset set, and a literal image would either be off-topic or a false claim.
// Each motif evokes its subject without depicting anything: a wafer die grid
// (wafer/system), cold concentric contours (cryo), or diagonal light beams
// (photonics).

export type HeroMotif = 'wafer' | 'system' | 'cryo' | 'photonics';

interface MotifStyle {
  gradient: string;
  patternImage: string;
  patternSize?: string;
  patternMask: string;
}

const MOTIFS: Record<HeroMotif, MotifStyle> = {
  wafer: {
    gradient:
      'radial-gradient(115% 120% at 82% 18%, rgba(59,130,246,0.20) 0%, rgba(30,58,95,0.14) 34%, rgba(7,10,15,0) 62%), linear-gradient(100deg, #070A0F 0%, #0a1420 52%, #0c1c30 100%)',
    patternImage:
      'linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px)',
    patternSize: '46px 46px',
    patternMask: 'radial-gradient(120% 100% at 78% 28%, #000 26%, transparent 72%)',
  },
  system: {
    gradient:
      'radial-gradient(120% 130% at 85% 12%, rgba(56,189,248,0.18) 0%, rgba(30,58,95,0.14) 36%, rgba(7,10,15,0) 64%), linear-gradient(100deg, #070A0F 0%, #0a1522 54%, #0b1e33 100%)',
    patternImage:
      'linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.09) 1px, transparent 1px)',
    patternSize: '58px 58px',
    patternMask: 'radial-gradient(130% 110% at 80% 22%, #000 22%, transparent 74%)',
  },
  cryo: {
    gradient:
      'radial-gradient(120% 120% at 80% 15%, rgba(34,211,238,0.17) 0%, rgba(14,116,144,0.12) 32%, rgba(7,10,15,0) 60%), linear-gradient(105deg, #070A0F 0%, #08161c 50%, #08202a 100%)',
    patternImage:
      'repeating-radial-gradient(circle at 82% 22%, rgba(103,232,249,0.09) 0px, rgba(103,232,249,0.09) 1px, transparent 1px, transparent 27px)',
    patternMask: 'radial-gradient(100% 100% at 82% 22%, #000 18%, transparent 70%)',
  },
  photonics: {
    gradient:
      'radial-gradient(120% 120% at 85% 15%, rgba(139,92,246,0.18) 0%, rgba(59,130,246,0.12) 34%, rgba(7,10,15,0) 62%), linear-gradient(105deg, #070A0F 0%, #0b1020 50%, #140f2a 100%)',
    patternImage:
      'repeating-linear-gradient(115deg, rgba(196,181,253,0.08) 0px, rgba(196,181,253,0.08) 1px, transparent 1px, transparent 34px)',
    patternMask: 'linear-gradient(115deg, transparent 0%, #000 38%, #000 70%, transparent 100%)',
  },
};

export interface HeroCrumb {
  label: string;
  to: string;
}

export interface HeroAction {
  label: string;
  to: string;
}

interface ProbeStationHeroProps {
  /** Crumbs after Home; the last item is the current page. */
  breadcrumbs: HeroCrumb[];
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  primaryAction: HeroAction;
  secondaryAction?: HeroAction;
  motif: HeroMotif;
  /** Optional right-column content (already wrapped in its own panel markup). */
  aside?: ReactNode;
}

export function ProbeStationHero({
  breadcrumbs,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  motif,
  aside,
}: ProbeStationHeroProps) {
  const style = MOTIFS[motif];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, item: { '@id': 'https://ninescrolls.com/', name: 'Home' } },
      ...breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        item: { '@id': `https://ninescrolls.com${crumb.to}`, name: crumb.label },
      })),
    ],
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-24 text-white md:px-10 lg:px-16">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>
      <div aria-hidden="true" className="absolute inset-0" style={{ background: style.gradient }} />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: style.patternImage,
          backgroundSize: style.patternSize,
          WebkitMaskImage: style.patternMask,
          maskImage: style.patternMask,
        }}
      />
      <div
        className={`relative z-10 mx-auto grid max-w-screen-2xl gap-12 ${
          aside ? 'lg:grid-cols-[1.05fr_0.95fr] lg:items-center' : 'lg:max-w-5xl'
        }`}
      >
        <div>
          <nav className="text-sm font-semibold text-slate-400" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white">Home</Link>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={crumb.to}>
                  <span className="mx-2">/</span>
                  {isLast ? (
                    <span className="text-white" aria-current="page">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to} className="hover:text-white">{crumb.label}</Link>
                  )}
                </span>
              );
            })}
          </nav>
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl font-headline text-5xl font-semibold leading-tight tracking-normal md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{description}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={primaryAction.to}
              className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
            >
              {primaryAction.label}
            </Link>
            {secondaryAction && (
              <Link
                to={secondaryAction.to}
                className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
              >
                {secondaryAction.label}
              </Link>
            )}
          </div>
        </div>
        {aside}
      </div>
    </section>
  );
}

interface HeroAtAGlanceItem {
  label: string;
  value: string;
}

interface HeroAtAGlanceProps {
  title: string;
  items: HeroAtAGlanceItem[];
}

/** Standard right-column "at a glance" panel for the content pages — a glass card
 *  with a titled list, matching SEMISHARE's trust panel treatment. */
export function HeroAtAGlance({ title, items }: HeroAtAGlanceProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-300">{title}</p>
      <dl className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{item.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
