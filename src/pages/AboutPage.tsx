import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';
import { useScrollToTop } from '../hooks/useScrollToTop';

const supportResponsibilities = [
  {
    title: 'Application-first equipment selection',
    copy: 'We help research teams map materials, process goals, wafer formats, and facility constraints to the right equipment platform before quotation.',
  },
  {
    title: 'Configuration and quotation support',
    copy: 'NineScrolls prepares configuration guidance, budgetary quotes, and procurement-ready documentation for universities, national laboratories, and R&D teams.',
  },
  {
    title: 'Delivery and installation coordination',
    copy: 'We coordinate shipment, startup planning, documentation, and handoff details so equipment projects fit the realities of research facilities.',
  },
  {
    title: 'Post-sale service and warranty support',
    copy: 'Our team supports technical questions, service coordination, spare-parts planning, and warranty workflows after installation.',
  },
];

const procurementSignals = [
  { title: 'U.S.-based operations', copy: 'San Diego, California' },
  { title: 'D-U-N-S Number', copy: '13-477-6662' },
  { title: 'UEI Number', copy: 'C4BFCTH5L5D1' },
  { title: 'Government ready', copy: 'Registered for federal and institutional procurement workflows.' },
];

const focusAreas = [
  { title: 'Plasma etching', copy: 'ICP-RIE, RIE, ion beam etching, and related process windows.' },
  { title: 'Thin-film deposition', copy: 'PECVD, ALD, sputtering, and process equipment selection for research stacks.' },
  { title: 'Surface preparation', copy: 'Plasma cleaning, activation, coating, developing, and sample-preparation workflows.' },
];

export function AboutPage() {
  useScrollToTop();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About NineScrolls LLC',
    description:
      'NineScrolls LLC is a U.S.-based scientific equipment company supporting universities, national laboratories, and semiconductor innovators with plasma processing and thin-film equipment selection.',
    mainEntity: {
      '@type': 'Organization',
      name: 'NineScrolls LLC',
      description:
        'NineScrolls LLC provides equipment selection, configuration support, quotation support, and post-sale coordination for advanced semiconductor process equipment.',
      foundingDate: '2023',
      url: 'https://ninescrolls.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'San Diego',
        addressRegion: 'CA',
        addressCountry: 'US',
      },
      areaServed: {
        '@type': 'Country',
        name: 'United States',
      },
      knowsAbout: [
        'Semiconductor Manufacturing Equipment',
        'Thin Film Deposition',
        'Plasma Etching',
        'ALD Systems',
        'PECVD Systems',
        'Scientific Research Equipment',
      ],
    },
  };

  return (
    <>
      <SEO
        title="About Us"
        description="NineScrolls LLC is a U.S.-based scientific equipment company supporting universities, national laboratories, and semiconductor innovators with plasma processing and thin-film equipment selection."
        keywords="scientific equipment company, plasma processing, thin film deposition, research equipment, US-based semiconductor equipment, NineScrolls LLC, university lab equipment"
        url="/about"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="About NineScrolls"
          title="U.S.-based support for advanced semiconductor process equipment"
          copy="NineScrolls helps research groups, cleanroom facilities, and semiconductor innovators select, configure, and support plasma processing and thin-film equipment for demanding process work."
          primaryAction={{ label: 'Explore Equipment', href: '/products' }}
          secondaryAction={{ label: 'Talk to an Engineer', href: '/contact?topic=expert' }}
          trustItems={['San Diego, CA', 'Procurement-ready support', 'Application-led configuration']}
        />

        <section className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Operating model</span>
              <h2 className="mt-4 max-w-2xl text-4xl font-headline font-bold tracking-tight text-slate-950">
                Built around the way research equipment is actually selected.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Equipment decisions usually start with a process window, facility constraint, or grant timeline.
                NineScrolls organizes the conversation around those realities before narrowing the platform.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {supportResponsibilities.map((item) => (
                <ConversionCard key={item.title} className="min-h-[190px]">
                  <h3 className="text-xl font-headline font-bold tracking-tight text-slate-950">{item.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.copy}</p>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-screen-2xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.25fr] lg:px-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Engineering focus</span>
              <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                Industrial precision. Scientific confidence.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                Our name reflects the idea that scientific progress depends on order: clear requirements,
                precise process windows, and equipment choices that can be defended in a technical review.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {focusAreas.map((area) => (
                <ConversionCard key={area.title}>
                  <h3 className="text-lg font-headline font-bold tracking-tight text-slate-950">{area.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{area.copy}</p>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Procurement readiness</span>
              <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                Practical details for institutional buyers.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                University and government purchasing teams need clear documentation, company identifiers, and
                accountable support paths. These details stay visible because they matter during procurement.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {procurementSignals.map((signal) => (
                <ConversionCard key={signal.title} className="h-full">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-600">{signal.title}</p>
                  <p className="mt-4 text-lg font-headline font-bold tracking-tight text-slate-950">{signal.copy}</p>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-16 text-white lg:px-10">
          <div className="mx-auto grid max-w-screen-2xl gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Next step</span>
              <h2 className="mt-4 max-w-3xl text-4xl font-headline font-bold tracking-tight">
                Ready to discuss your research equipment path?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Start with the process goal, facility context, or equipment family. We will help route the
                conversation to the right platform and quotation path.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
                >
                  View Product Platforms
                </Link>
                <Link
                  to="/contact?topic=expert"
                  className="inline-flex items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  Request Engineering Consultation
                </Link>
              </div>
            </div>
            <ConversionCard className="border-white/10 bg-white/5 text-white">
              <TrustSignalList
                variant="dark"
                items={[
                  { title: 'Process-first guidance', copy: 'Start with materials, process windows, and application needs.' },
                  { title: 'Procurement-ready documentation', copy: 'Support for quotes, identifiers, and institutional review.' },
                  { title: 'Post-sale coordination', copy: 'Service, warranty, and support paths remain part of the conversation.' },
                ]}
              />
            </ConversionCard>
          </div>
        </section>
      </div>
    </>
  );
}
