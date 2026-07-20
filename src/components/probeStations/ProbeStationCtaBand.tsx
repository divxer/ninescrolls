import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HeroAction } from './ProbeStationHero';

// Shared dark final-CTA band for the probe-station cluster. Bookends the dark
// hero, carrying the same abstract brand-navy glow so every probe page opens and
// closes on the same premium dark note.

interface ProbeStationCtaBandProps {
  eyebrow?: string;
  title: string;
  copy: ReactNode;
  primaryAction: HeroAction;
  secondaryAction?: HeroAction;
}

export function ProbeStationCtaBand({
  eyebrow = 'Get started',
  title,
  copy,
  primaryAction,
  secondaryAction,
}: ProbeStationCtaBandProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-20 text-white md:px-10 lg:px-16">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 130% at 88% 12%, rgba(59,130,246,0.16) 0%, rgba(30,58,95,0.10) 38%, rgba(7,10,15,0) 66%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-screen-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</p>
        <h2 className="mt-4 max-w-4xl font-headline text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
          {title}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">{copy}</p>
        <div className="mt-10 flex flex-wrap gap-4">
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
    </section>
  );
}
