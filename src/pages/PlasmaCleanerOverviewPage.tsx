import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { ProductEvidence } from '../components/products/ProductEvidence';

interface CleanerCard {
  name: string;
  route: string;
  label: string;
  image: string;
  alt: string;
  price: string;
  chamber: string;
  power: string;
  workflow: string;
  description: string;
  chips: string[];
  featured?: boolean;
  quoteOnly?: boolean;
}

const cleaners: CleanerCard[] = [
  {
    name: 'PLUTO-T',
    route: '/products/pluto-t',
    label: 'Touchscreen Compact',
    image: '/assets/images/redesign/products/pluto-t-standardized.webp',
    alt: 'PLUTO-T - 200W RF Plasma Cleaner',
    price: '$9,999',
    chamber: '~4.3 L',
    power: '200 W RF',
    workflow: 'Compact touchscreen RF cleaning',
    description: 'Touchscreen RF plasma cleaner for routine activation, cleaning, and surface preparation in small labs.',
    chips: ['Touchscreen', '200 W RF', 'Compact chamber'],
  },
  {
    name: 'PLUTO-M',
    route: '/products/pluto-m',
    label: 'Mid-Size RF',
    image: '/assets/images/redesign/products/pluto-m-standardized.webp',
    alt: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
    price: '$12,999',
    chamber: '~8 L',
    power: '200 W RF',
    workflow: 'Larger fixtures and small batches',
    description: 'Mid-size RF plasma cleaner for larger fixtures, small batch work, and routine lab preparation.',
    chips: ['Mid-size chamber', 'Recipe storage', 'Batch capable'],
  },
  {
    name: 'PLUTO-F',
    route: '/products/pluto-f',
    label: 'Flagship RF',
    image: '/assets/images/redesign/products/pluto-f-standardized.webp',
    alt: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
    price: '$15,999',
    chamber: '~14.5 L',
    power: '500 W RF',
    workflow: 'Higher power and advanced recipes',
    description: 'Flagship RF plasma cleaner with expanded chamber volume and recipe management for advanced labs.',
    chips: ['500 W RF', 'Large chamber', 'Recipe management'],
    featured: true,
  },
];

// Floor-standing / large-chamber systems — kept separate from the benchtop group
// and out of the benchtop comparison matrix (different form factor and selection logic).
const floorStanding: CleanerCard[] = [
  {
    name: 'PLUTO-30',
    route: '/products/pluto-30',
    label: 'Floor-Standing Batch',
    image: '/assets/images/redesign/products/pluto-30-standardized.webp',
    alt: 'PLUTO-30 - 30L floor-standing batch RF plasma system',
    price: 'Request quote',
    chamber: '30 L',
    power: '500 W RF',
    workflow: 'Batch and pilot-scale processing',
    description: 'Floor-standing 30 L RF plasma system with up to 7 adjustable shelves and MFC gas control for batch cleaning, activation, and etching.',
    chips: ['30 L chamber', 'Up to 7 shelves', 'MFC gas control'],
    quoteOnly: true,
  },
];

const pricingFaqs = [
  {
    question: 'How much does a plasma cleaner cost?',
    answer:
      'NineScrolls plasma cleaner systems start at $9,999 for compact PLUTO configurations, with larger RF systems ranging up to $15,999 depending on chamber size, generator power, controls, and selected configuration.',
  },
  {
    question: 'What affects plasma cleaner pricing?',
    answer:
      'Pricing depends on chamber volume, RF or mid-frequency power configuration, gas-line requirements, fixture needs, pump configuration, controls, and whether the system is purchased online or through an institutional quotation.',
  },
  {
    question: 'What is included with a plasma cleaner system?',
    answer:
      'Typical systems include the plasma chamber, power supply configuration, vacuum and gas handling interface, controller, and model-specific accessories. Final scope is confirmed on the product page or quotation.',
  },
  {
    question: 'Can universities and labs request a formal quotation?',
    answer:
      'Yes. Research groups, universities, and institutional buyers can request a formal quotation for purchase-order workflows, configuration review, shipping details, and documentation requirements.',
  },
  {
    question: 'How do I choose the right benchtop plasma cleaner?',
    answer:
      'Start with chamber size, sample geometry, required RF power, gas chemistry, throughput, and whether the workflow is teaching, bonding preparation, surface activation, or repeatable batch cleaning.',
  },
];

