import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ConversionCard, ConversionHero } from '../components/conversion';
import { useScrollToTop } from '../hooks/useScrollToTop';

const roles = [
  {
    title: 'Sales Representative',
    desc: 'Develop relationships with universities, national labs, and research institutions. Manage the full sales cycle for capital equipment — from initial outreach to purchase order.',
    highlights: ['University and national lab account development', 'Capital equipment sales cycle management', 'Trade show and conference representation'],
    location: 'San Diego, CA',
    type: 'Full-time',
  },
  {
    title: 'Applications / Pre-Sales Engineer',
    desc: 'Provide technical consultation and live demos. Help customers identify the right plasma or thin film solution for their specific research needs.',
    highlights: ['Technical feasibility assessments', 'System configuration and selection guidance', 'Application-specific demo and evaluation support'],
    location: 'San Diego, CA',
    type: 'Full-time',
  },
  {
    title: 'Field Service / After-Sales Engineer',
    desc: 'Support equipment installation, commissioning, and ongoing maintenance at customer sites across the U.S. Ensure researchers get the most out of their systems.',
    highlights: ['On-site installation and commissioning', 'Preventive maintenance and troubleshooting', 'Customer training and process optimization'],
    location: 'San Diego, CA + Travel',
    type: 'Full-time',
  },
];

const whyValues = [
  {
    title: 'Work close to research customers',
    desc: 'Support universities, national laboratories, and R&D teams that need practical equipment guidance for advanced process work.',
  },
  {
    title: 'Build a technical commercial function',
    desc: 'Help shape the sales, applications, and service motion for a growing scientific equipment company.',
  },
  {
    title: 'Stay connected to process technology',
    desc: 'Work around plasma processing, thin-film deposition, surface preparation, and microfabrication equipment.',
  },
];

export function CareersPage() {
  useScrollToTop();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Careers at NineScrolls LLC',
    description:
      'Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems. Explore opportunities in sales, applications engineering, and field service.',
    mainEntity: {
      '@type': 'Organization',
      name: 'NineScrolls LLC',
      url: 'https://ninescrolls.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'San Diego',
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    },
  };

  return (
    <>
      <SEO
        title="Careers"
        description="Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems serving US universities. Explore roles in sales, pre-sales engineering, and field service."
        keywords="scientific equipment careers, plasma processing jobs, thin film deposition careers, lab equipment sales, field service engineer, San Diego scientific jobs, NineScrolls careers"
        url="/careers"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="Careers"
          title="Build the next generation of scientific equipment support"
          copy="NineScrolls is building a technical commercial and service team for research-grade plasma processing, thin-film deposition, and surface-preparation equipment."
          primaryAction={{ label: 'Email Careers', href: 'mailto:careers@ninescrolls.com' }}
          secondaryAction={{ label: 'Explore Product Platforms', href: '/products' }}
          trustItems={['San Diego, CA', 'Sales + applications + service', 'Research equipment focus']}
        />

        <section className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Why NineScrolls</span>
              <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                A practical place to work on technical equipment growth.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                We welcome motivated people who can translate between researchers, equipment requirements,
                and post-sale support realities.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {whyValues.map((value) => (
                <ConversionCard key={value.title} className="h-full">
                  <h3 className="text-lg font-headline font-bold tracking-tight text-slate-950">{value.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{value.desc}</p>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Anticipated roles</span>
              <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight text-slate-950">
                Roles we expect to grow around.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                We are currently growing and expect to hire for the following positions as the company expands.
              </p>
            </div>
            <div className="mt-10 space-y-4">
              {roles.map((job) => (
                <ConversionCard key={job.title}>
                  <div className="grid gap-6 lg:grid-cols-[0.65fr_1fr]">
                    <div>
                      <h3 className="text-2xl font-headline font-bold tracking-tight text-slate-950">{job.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {job.location} · {job.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm leading-6 text-slate-600">{job.desc}</p>
                      <ul className="mt-5 grid gap-2 md:grid-cols-3">
                        {job.highlights.map((highlight) => (
                          <li key={highlight} className="rounded-md border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-sm text-slate-600">
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </ConversionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-16 text-white lg:px-10">
          <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Get in touch</span>
              <h2 className="mt-4 text-4xl font-headline font-bold tracking-tight">Interested in joining NineScrolls?</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                We do not always have open positions listed, but we welcome inquiries from people who understand
                scientific equipment, research customers, and technical support.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:careers@ninescrolls.com"
                className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700"
              >
                careers@ninescrolls.com
              </a>
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                About NineScrolls
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Our Equipment
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
