import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { OptimizedImage } from '../components/common/OptimizedImage';

type ProcessCapability = {
  id: string;
  name: string;
  tier: 'primary' | 'secondary';
  summary: string;
  equipment: string[];
  applications: string[];
  resources: string[];
};

type Product = {
  name: string;
  href: string;
  image: string;
  alt: string;
  position: string;
  uses: string[];
  featured?: boolean;
  specs?: Array<{ label: string; value: string }>;
};

const metrics = [
  { value: '12+', label: 'Equipment Platforms' },
  { value: '50+', label: 'Supported Processes' },
  { value: '20+', label: 'Research Applications' },
  { value: '2-Year', label: 'Standard Warranty' },
  { value: '500+', label: 'Peer-reviewed Citations' },
];

const processCapabilities: ProcessCapability[] = [
  {
    id: 'silicon-etching',
    name: 'Silicon Etching',
    tier: 'primary',
    summary: 'High-aspect-ratio etch workflows for MEMS, TSV, and advanced device prototyping.',
    equipment: ['ICP-RIE', 'RIE', 'DRIE'],
    applications: ['MEMS', 'Advanced Packaging', 'Failure Analysis'],
    resources: ['Deep Silicon Bosch Process', 'Compare ICP-RIE vs RIE', 'TSV'],
  },
  {
    id: 'thin-film-deposition',
    name: 'Thin Film Deposition',
    tier: 'primary',
    summary: 'Conformal and plasma-enhanced films for dielectrics, barriers, passivation, and device stacks.',
    equipment: ['PECVD', 'ALD', 'Sputtering'],
    applications: ['Semiconductor', 'Advanced Packaging', 'Photonics'],
    resources: ['ALD Basics', 'PECVD vs ALD', 'Thin Film Stack Design'],
  },
  {
    id: 'diamond-processing',
    name: 'Diamond Semiconductor Processing',
    tier: 'secondary',
    summary: 'Plasma process control for diamond, SiC, GaN, and other hard-to-process materials.',
    equipment: ['ICP-RIE', 'RIE', 'PECVD'],
    applications: ['Diamond', 'Power Electronics', 'Quantum Devices'],
    resources: ['Wide Bandgap Etching', 'Surface Activation', 'Damage Control'],
  },
  {
    id: 'advanced-packaging',
    name: 'Advanced Packaging',
    tier: 'secondary',
    summary: 'Etch, deposition, and surface preparation workflows for wafer-level packaging research.',
    equipment: ['ICP-RIE', 'PECVD', 'ALD'],
    applications: ['Advanced Packaging', 'TSV', 'Hybrid Bonding'],
    resources: ['Hybrid Bonding', 'TSV', 'Plasma Cleaning'],
  },
  {
    id: 'failure-analysis',
    name: 'Failure Analysis',
    tier: 'secondary',
    summary: 'Controlled material removal and surface treatment for semiconductor analysis workflows.',
    equipment: ['RIE', 'IBE/RIBE', 'Plasma Cleaner'],
    applications: ['Failure Analysis', 'Materials Research', 'Device Debug'],
    resources: ['Ion Beam Etching', 'Surface Preparation', 'Cross-section Prep'],
  },
];

const applications = [
  {
    name: 'Semiconductor',
    size: 'large',
    copy: 'Etching, deposition, and plasma treatment for device R&D and pilot-line process modules.',
  },
  {
    name: 'Diamond',
    size: 'large',
    copy: 'Process windows for diamond, SiC, GaN, and other wide-bandgap material research.',
  },
  {
    name: 'Advanced Packaging',
    size: 'large',
    copy: 'TSV, wafer-level packaging, hybrid bonding, passivation, and thin-film stack workflows.',
  },
  {
    name: 'MEMS',
    size: 'small',
    copy: 'Deep silicon etch, release, and precision plasma process steps.',
  },
  {
    name: 'Photonics',
    size: 'small',
    copy: 'Low-damage etching and thin-film deposition for optical structures.',
  },
  {
    name: 'Power Electronics',
    size: 'small',
    copy: 'Wide-bandgap materials, surface prep, and hard-mask process support.',
  },
];