function CleanerCardView({ cleaner }: { cleaner: CleanerCard }) {
  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_20px_60px_rgba(15,23,42,0.10)] ${cleaner.featured ? 'lg:col-span-2' : ''}`}>
      <Link to={cleaner.route} className="flex h-full flex-col">
        <div className={`bg-slate-50 ${cleaner.featured ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
          <img
            src={cleaner.image}
            alt={cleaner.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </div>
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">{cleaner.label}</span>
              <h2 className="mt-2 text-2xl font-headline font-bold tracking-tight text-slate-950">{cleaner.name}</h2>
            </div>
            {cleaner.quoteOnly ? (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Request Quote</span>
            ) : (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Buy Online</span>
            )}
          </div>
          <p className="text-sm leading-6 text-slate-600">{cleaner.description}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Chamber</span>
              <span className="mt-1 block text-sm font-bold text-slate-950">{cleaner.chamber}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Power</span>
              <span className="mt-1 block text-sm font-bold text-slate-950">{cleaner.power}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Price</span>
              <span className="mt-1 block text-sm font-bold text-slate-950">{cleaner.price}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {cleaner.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between pt-6">
            <span className="text-sm font-semibold text-slate-600">{cleaner.workflow}</span>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-sky-700">
              View Details
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PlasmaCleanerOverviewPage() {
  useScrollToTop();

  const structuredData = {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    name: 'NineScrolls plasma cleaner systems',
    description: 'RF and mid-frequency plasma cleaners for research laboratories, surface activation, bonding preparation, and precision sample cleaning.',
    itemListElement: [...cleaners, ...floorStanding].map((cleaner, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cleaner.name,
      url: `https://ninescrolls.com${cleaner.route}`,
    })),
  };
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pricingFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <SEO
        title="Plasma Cleaner Systems | Benchtop & Floor-Standing RF Plasma Cleaners | Request Pricing"
        description="Compare NineScrolls PLUTO plasma cleaner systems — benchtop and floor-standing RF models — for research laboratories. Explore chamber sizes, applications, and request pricing for surface activation, wafer bonding preparation, and sample cleaning."
        keywords="plasma cleaner, RF plasma cleaner, surface activation, plasma cleaning system, PLUTO-T, PLUTO-M, PLUTO-F, PLUTO-30, floor-standing plasma cleaner"
        url="/products/plasma-cleaner"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <script type="application/ld+json">{JSON.stringify(faqStructuredData)}</script>
      </Helmet>

      <section className="border-b border-slate-200 bg-[#FAFAFA]">
        <div className="mx-auto max-w-screen-2xl px-6 py-8 lg:px-10">
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
          ]} />
          <div className="grid gap-12 py-14 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <span className="mb-5 block text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Plasma Cleaning Systems</span>
              <h1 className="max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight text-slate-950 md:text-7xl">
                Plasma cleaners for surface activation and lab-scale cleaning.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                Buy online or request an institutional quote for compact RF and mid-frequency plasma cleaners used in bonding prep, surface activation, organic residue removal, and sample preparation.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/products/plasma-cleaner/compare" className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700">
                  Compare Models
                </Link>
                <Link to="/products/pluto-t" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-slate-400 hover:bg-slate-50">
                  Start at PLUTO-T
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['3', 'Buy-online models'],
                  ['$9,999', 'Entry price'],
                  ['30 L', 'Largest chamber'],
                  ['500 W', 'Highest RF power'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <span className="block text-3xl font-headline font-bold tracking-tight text-slate-950">{value}</span>
                    <span className="mt-2 block text-sm font-semibold text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-8">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Cleaner Family</span>
            <h2 className="text-4xl font-headline font-bold tracking-tight text-slate-950">Choose by chamber size and workflow</h2>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              PLUTO systems emphasize touchscreen RF operation and a clear chamber-size progression, from compact single-sample cleaning to flagship high-power batch processing.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cleaners.map((cleaner) => (
              <CleanerCardView key={cleaner.route} cleaner={cleaner} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-14">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-8">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Floor-Standing / Large-Chamber</span>
            <h2 className="text-4xl font-headline font-bold tracking-tight text-slate-950">Larger batch and pilot-scale systems</h2>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              Floor-standing systems step up from the benchtop cleaners with a larger chamber, multi-shelf loading, and MFC gas control for higher-throughput batch and pilot-scale work. Configured and quoted per application rather than sold online.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {floorStanding.map((cleaner) => (
              <CleanerCardView key={cleaner.route} cleaner={cleaner} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Model Matrix</span>
            <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight text-slate-950">Quick comparison</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Use the matrix for first-pass selection. Open each model page for variants, gallery views, cart configuration, and quote options.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1.1fr_0.8fr_0.9fr_1.4fr_0.7fr] border-b border-slate-200 bg-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span>Model</span>
              <span>Chamber</span>
              <span>Power</span>
              <span>Best fit</span>
              <span>Price</span>
            </div>
            {cleaners.map((cleaner) => (
              <Link
                key={cleaner.route}
                to={cleaner.route}
                className="grid grid-cols-[1.1fr_0.8fr_0.9fr_1.4fr_0.7fr] border-b border-slate-100 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-sky-50 last:border-b-0"
              >
                <span className="font-bold text-slate-950">{cleaner.name}</span>
                <span>{cleaner.chamber}</span>
                <span>{cleaner.power}</span>
                <span>{cleaner.workflow}</span>
                <span className="font-bold text-slate-950">{cleaner.price}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-screen-2xl gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Process Context</span>
            <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight text-slate-950">Cleaning and activation are related, but not identical.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Low-pressure plasma can remove organic contamination, increase surface energy, functionalize polymers, and prepare surfaces for bonding. Gas choice, power, time, and post-process handling determine the result.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/insights/plasma-cleaner-applications-guide" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-sky-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <h3 className="text-lg font-headline font-bold text-slate-950">Plasma Cleaning Applications</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Semiconductor wire-bond prep, PDMS bonding, optics, automotive paint adhesion, and TEM sample preparation.</p>
              <span className="mt-4 inline-block text-sm font-bold text-sky-700">Read Guide →</span>
            </Link>
            <Link to="/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-sky-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <h3 className="text-lg font-headline font-bold text-slate-950">Plasma Surface Modification</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Activation, functionalization, crosslinking, hydrophobic recovery, and process-window considerations.</p>
              <span className="mt-4 inline-block text-sm font-bold text-sky-700">Read Guide →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="mb-8 max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Pricing FAQ</span>
            <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight text-slate-950">Plasma cleaner pricing and selection questions</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Use these answers to estimate the right starting point before requesting pricing or opening a model page.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {pricingFaqs.map((faq) => (
              <article key={faq.question} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-headline font-bold text-slate-950">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Published peer-reviewed research across the plasma-cleaner line
          (Pluto-T/F/M). Renders nothing until records are published. */}
      <ProductEvidence productSlug="plasma-cleaner" />
    </>
  );
}
