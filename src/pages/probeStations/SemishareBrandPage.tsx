import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../../components/common/SEO';
import { PartnerAttestationBanner } from '../../components/probeStations/PartnerAttestationBanner';
import { SourcedSpecTable } from '../../components/probeStations/SourcedSpecTable';
import { ProbeStationHero } from '../../components/probeStations/ProbeStationHero';
import { ProbeStationCtaBand } from '../../components/probeStations/ProbeStationCtaBand';
import {
  ATTESTATION_CONFIRMED,
  getBrandPageSeoTitle,
  getPartnerJsonLdDescription,
  productLines,
} from '../../data/probeStations/semishare';
import { ProductEvidence } from '../../components/products/ProductEvidence';
import { useScrollToTop } from '../../hooks/useScrollToTop';

// SEMISHARE brand page. Content model is bespoke (evidence/attestation-driven,
// live-sourced specs, no commerce panel) so it does NOT use the config-driven
// ProductDetailPage component — but it shares the probe-station cluster's dark
// theme (ProbeStationHero + ProbeStationCtaBand) and mirrors ProductDetailPage's
// light-band content vocabulary (#FAFAFA canvas, sky-600 eyebrows, font-headline,
// rounded-2xl slate-bordered cards) so it reads as one system with both.

const heroStats = [
  { label: 'Quoting', value: 'USD, delivered' },
  { label: 'SAM.gov UEI', value: 'C4BFCTH5L5D1' },
  { label: 'Serving labs', value: 'Since 2018' },
  { label: 'Coverage', value: 'US & Canada' },
];

const whyBuy = [
  {
    title: 'US import, done for you',
    copy:
      'Customs, tariffs, and freight handled end-to-end — your PO is in USD with delivered pricing, not an overseas wire and a customs broker to find.',
  },
  {
    title: 'Federal-ready procurement',
    copy:
      'NineScrolls LLC is SAM.gov-registered (UEI C4BFCTH5L5D1), supporting NSF/DOE-funded and other federally funded purchases.',
  },
  {
    title: 'Local support since 2018',
    copy:
      '8+ years supplying North American research labs — installation coordination, warranty handling, and a US time-zone contact.',
  },
];

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
    <div className="bg-[#FAFAFA] text-slate-950">
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

      <ProbeStationHero
        motif="wafer"
        breadcrumbs={[
          { label: 'Wafer Probe Stations', to: '/wafer-probe-stations' },
          { label: 'SEMISHARE', to: '/wafer-probe-stations/semishare' },
        ]}
        eyebrow="SEMISHARE"
        title={<>SEMISHARE wafer probe stations — US &amp; Canada procurement</>}
        description="SEMISHARE builds manual, semi-automatic, and fully automatic wafer probe stations, plus cryogenic vacuum systems and wafer-level silicon photonics probing. NineScrolls gives US and Canadian labs a direct procurement path: USD quoting, import and customs handled, and local support."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=semishare-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
        aside={
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
            <PartnerAttestationBanner />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {heroStats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 font-mono text-lg font-semibold tracking-normal text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* Product lines */}
      <section className="px-6 py-20 md:px-10 lg:px-16">
        <div className="mx-auto max-w-screen-2xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Product lines</p>
            <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
              Five families, one procurement path
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              From hand-driven analytical stations to fully automatic ATE probing and cryogenic vacuum
              systems. Specifications are drawn from manufacturer public materials and confirmed with
              the OEM before quoting.
            </p>
          </div>
          <div className="mt-10 grid gap-4">
            {productLines.map((line) => (
              <article key={line.key} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
                <h3 className="text-xl font-semibold tracking-normal text-slate-950">{line.name}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{line.positioning}</p>
                <div className="mt-6">
                  <SourcedSpecTable specs={line.specs} caption={line.name} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why buy through NineScrolls */}
      <section className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
        <div className="mx-auto max-w-screen-2xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Procurement</p>
            <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
              Why buy through NineScrolls
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {whyBuy.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6">
                <h3 className="text-xl font-semibold tracking-normal text-slate-950">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic, Evidence-framework-driven peer-reviewed research (published
          probe-station publication records). Renders nothing until records
          publish, and already carries the shared template section styling. */}
      <ProductEvidence productSlug="probe-station" />

      {/* FAQ */}
      <section className="border-t border-slate-200 bg-[#FAFAFA] px-6 py-20 md:px-10 lg:px-16">
        <div className="mx-auto max-w-screen-2xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">FAQ</p>
            <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
              Frequently asked questions
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqs.map((f) => (
              <article key={f.question} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold tracking-normal text-slate-950">{f.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{f.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProbeStationCtaBand
        title="Get a US quote for a SEMISHARE probe station"
        copy={
          <>
            Send your application details — we confirm the exact configuration with SEMISHARE and
            quote with delivery and support included. New to probe stations? Start with the{' '}
            <Link to="/wafer-probe-stations" className="text-sky-300 underline hover:text-sky-200">
              probe station selection hub
            </Link>
            .
          </>
        }
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=semishare-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
      />
    </div>
  );
}