const products: Product[] = [
  {
    name: 'ICP-RIE',
    href: '/products/icp-etcher',
    image: '/assets/images/redesign/products/icp-rie-standardized.webp',
    alt: 'NineScrolls ICP-RIE plasma etching platform',
    position: 'High-density plasma etching for demanding research processes.',
    uses: ['Deep silicon etching', 'MEMS fabrication', 'Diamond processing'],
    specs: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Gas System', value: '5 lines std.' },
      { label: 'Stage Temp', value: '-70 to 200 C' },
      { label: 'RF Power', value: '1000-3000 W' },
    ],
    featured: true,
  },
  {
    name: 'RIE',
    href: '/products/rie-etcher',
    image: '/assets/images/redesign/products/rie-standardized.webp',
    alt: 'NineScrolls RIE etcher platform',
    position: 'Reliable anisotropic etching for universities and R&D labs.',
    uses: ['Semiconductor R&D', 'Surface activation', 'Device prototyping'],
  },
  {
    name: 'PECVD',
    href: '/products/pecvd',
    image: '/assets/images/redesign/products/pecvd-standardized.webp',
    alt: 'NineScrolls PECVD thin film deposition system',
    position: 'Plasma-enhanced thin-film deposition for research stacks.',
    uses: ['Dielectric films', 'Passivation', 'Low-temperature deposition'],
  },
  {
    name: 'ALD',
    href: '/products/ald',
    image: '/assets/images/redesign/products/ald-standardized.webp',
    alt: 'NineScrolls ALD system',
    position: 'Conformal atomic-layer films for precise device structures.',
    uses: ['Barrier layers', '3D structures', 'Angstrom-scale films'],
  },
  {
    name: 'Sputter',
    href: '/products/sputter',
    image: '/assets/images/redesign/products/sputter-standardized.webp',
    alt: 'NineScrolls sputtering system',
    position: 'Physical vapor deposition for metals and functional films.',
    uses: ['Metallization', 'Electrodes', 'Thin-film stacks'],
  },
  {
    name: 'IBE/RIBE',
    href: '/products/ibe-ribe',
    image: '/assets/images/redesign/products/ibe-ribe-standardized.webp',
    alt: 'NineScrolls ion beam etching system',
    position: 'Directional ion beam processing for precise material removal.',
    uses: ['Failure analysis', 'Device trimming', 'Low-damage etching'],
  },
];

const researchCards = [
  {
    journal: 'Nature',
    title: 'Plasma process control for next-generation materials research',
    tag: 'Peer-reviewed validation',
  },
  {
    journal: 'ACS',
    title: 'Thin-film and surface process workflows in applied nanofabrication',
    tag: 'Materials research',
  },
  {
    journal: 'Scientific Reports',
    title: 'Repeatable etch and deposition methods for lab-scale semiconductor devices',
    tag: 'Device fabrication',
  },
  {
    journal: 'Applied Nano Materials',
    title: 'Advanced materials processing enabled by plasma and vacuum platforms',
    tag: 'Nanofabrication',
  },
];

const knowledgeCards = [
  {
    title: 'Wafer Bonding for 3D Integration',
    href: '/insights/wafer-bonding-technologies-for-3d-integration',
    meta: 'Advanced packaging guide',
  },
  {
    title: 'Through-Silicon Vias (TSV)',
    href: '/insights/through-silicon-vias-tsv-guide',
    meta: 'Integration flows and design rules',
  },
  {
    title: 'Compare ICP-RIE vs RIE',
    href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
    meta: 'Process selection comparison',
  },
  {
    title: 'Deep Silicon Bosch Process',
    href: '/insights/deep-reactive-ion-etching-bosch-process',
    meta: 'DRIE and deep silicon etch primer',
  },
  {
    title: 'ALD Basics',
    href: '/insights/atomic-layer-deposition-ald-comprehensive-guide',
    meta: 'Thin-film fundamentals',
  },
];

const brandProof = [
  'Designed & Supported in the USA',
  'Engineering-first Design',
  'Two-Year Standard Warranty',
  'Global Research Customers',
];

const finalCtaProof = ['2-Year Warranty', 'Global Support', 'Custom Configuration', 'Research Labs Worldwide'];

