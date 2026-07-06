import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { SEO } from '../common/SEO';
import type { ProductDetailConfig } from './ProductDetailPage.types';

interface ProductDetailPageProps {
  config: ProductDetailConfig;
}

export function ProductDetailPage({ config }: ProductDetailPageProps) {
  const [gateOpen, setGateOpen] = useState(false);

  useScrollToTop();

  const productUrl = `https://ninescrolls.com/products/${config.slug}`;
  const heroBackgroundImage = config.hero.backgroundImage ?? '/assets/images/redesign/hero-home-plasma-process.webp';
  const productImageUrl = config.hero.image.src.startsWith('http')
    ? config.hero.image.src
    : `https://ninescrolls.com${config.hero.image.src}`;
  const structuredData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: config.schema.name,
    description: config.schema.description,
    image: [productImageUrl],
    sku: config.schema.sku,
    brand: { '@type': 'Brand', name: 'NineScrolls LLC' },
    category: config.schema.category,
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'USD',
      price: '0',
      url: productUrl,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
    },
  };

  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <SEO
        title={config.seo.title}
        description={config.seo.description}
        keywords={config.seo.keywords}
        url={`/products/${config.slug}`}
        image={config.hero.image.src}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <script type="application/ld+json">{JSON.stringify(faqData)}</script>
      </Helmet>

      <div className="bg-[#FAFAFA] text-slate-950">
        <section className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-24 text-white md:px-10 lg:px-16">
          <div
            aria-hidden="true"
            data-testid="product-detail-hero-background"
            style={{
              backgroundImage: `linear-gradient(90deg,rgba(7,10,15,1) 0%,rgba(7,10,15,0.94) 42%,rgba(7,10,15,0.55) 100%),url('${heroBackgroundImage}')`,
            }}
            className="absolute inset-0 bg-cover bg-[position:center]"
          />
          <div className="relative z-10 mx-auto grid max-w-screen-2xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              {/* The redesigned product hero keeps breadcrumb styling local so it can sit inside the dark process-led composition. */}
              <nav className="text-sm font-semibold text-slate-400">
                <Link to={config.breadcrumb.parentHref} className="hover:text-white">{config.breadcrumb.parentLabel}</Link>
                <span className="mx-2">/</span>
                <span className="text-white">{config.breadcrumb.current}</span>
              </nav>
              <p className="mt-10 text-sm font-bold uppercase tracking-[0.22em] text-sky-300">{config.hero.eyebrow}</p>
              <h1 className="mt-5 max-w-4xl font-headline text-5xl font-semibold leading-tight tracking-normal md:text-7xl">
                {config.hero.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{config.hero.description}</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to={config.hero.primaryAction.href}
                  className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
                >
                  {config.hero.primaryAction.label}
                </Link>
                <Link
                  to={config.hero.secondaryAction.href}
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
                >
                  {config.hero.secondaryAction.label}
                </Link>
                <button
                  type="button"
                  onClick={() => setGateOpen(true)}
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:transform-none"
                >
                  {config.datasheet.buttonLabel}
                </button>
              </div>
              {config.commerce && <div data-testid="product-commerce-panel" />}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-2xl bg-[#F4F5F7]">
                <OptimizedImage
                  src={config.hero.image.src}
                  alt={config.hero.image.alt}
                  className="h-full w-full scale-[1.04] object-contain"
                  width={config.hero.image.width}
                  height={config.hero.image.height}
                  loading="eager"
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {config.hero.stats.map(item => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <p className="mt-2 font-mono text-lg font-semibold tracking-normal text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 md:px-10 lg:px-16">
          <div className="mx-auto grid max-w-screen-2xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.processIntro.eyebrow}</p>
              <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                {config.processIntro.title}
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">{config.processIntro.copy}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {config.processIntro.windows.map(item => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-xl font-semibold tracking-normal text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.details.map(detail => (
                      <span key={detail} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        {detail}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.coreWindows.eyebrow}</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">{config.coreWindows.title}</h2>
              </div>
              <Link to={config.coreWindows.compareAction.href} className="text-sm font-bold text-sky-700 hover:text-sky-500">
                {config.coreWindows.compareAction.label}
              </Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {config.coreWindows.cards.map(card => (
                <div key={card.title} className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6">
                  <h3 className="text-xl font-semibold tracking-normal text-slate-950">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{card.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 md:px-10 lg:px-16">
          <div className="mx-auto grid max-w-screen-2xl gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.specifications.eyebrow}</p>
              <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">{config.specifications.title}</h2>
              <p className="mt-5 text-base leading-8 text-slate-600">{config.specifications.copy}</p>
            </div>
            <dl data-testid={config.specifications.testId} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {config.specifications.items.map(spec => (
                <div key={spec.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{spec.label}</dt>
                  <dd className="mt-3 font-mono text-lg font-semibold tracking-normal text-slate-950">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.applications.eyebrow}</p>
              <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
                {config.applications.title}
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.applications.items.map(application => (
                <div key={application} className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6">
                  <p className="font-semibold text-slate-950">{application}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {config.gallery && (
          <section className="px-6 py-20 md:px-10 lg:px-16">
            <div className="mx-auto max-w-screen-2xl">
              <div className="max-w-3xl">
                {config.gallery.eyebrow && (
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.gallery.eyebrow}</p>
                )}
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
                  {config.gallery.heading}
                </h2>
                {config.gallery.copy && <p className="mt-5 text-base leading-8 text-slate-600">{config.gallery.copy}</p>}
              </div>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {config.gallery.images.map(image => (
                  <figure key={`${image.src}-${image.alt}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <OptimizedImage
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-cover"
                      width={image.width}
                      height={image.height}
                    />
                    {image.label && <figcaption className="px-5 py-4 text-sm font-semibold text-slate-700">{image.label}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* The redesigned detail template uses editorial evidence cards here; legacy AcademicCitations remain on older product pages. */}
        {config.research && (
          <section className="px-6 py-20 md:px-10 lg:px-16">
            <div className="mx-auto max-w-screen-2xl">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.research.eyebrow}</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
                  {config.research.title}
                </h2>
              </div>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {config.research.cards.map(card => (
                  <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-600">{card.eyebrow}</p>
                    <h3 className="mt-4 text-xl font-semibold tracking-normal text-slate-950">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{card.meta}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {config.resources && (
          <section className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
            <div className="mx-auto max-w-screen-2xl">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.resources.eyebrow}</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
                  {config.resources.title}
                </h2>
              </div>
              <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
                {config.resources.items.map(resource => (
                  <Link
                    key={resource.title}
                    to={resource.href}
                    className="grid gap-3 bg-white px-6 py-5 transition hover:bg-sky-50 md:grid-cols-[0.4fr_1fr_auto] md:items-center"
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">Resource</p>
                    <div>
                      <h3 className="text-xl font-semibold tracking-normal text-slate-950">{resource.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{resource.meta}</p>
                    </div>
                    <span className="text-sm font-bold text-sky-700">Read note</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-20 text-white md:px-10 lg:px-16">
          <div
            aria-hidden="true"
            style={{ backgroundImage: `linear-gradient(90deg,rgba(7,10,15,0),rgba(7,10,15,0.24)),url('${config.finalCta.backgroundImage}')` }}
            className="absolute inset-y-0 right-0 hidden w-[44%] bg-cover bg-center opacity-20 mix-blend-screen lg:block"
          />
          <div className="relative z-10 mx-auto max-w-screen-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">{config.finalCta.eyebrow}</p>
            <h2 className="mt-4 max-w-4xl font-headline text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              {config.finalCta.title}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">{config.finalCta.copy}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to={config.finalCta.primaryAction.href}
                className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
              >
                {config.finalCta.primaryAction.label}
              </Link>
              <Link
                to={config.finalCta.secondaryAction.href}
                className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
              >
                {config.finalCta.secondaryAction.label}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={config.datasheet.fileUrl}
        fileName={config.datasheet.fileName}
        title={config.datasheet.title}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
