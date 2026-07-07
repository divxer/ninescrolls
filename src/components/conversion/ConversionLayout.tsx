import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

interface ActionLink {
  label: string;
  href: string;
}

export interface ConversionHeroProps {
  eyebrow: string;
  title: string;
  copy: string;
  primaryAction?: ActionLink;
  secondaryAction?: ActionLink;
  trustItems?: string[];
}

export function ConversionHero({
  eyebrow,
  title,
  copy,
  primaryAction,
  secondaryAction,
  trustItems = [],
}: ConversionHeroProps) {
  return (
    <section className="border-b border-slate-200 bg-[#FAFAFA]">
      <div className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10 lg:py-20">
        <span className="mb-5 block text-xs font-bold uppercase tracking-[0.28em] text-sky-600">{eyebrow}</span>
        <h1 className="max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight text-slate-950 md:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{copy}</p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryAction && (
              <Link
                to={primaryAction.href}
                className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
              >
                {primaryAction.label}
              </Link>
            )}
            {secondaryAction && (
              <Link
                to={secondaryAction.href}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                {secondaryAction.label}
              </Link>
            )}
          </div>
        )}
        {trustItems.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {trustItems.map((item) => (
              <li key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export interface ConversionCardProps {
  className?: string;
}

export function ConversionCard({ className = '', children }: PropsWithChildren<ConversionCardProps>) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>{children}</div>;
}

export function TrustSignalList({ items }: { items: Array<{ title: string; copy?: string }> }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          <span aria-hidden="true" className="mt-1 h-2 w-2 rounded-full bg-sky-600" />
          <div>
            <p className="font-bold text-slate-950">{item.title}</p>
            {item.copy && <p className="mt-1 text-sm leading-6 text-slate-600">{item.copy}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface FormSectionProps {
  title: string;
  description?: string;
  className?: string;
}

export function FormSection({ title, description, className = '', children }: PropsWithChildren<FormSectionProps>) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      <h2 className="text-xl font-headline font-bold tracking-tight text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