export function HomePage() {
  const location = useLocation();

  const [activeProcessId, setActiveProcessId] = useState(processCapabilities[0].id);

  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
      return;
    }

    window.scrollTo(0, 0);
  }, [location.hash]);

  const activeProcess = useMemo(
    () => processCapabilities.find(process => process.id === activeProcessId) ?? processCapabilities[0],
    [activeProcessId]
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://ninescrolls.com/#organization',
        url: 'https://ninescrolls.com',
        name: 'NineScrolls LLC',
        description: 'US-based semiconductor equipment company providing plasma process solutions for research and advanced manufacturing.',
        logo: {
          '@type': 'ImageObject',
          url: 'https://ninescrolls.com/assets/images/logo.png',
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: '12546 Cabezon Pl',
          addressLocality: 'San Diego',
          addressRegion: 'CA',
          postalCode: '92129',
          addressCountry: 'US',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+1-858-879-8898',
          contactType: 'sales',
          email: 'sales@ninescrolls.com',
          availableLanguage: ['English'],
        },
        sameAs: ['https://www.linkedin.com/company/nine-scrolls-technology'],
        knowsAbout: [
          'plasma etching',
          'ICP-RIE',
          'RIE',
          'PECVD',
          'ALD',
          'sputtering',
          'thin film deposition',
          'semiconductor manufacturing equipment',
          'advanced packaging',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://ninescrolls.com/#website',
        url: 'https://ninescrolls.com',
        name: 'NineScrolls',
        publisher: {
          '@id': 'https://ninescrolls.com/#organization',
        },
      },
    ],
  };

  return (
    <>
      <SEO
        title="Plasma Process Solutions for Research & Advanced Manufacturing"
        description="NineScrolls provides ICP-RIE, RIE, PECVD, ALD, sputtering, and thin-film process systems for universities, national laboratories, and semiconductor innovators."
        keywords="plasma process solutions, ICP-RIE, RIE, PECVD, ALD, sputtering, silicon etching, thin film deposition, semiconductor equipment"
        url="/"
      />
      <Helmet>
        <link rel="preload" as="image" href="/assets/images/redesign/hero-home-plasma-process.webp" type="image/webp" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="bg-[#FAFAFA] text-slate-900">
        <section className="relative isolate min-h-[760px] overflow-hidden bg-[#070A0F] text-white">
          <div className="absolute inset-0 z-0">
            <div
              role="img"
              aria-label="Semiconductor plasma process chamber and wafer in a cleanroom"
              className="absolute inset-0 bg-cover bg-[position:72%_center]"
              style={{
                backgroundImage:
                  'image-set(url("/assets/images/redesign/hero-home-plasma-process.webp") type("image/webp"), url("/assets/images/redesign/hero-home-plasma-process.jpg") type("image/jpeg"))',
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,10,15,0.98)_0%,rgba(7,10,15,0.9)_36%,rgba(7,10,15,0.48)_64%,rgba(7,10,15,0.28)_100%)]" />
            <div className="absolute inset-y-0 left-0 w-[48%] bg-[radial-gradient(circle_at_32%_42%,rgba(14,165,233,0.16),transparent_42%)]" />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[760px] max-w-screen-2xl grid-cols-1 items-center gap-12 px-6 py-14 md:px-10 md:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:px-16">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-sky-100 backdrop-blur">
                Industrial Precision. Scientific Confidence.
              </p>
              <h1 className="max-w-[15.5rem] pr-4 font-headline text-[2.12rem] font-bold leading-[1.04] tracking-normal text-white sm:max-w-2xl sm:pr-0 sm:text-5xl md:text-6xl lg:max-w-3xl lg:text-7xl">
                Engineering Plasma Process Solutions
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg md:leading-8">
                Semiconductor process equipment engineered for research and advanced manufacturing, including
                ICP-RIE, RIE, PECVD, ALD, sputtering, and thin-film processing systems.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 md:text-sm md:tracking-[0.22em]">
                Trusted by universities, national laboratories, and semiconductor innovators.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 md:mt-10">
                <Link
                  to="/request-quote"
                  className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 motion-reduce:transform-none"
                >
                  Request Quote
                </Link>
                <Link
                  to="/products"
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/40 motion-reduce:transform-none"
                >
                  Explore Products
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-px bg-slate-200 px-px md:grid-cols-5">
            {metrics.map(metric => (
              <div key={metric.label} className="bg-white px-6 py-8 md:px-8">
                <p className="font-mono text-3xl font-semibold tracking-normal text-slate-950">{metric.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="processes" className="scroll-mt-24 px-6 py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Process Capability</p>
                <h2 className="mt-4 max-w-xl font-headline text-4xl font-semibold leading-tight tracking-normal text-slate-950 md:text-5xl">
                  Start with the process, then choose the platform.
                </h2>
                <p className="mt-5 max-w-lg text-base leading-8 text-slate-600">
                  Engineers do not shop by catalog first. They look for a stable process window, compatible materials,
                  and equipment that can reproduce the result.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {processCapabilities.map(process => (
                    <button
                      key={process.id}
                      type="button"
                      aria-label={process.name}
                      aria-pressed={activeProcessId === process.id}
                      onClick={() => setActiveProcessId(process.id)}
                      className={`rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-sky-300 motion-reduce:transform-none ${
                        activeProcessId === process.id
                          ? 'border-sky-400 bg-sky-50'
                          : 'border-slate-200 bg-white'
                      } ${process.tier === 'primary' ? 'md:min-h-52' : 'md:min-h-40'}`}
                    >
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                        {process.tier === 'primary' ? 'Core process' : 'Specialized'}
                      </span>
                      <h3 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">{process.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{process.summary}</p>
                    </button>
                  ))}
                </div>

                <div
                  data-testid="active-process-panel"
                  className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-600">Active process map</p>
                      <h3 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{activeProcess.name}</h3>
                    </div>
                    <Link to="/request-quote" className="text-sm font-bold text-sky-700 hover:text-sky-500">
                      Discuss this process
                    </Link>
                  </div>
                  <div className="mt-6 grid gap-5 md:grid-cols-3">
                    <MappedList title="Equipment" items={activeProcess.equipment} />
                    <MappedList title="Applications" items={activeProcess.applications} />
                    <MappedList title="Resources" items={activeProcess.resources} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="applications" className="scroll-mt-24 border-y border-slate-200 bg-white px-6 py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Applications</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                  Built around the work researchers actually need to do.
                </h2>
              </div>
              <Link to="/insights" className="text-sm font-bold text-sky-700 hover:text-sky-500">
                Explore application notes
              </Link>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-6">
              {applications.map(application => (
                <article
                  key={application.name}
                  className={`rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-sky-300 motion-reduce:transform-none ${
                    application.size === 'large' ? 'lg:col-span-2 lg:min-h-64' : 'lg:col-span-2'
                  }`}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Application</p>
                  <h3 className="mt-5 text-2xl font-semibold tracking-normal text-slate-950">{application.name}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{application.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-24 px-6 py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Equipment Platforms</p>
              <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                Choose the platform that matches the process window.
              </h2>
            </div>

              <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {products.map(product => (
                  <Link
                    key={product.name}
                    to={product.href}
                    className={`group overflow-hidden rounded-3xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-sky-300 motion-reduce:transform-none ${
                      product.featured ? 'lg:col-span-2' : 'self-start'
                    }`}
                  >
                    <div className={product.featured ? 'grid gap-0 md:min-h-[520px] md:grid-cols-[1.08fr_0.92fr]' : ''}>
                      <div className={product.featured ? 'flex h-96 items-center justify-center overflow-hidden bg-[#F4F5F7] md:h-full md:min-h-[520px]' : 'h-64 overflow-hidden bg-[#F4F5F7]'}>
                        <OptimizedImage
                          src={product.image}
                          alt={product.alt}
                        width={product.featured ? 860 : 420}
                        height={product.featured ? 620 : 300}
                        className={`h-full w-full transition duration-500 motion-reduce:transform-none ${
                          product.featured ? 'scale-[1.32] object-contain group-hover:scale-[1.36]' : 'scale-[1.12] object-contain group-hover:scale-[1.16]'
                        }`}
                        />
                      </div>
                      <div className={product.featured ? 'flex h-full flex-col p-6 md:p-8 lg:p-10' : 'p-6'}>
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-600">Platform</p>
                        <h3 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">{product.name}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{product.position}</p>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {product.uses.map(use => (
                          <span key={use} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {use}
                          </span>
                        ))}
                      </div>
                      {product.featured && product.specs ? (
                        <div className="mt-8 border-t border-slate-200 pt-6">
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">Key Specifications</p>
                          <dl className="mt-4 grid grid-cols-2 gap-3">
                            {product.specs.map(spec => (
                              <div key={spec.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{spec.label}</dt>
                                <dd className="mt-2 font-mono text-lg font-semibold tracking-normal text-slate-950">{spec.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ) : null}
                        {product.featured ? (
                          <span className="mt-8 inline-flex items-center text-sm font-semibold text-sky-700">
                            Learn More
                            <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1 motion-reduce:transform-none">
                              →
                            </span>
                          </span>
                        ) : (
                          <span className="mt-6 flex w-full items-center border-t border-slate-200 pt-5 text-sm font-semibold text-sky-700">
                            View Platform
                            <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1 motion-reduce:transform-none">
                              →
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="research" className="scroll-mt-24 border-y border-slate-200 bg-white px-6 py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Research Validation</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold leading-tight tracking-normal text-slate-950 md:text-5xl">
                  Our equipment has been cited in peer-reviewed research.
                </h2>
                <p className="mt-6 text-base leading-8 text-slate-600">
                  Cited in peer-reviewed journals including Nature, ACS, and Scientific Reports.
                </p>
                <p className="mt-8 font-mono text-5xl font-semibold tracking-normal text-slate-950">500+</p>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">research citations</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {researchCards.map(card => (
                  <article key={card.title} className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6">
                    <p className="font-serif text-3xl font-semibold text-slate-950">{card.journal}</p>
                    <p className="mt-5 text-base font-semibold leading-7 text-slate-900">{card.title}</p>
                    <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{card.tag}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="scroll-mt-24 px-6 py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Knowledge Center</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                  Process notes for engineers who need a faster first decision.
                </h2>
              </div>
              <Link to="/insights" className="text-sm font-bold text-sky-700 hover:text-sky-500">
                View all resources
              </Link>
            </div>
            <div className="mt-12 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
              {knowledgeCards.map(card => (
                <Link
                  key={card.title}
                  to={card.href}
                  className="grid gap-3 px-6 py-6 transition hover:bg-sky-50 md:grid-cols-[0.4fr_1fr_auto] md:items-center md:px-8"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Resource</p>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-normal text-slate-950">{card.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{card.meta}</p>
                  </div>
                  <span aria-hidden="true" className="text-sm font-bold text-sky-700">Read note</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-6 py-14 md:px-10 lg:px-16">
          <div className="mx-auto grid max-w-screen-2xl gap-4 md:grid-cols-4">
            {brandProof.map(item => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-5">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-testid="final-cta" className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-24 text-white md:px-10 lg:px-16">
          <div className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(7,10,15,1)_0%,rgba(7,10,15,0.98)_46%,rgba(7,10,15,0.78)_100%)]" />
          <div className="absolute right-0 top-0 z-0 hidden h-full w-[42%] border-l border-white/[0.04] bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:28px_28px] opacity-25 lg:block" />
          <div
            data-testid="cta-viewport-texture"
            aria-hidden="true"
            className="absolute inset-y-0 right-[-3%] z-[1] hidden w-[46%] bg-[length:175%_auto] bg-[position:58%_46%] bg-no-repeat opacity-[0.2] mix-blend-screen contrast-[2.15] brightness-[1.75] saturate-0 [mask-image:radial-gradient(ellipse_at_58%_45%,black_0%,black_42%,transparent_74%)] md:block"
            style={{
              backgroundImage:
                'image-set(url("/assets/images/redesign/hero-home-plasma-process.webp") type("image/webp"), url("/assets/images/redesign/hero-home-plasma-process.jpg") type("image/jpeg"))',
            }}
          />
          <div
            data-testid="cta-edge-highlight"
            aria-hidden="true"
            className="absolute inset-y-0 right-[3%] z-[1] hidden w-[36%] bg-[radial-gradient(circle_at_55%_42%,rgba(226,242,255,0.18),transparent_15%),radial-gradient(circle_at_61%_47%,rgba(56,189,248,0.2),transparent_18%),linear-gradient(90deg,transparent,rgba(226,242,255,0.11)_40%,transparent_70%)] opacity-80 blur-sm md:block"
          />
          <div
            data-testid="cta-wafer-rim"
            aria-hidden="true"
            className="absolute bottom-[19%] right-[18%] z-[1] hidden h-36 w-72 rounded-[999px] border border-white/[0.12] bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(226,242,255,0.13)_64%,rgba(125,211,252,0.08)_70%,transparent_79%)] opacity-80 blur-[1px] md:block"
          />

          <div className="relative z-10 mx-auto max-w-screen-2xl">
            <div className="max-w-4xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">Request a quote</p>
              <h2 className="mt-4 max-w-4xl font-headline text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Let’s Build Your Next Process Together
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Tell us your material stack, target process, and lab requirements. A NineScrolls engineer can help map
                the right platform and configuration.
              </p>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
                {finalCtaProof.map(item => (
                  <div key={item} className="border-l border-sky-300/50 pl-4 text-sm font-semibold text-slate-200">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/request-quote"
                  className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
                >
                  Request Quote
                </Link>
                <Link
                  to="/contact?topic=expert"
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
                >
                  Talk to an Engineer
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function MappedList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
