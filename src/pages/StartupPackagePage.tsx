import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { QuoteModal } from '../components/common/QuoteModal';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import { ConversionCard, TrustSignalList } from '../components/conversion';

const benefitCards = [
  {
    title: 'Startup-aware configuration',
    copy: 'Match the first equipment purchase to the process capabilities, facility constraints, and funding timeline of a new research group.',
  },
  {
    title: 'Budgetary quote support',
    copy: 'Prepare procurement-ready estimates and configuration notes for proposal planning, departmental review, or institutional purchasing.',
  },
  {
    title: '2-year standard warranty',
    copy: 'Build the first toolset around NineScrolls equipment with a standard warranty path and technical support after delivery.',
  },
  {
    title: 'Workflow-based bundles',
    copy: 'Discuss etching, deposition, coating, and surface-preparation combinations that fit the lab’s first process roadmap.',
  },
];

const productCards = [
  {
    title: 'ICP-RIE / RIE',
    desc: 'High-density plasma etching and anisotropic RIE systems for microfabrication workflows.',
    link: '/products/icp-etcher',
  },
  {
    title: 'PECVD / ALD',
    desc: 'Thin-film deposition platforms for dielectric films, passivation, and conformal research stacks.',
    link: '/products/pecvd',
  },
  {
    title: 'Coater / Developer',
    desc: 'Photolithography track support for coating, developing, baking, HMDS, and EBR workflows.',
    link: '/products/coater-developer',
  },
];

export function StartupPackagePage() {
  useScrollToTop();

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <SEO
        title="Startup Lab Equipment Packages"
        description="Startup lab equipment packages for new research programs. Request budgetary quote support for ICP-RIE/RIE, PECVD/ALD, coating, development, and process equipment bundles."
        keywords="startup lab equipment package, new PI equipment package, university lab startup package, semiconductor lab startup, cleanroom equipment startup, ICP-RIE startup package, PECVD startup package, ALD startup package, photolithography track startup"
        url="/startup-package"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                '@id': 'https://ninescrolls.com/startup-package',
                url: 'https://ninescrolls.com/startup-package',
                name: 'NineScrolls Startup Package',
                description:
                  'Startup lab equipment packages and budgetary quote support for new research programs evaluating plasma processing, thin-film deposition, coating, and development equipment.',
                isPartOf: { '@type': 'WebSite', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
              },
              {
                '@type': 'Service',
                name: 'Startup Package for New Research Labs',
                serviceType: 'Laboratory equipment configuration and budgetary quote support',
                provider: { '@type': 'Organization', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
                areaServed: ['US', 'EU', 'APAC'],
                audience: {
                  '@type': 'Audience',
                  audienceType: ['New Faculty', 'Academic Research Labs', 'University Cleanroom Facilities'],
                },
                offers: {
                  '@type': 'Offer',
                  availability: 'https://schema.org/InStock',
                  eligibleCustomerType: 'New research laboratories',
                },
                description:
                  'Configuration review, budgetary quote support, 2-year standard warranty, and workflow-based equipment bundle discussion for new research programs.',
              },
              ...productCards.map((p) => ({
                '@type': 'Product',
                name: p.title,
                description: p.desc,
                url: `https://ninescrolls.com${p.link}`,
                brand: { '@type': 'Brand', name: 'NineScrolls' },
                manufacturer: { '@type': 'Organization', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
                category: 'Laboratory Equipment',
                offers: {
                  '@type': 'Offer',
                  url: `https://ninescrolls.com${p.link}`,
                  availability: 'https://schema.org/InStock',
                  seller: { '@type': 'Organization', name: 'NineScrolls LLC' },
                },
              })),
            ],
          })}
        </script>
      </Helmet>

      <main className="bg-[#FAFAFA]">
        <section className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-screen-2xl gap-10 px-6 py-16 lg:grid-cols-[1fr_0.8fr] lg:px-10 lg:py-20">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Startup package</span>
              <h1 className="mt-5 max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight md:text-6xl">
                Startup lab equipment packages for new research programs
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                Build the first process toolset around the equipment families, facility constraints, and
                budgetary quote needs of a new research group.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
                  onClick={() => setQuoteOpen(true)}
                >
                  Request Startup Package Quote
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  onClick={() => setGateOpen(true)}
                >
                  Download Equipment Guide
                </button>
              </div>
            </div>
            <ConversionCard className="border-white/10 bg-white/5 text-white">
              <h2 className="text-2xl font-headline font-bold tracking-tight">Designed for first-tool decisions</h2>
              <div className="mt-6">
                <TrustSignalList
                  variant="dark"
                  items={[
                    { title: 'Budgetary quote support', copy: 'Useful for grant, proposal, and departmental planning.' },
                    { title: '2-year standard warranty', copy: 'A verified support baseline across the equipment line.' },
                    { title: 'Workflow-based bundles', copy: 'Etching, deposition, coating, development, and surface preparation.' },
                  ]}
                />
              </div>
            </ConversionCard>
          </div>
        </section>

        <section className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">What the package supports</span>
            <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
              A focused path from process plan to budgetary quote.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Startup labs often need credible equipment scope before the facility is fully ready. The package
              conversation helps align the first toolset with process priorities and procurement timing.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {benefitCards.map((card) => (
              <ConversionCard key={card.title} className="h-full">
                <h3 className="text-xl font-headline font-bold tracking-tight text-slate-950">{card.title}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-600">{card.copy}</p>
              </ConversionCard>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Applicable products</span>
                <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                  Equipment families commonly scoped for new labs.
                </h2>
              </div>
              <button
                type="button"
                className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-50"
                onClick={() => setQuoteOpen(true)}
              >
                Talk Through Your Tool List
              </button>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {productCards.map((card) => (
                <Link
                  key={card.title}
                  to={card.link}
                  className="group rounded-xl border border-slate-200 bg-[#FAFAFA] p-6 transition-colors hover:border-sky-300 hover:bg-white"
                >
                  <h3 className="text-xl font-headline font-bold tracking-tight text-slate-950">{card.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{card.desc}</p>
                  <span className="mt-6 inline-flex text-sm font-bold text-sky-700 transition-colors group-hover:text-sky-800">
                    View platform
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Ready for review</span>
                <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                  Bring us the process roadmap. We will help shape the first quote.
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-600">
                  Share your target materials, expected process sequence, facility constraints, and funding timeline.
                  NineScrolls can help translate that into a practical equipment discussion.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
                  onClick={() => setQuoteOpen(true)}
                >
                  Talk Through a Startup Package
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-50"
                  onClick={() => setGateOpen(true)}
                >
                  Download Guide
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl="/NineScrolls-Equipment-Guide.pdf"
        fileName="NineScrolls-Equipment-Guide.pdf"
        title="Download Equipment Guide"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />

      <QuoteModal
        isOpen={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          setQuoteOpen(false);
          const a = document.createElement('a');
          a.href = '/NineScrolls-Equipment-Guide.pdf';
          a.download = 'NineScrolls-Equipment-Guide.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
        downloadLabel="Download Equipment Guide"
      />
    </>
  );
}

export default StartupPackagePage;
