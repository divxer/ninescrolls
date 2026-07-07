import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';
import { useScrollToTop } from '../hooks/useScrollToTop';

const serviceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Equipment Service & Support",
  "provider": {
    "@type": "Organization",
    "name": "NineScrolls LLC",
    "url": "https://ninescrolls.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "San Diego",
      "addressRegion": "CA",
      "addressCountry": "US"
    }
  },
  "description": "Comprehensive warranty, preventive maintenance, and annual maintenance contract (AMC) service packages for plasma processing and thin film deposition equipment.",
  "areaServed": {
    "@type": "Country",
    "name": "United States"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "AMC Service Packages",
    "itemListElement": [
      {
        "@type": "Offer",
        "name": "Basic AMC",
        "description": "2 PM visits, priority support, 15% parts discount, remote diagnostics",
        "priceCurrency": "USD",
        "price": "12000",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "12000",
          "priceCurrency": "USD",
          "billingDuration": "P1Y"
        }
      },
      {
        "@type": "Offer",
        "name": "Premium AMC",
        "description": "4 PM visits, 48-hour on-site response, 25% parts discount, software updates, 24/7 voicemail for critical issues",
        "priceCurrency": "USD",
        "price": "25000",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "25000",
          "priceCurrency": "USD",
          "billingDuration": "P1Y"
        }
      },
      {
        "@type": "Offer",
        "name": "Custom AMC",
        "description": "Tailored service package with dedicated support team, flexible terms, and multi-site support"
      }
    ]
  }
};

const coverageItems = [
  {
    title: '2-year standard warranty',
    copy: 'Every NineScrolls system includes 2-year standard warranty coverage for parts, labor, and technical support.',
  },
  {
    title: 'Preventive maintenance',
    copy: 'One preventive maintenance visit is included with system purchase to support startup, calibration, and optimization.',
  },
  {
    title: 'Annual service options',
    copy: 'Optional annual maintenance contracts can add scheduled PM visits, priority support, parts discounts, and remote diagnostics.',
  },
];

const serviceProcess = [
  {
    title: 'Initial assessment',
    copy: 'We review the equipment model, usage profile, fault history, and facility requirements before recommending a service path.',
  },
  {
    title: 'Service planning',
    copy: 'NineScrolls proposes remote support, field service, PM scheduling, or an AMC package based on uptime and process needs.',
  },
  {
    title: 'Implementation',
    copy: 'Service work is coordinated around access windows, parts requirements, documentation, and process restart expectations.',
  },
  {
    title: 'Ongoing support',
    copy: 'Regular check-ins, PM reminders, and technical support help keep research and production equipment available.',
  },
];

const amcPackages = [
  {
    title: 'Basic AMC',
    eyebrow: 'Starting from $12,000/year',
    copy: 'Best for benchtop systems and lower-utilization research tools.',
    items: ['2 preventive maintenance visits', 'Priority technical support', '15% parts discount', 'Remote diagnostics'],
  },
  {
    title: 'Premium AMC',
    eyebrow: 'Starting from $25,000/year',
    copy: 'Recommended for production-scale systems or facilities with tighter uptime expectations.',
    items: ['4 preventive maintenance visits', '48-hour on-site response for covered locations', '25% parts discount', 'Software updates included'],
  },
  {
    title: 'Custom AMC',
    eyebrow: 'Quoted by scope',
    copy: 'Designed for multi-site deployments, unusual configurations, or specialized support requirements.',
    items: ['Dedicated support planning', 'Flexible service terms', 'Optional parts coverage', 'Custom training programs'],
  },
];

export function ServiceSupportPage() {
  useScrollToTop();

  return (
    <>
      <SEO
        title="Warranty & Service Support"
        description="NineScrolls provides 2-year standard warranty, preventive maintenance, and annual maintenance contract (AMC) packages for plasma processing and thin film deposition equipment. Currently serving the continental United States."
        keywords="warranty, service support, equipment maintenance, AMC, annual maintenance contract, preventive maintenance, technical support, semiconductor equipment service"
        url="/service-support"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(serviceStructuredData)}
        </script>
      </Helmet>

      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="Service Support"
          title="Service support for process equipment"
          copy="Warranty, preventive maintenance, and annual service planning for NineScrolls plasma processing and thin-film systems."
          primaryAction={{ label: 'Request Service Quote', href: '/contact?topic=service' }}
          secondaryAction={{ label: 'Talk to an Engineer', href: '/contact?topic=expert' }}
          trustItems={['2-year standard warranty', 'Continental U.S. field support', 'Remote technical support']}
        />

        <section className="mx-auto max-w-7xl px-8 py-16">
          <div className="mb-10 max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Coverage</span>
            <h2 className="mt-4 font-headline text-4xl font-bold tracking-tight text-slate-950">Warranty and maintenance coverage</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Service terms are designed to support installation, uptime, and long-term process stability without making unsupported market comparisons.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {coverageItems.map((item) => (
              <ConversionCard key={item.title}>
                <h3 className="font-headline text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
              </ConversionCard>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-8 py-16 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">AMC Packages</span>
              <h2 className="mt-4 font-headline text-4xl font-bold tracking-tight text-slate-950">Annual maintenance options</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Choose a service package for scheduled preventive maintenance, response planning, remote diagnostics, and parts support.
              </p>
              <Link
                to="/contact?topic=amc"
                className="mt-8 inline-flex rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
              >
                Discuss AMC Coverage
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {amcPackages.map((pkg) => (
                <ConversionCard key={pkg.title}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">{pkg.eyebrow}</p>
                      <h3 className="mt-2 font-headline text-2xl font-bold text-slate-950">{pkg.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{pkg.copy}</p>
                    </div>
                    <TrustSignalList items={pkg.items.map((item) => ({ title: item }))} />
                  </div>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-8 py-16">
          <div className="mb-10 max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Process</span>
            <h2 className="mt-4 font-headline text-4xl font-bold tracking-tight text-slate-950">How service support works</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              A clear service path keeps equipment owners aligned on diagnosis, scope, response timing, and restart expectations.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {serviceProcess.map((step, index) => (
              <ConversionCard key={step.title}>
                <span className="text-sm font-bold text-sky-600">0{index + 1}</span>
                <h3 className="mt-4 font-headline text-xl font-bold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.copy}</p>
              </ConversionCard>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-8 py-16 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-headline text-4xl font-bold tracking-tight">Plan your next service window.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Share your equipment model, usage profile, and support needs. NineScrolls will help define the right service path.
              </p>
            </div>
            <Link
              to="/contact?topic=service"
              className="inline-flex w-fit rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-500"
            >
              Request Service Quote
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
