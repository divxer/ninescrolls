import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PartnerAttestationBanner } from '../../components/probeStations/PartnerAttestationBanner';
import { SourcedSpecTable } from '../../components/probeStations/SourcedSpecTable';
import {
  ATTESTATION_CONFIRMED,
  getBrandPageSeoTitle,
  getPartnerJsonLdDescription,
  productLines,
  SEMISHARE_PUBLICATIONS,
} from '../../data/probeStations/semishare';
import { useScrollToTop } from '../../hooks/useScrollToTop';

const faqs = [
  {
    question: 'Who is SEMISHARE?',
    answer:
      'SEMISHARE CO., LTD. is a wafer probe station manufacturer headquartered in Shenzhen, China, founded in 2010, with product lines spanning manual, semi-automatic, and fully automatic probe stations plus cryogenic vacuum systems and wafer-level silicon photonics probing.',
  },
  {
    question: 'How do I buy a SEMISHARE probe station in the United States?',
    answer:
      'Request a quote through NineScrolls. We are a US-based (San Diego, California) research equipment supplier: we confirm your configuration with SEMISHARE, quote in USD with import and delivery included, and provide local after-sales support.',
  },
  {
    question: 'Can university and government labs purchase through NineScrolls?',
    answer:
      'Yes. NineScrolls LLC is a registered US federal supplier on SAM.gov (UEI C4BFCTH5L5D1) and has served university procurement systems, including UC-system and Tier-1 research university purchasing, since 2018.',
  },
  {
    question: 'Where are SEMISHARE probe stations used in research?',
    answer:
      'SEMISHARE probe stations are named in the methods of peer-reviewed studies worldwide, including work published in Nature Communications and Nature Materials — see the publications section on this page for verified, DOI-linked examples.',
  },
  {
    question: 'What about warranty and support in North America?',
    answer:
      'NineScrolls coordinates warranty service and technical support locally, with direct escalation to SEMISHARE engineering — one English-speaking point of contact in a US time zone.',
  },
];

export function SemishareBrandPage() {
  useScrollToTop();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NineScrolls LLC',
    url: 'https://ninescrolls.com/wafer-probe-stations/semishare',
    description: getPartnerJsonLdDescription(ATTESTATION_CONFIRMED),
    areaServed: ['US', 'CA'],
    knowsAbout: [
      'SEMISHARE wafer probe stations',
      'semi-automatic probe stations',
      'cryogenic vacuum probe stations',
      'wafer-level silicon photonics testing',
    ],
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <div className="bg-white text-slate-950">
      <SEO
        title={getBrandPageSeoTitle(ATTESTATION_CONFIRMED)}
        description="Buy SEMISHARE wafer probe stations in the US and Canada through NineScrolls: quoting in USD, import and customs handled, local after-sales support, SAM.gov-registered federal supplier."
        keywords="SEMISHARE probe station, SEMISHARE distributor USA, SEMISHARE probe station buy USA, wafer probe station US supplier"
        url="/wafer-probe-stations/semishare"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <Breadcrumbs
        items={[
          { name: 'Wafer Probe Stations', path: '/wafer-probe-stations' },
          { name: 'SEMISHARE', path: '/wafer-probe-stations/semishare' },
        ]}
      />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">SEMISHARE</p>
        <h1 className="mt-3 text-4xl font-bold">SEMISHARE wafer probe stations — US & Canada procurement</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          SEMISHARE builds manual, semi-automatic, and fully automatic wafer probe stations, plus
          cryogenic vacuum systems and wafer-level silicon photonics probing. NineScrolls gives US
          and Canadian labs a direct procurement path: USD quoting, import and customs handled,
          and local support.
        </p>
        <div className="mt-6">
          <PartnerAttestationBanner />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Product lines</h2>
        <div className="mt-6 space-y-10">
          {productLines.map((line) => (
            <div key={line.key}>
              <h3 className="text-xl font-semibold">{line.name}</h3>
              <p className="mt-2 text-slate-700">{line.positioning}</p>
              <div className="mt-4">
                <SourcedSpecTable specs={line.specs} caption={line.name} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Why buy through NineScrolls</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">US import, done for you</h3>
            <p className="mt-2 text-sm text-slate-600">
              Customs, tariffs, and freight handled end-to-end — your PO is in USD with delivered
              pricing, not an overseas wire and a customs broker to find.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Federal-ready procurement</h3>
            <p className="mt-2 text-sm text-slate-600">
              NineScrolls LLC is SAM.gov-registered (UEI C4BFCTH5L5D1), supporting NSF/DOE-funded
              and other federally funded purchases.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Local support since 2018</h3>
            <p className="mt-2 text-sm text-slate-600">
              8+ years supplying North American research labs — installation coordination,
              warranty handling, and a US time-zone contact.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Used in peer-reviewed research</h2>
        <p className="mt-3 max-w-3xl text-slate-600">
          SEMISHARE probe stations appear in the methods of peer-reviewed studies across device
          physics, photonics, wide-bandgap power devices, and materials research.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {SEMISHARE_PUBLICATIONS.map((pub) => (
            <article key={pub.doi} className="rounded-xl border border-slate-200 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                {pub.venue} · {pub.year}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-snug">
                <a
                  href={`https://doi.org/${pub.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-sky-500"
                >
                  {pub.title}
                </a>
              </h3>
              <p className="mt-2 text-sm text-slate-600">{pub.authors}</p>
              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {pub.application}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-5 space-y-6">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-lg font-semibold">{f.question}</h3>
              <p className="mt-2 text-slate-700">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Get a US quote for a SEMISHARE probe station</h2>
          <p className="mt-2 text-white/80">
            Send your application details — we confirm the exact configuration with SEMISHARE and
            quote with delivery and support included. New to probe stations? Start with the{' '}
            <Link to="/wafer-probe-stations" className="text-sky-300 underline">
              probe station selection hub
            </Link>
            .
          </p>
          <Link to="/request-quote?products=semishare-probe-station" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
