import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../../components/common/SEO';
import { StationTypeComparison } from '../../components/probeStations/StationTypeComparison';
import { SchematicFigure } from '../../components/probeStations/SchematicFigure';
import { ProbeStationHero, HeroAtAGlance } from '../../components/probeStations/ProbeStationHero';
import { ProbeStationCtaBand } from '../../components/probeStations/ProbeStationCtaBand';
import { useScrollToTop } from '../../hooks/useScrollToTop';

const faqs = [
  {
    question: 'What does a wafer probe station do?',
    answer:
      'A probe station holds a wafer or die flat and stable while fine-tipped probes land on bond pads or on-wafer device terminals, carrying electrical or optical signals out to your measurement instruments. It combines a chuck, micropositioners, optics, and shielded signal paths.',
  },
  {
    question: 'Manual or semi-automatic probe station — which should a university lab buy?',
    answer:
      'If your group characterizes a handful of devices per sample, a manual analytical station is usually the correct tool, not a compromise. Semi-automatic stations earn their cost for repeated multi-site measurements, where recipe-assisted stepping improves consistency and operator efficiency.',
  },
  {
    question: 'Can I buy a probe station in the US through NineScrolls?',
    answer:
      'Yes. NineScrolls is a US-based (San Diego, California) research equipment supplier handling quoting, import, delivery, and after-sales support for probe stations across the US and Canada, including SEMISHARE wafer probe stations.',
  },
  {
    question: 'What information do you need for a probe station quote?',
    answer:
      'Largest sample size, measurement type (DC, RF, or optical), temperature requirements, and expected measurement volume. Send those through our request-a-quote form and we confirm the exact configuration with the manufacturer before quoting.',
  },
];

export function WaferProbeStationsPage() {
  useScrollToTop();

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
        title="Wafer Probe Stations for Research Labs | Manual, Semi-Automatic & Cryogenic"
        description="How to choose a wafer probe station for university and industry research: manual vs semi-automatic vs fully automatic, temperature environments, DC/RF/optical signals — with a US procurement path."
        keywords="wafer probe station, probe station university research, manual probe station, semi-automatic probe station, cryogenic probe station"
        url="/wafer-probe-stations"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <ProbeStationHero
        motif="system"
        breadcrumbs={[{ label: 'Wafer Probe Stations', to: '/wafer-probe-stations' }]}
        eyebrow="Test & Probing"
        title="Wafer probe stations for research labs"
        description="Put a probe tip on a bond pad and measure a device before dicing. This hub walks through the choices that determine which probe station fits your research — automation level, temperature environment, and signal type — and gives US and Canadian labs a clear procurement path."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=wafer-probe-station' }}
        secondaryAction={{ label: 'Browse SEMISHARE product lines', to: '/wafer-probe-stations/semishare' }}
        aside={
          <HeroAtAGlance
            title="Automation levels"
            items={[
              { label: 'Manual', value: 'Hands-on, flexible setups' },
              { label: 'Semi-automatic', value: 'Recipe-assisted stepping' },
              { label: 'Fully automatic', value: 'Programmed wafer maps' },
            ]}
          />
        }
      />

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            What a probe station is made of
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Every probe station combines four things: a chuck that holds (and often heats or cools)
            the sample, micropositioners that move probe tips with micron-level precision, a
            microscope or camera, and shielded connections that carry the signal to your
            instruments. Everything else — automation, vacuum enclosures, RF calibration, fiber
            alignment — is a layer on top of that core.
          </p>
          <SchematicFigure
            srcBase="/assets/images/insights/probe-station-anatomy"
            alt="Probe station core subsystems: chuck, micropositioners, optics, signal path"
            caption="Core subsystems of a wafer probe station"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            Manual, semi-automatic, or fully automatic
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            This single choice moves the price the most, and the right answer is set by how many
            measurements you run — not by how advanced the lab wants to feel.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <StationTypeComparison />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            Go deeper by application
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link to="/applications/cryogenic-probing" className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-sky-200 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-slate-950">Cryogenic probing guide</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Vacuum cryogenic stations for superconductors, quantum transport, and 2D materials.
              </p>
            </Link>
            <Link to="/applications/silicon-photonics-probing" className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-sky-200 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-slate-950">Silicon photonics probing guide</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Wafer-level photonic testing with fiber alignment alongside electrical probes.
              </p>
            </Link>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-[#FAFAFA] p-6 text-base leading-8 text-slate-600">
            <p>
              Looking for specific systems?{' '}
              <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
                Browse SEMISHARE product lines
              </Link>{' '}
              available through our US procurement channel, or read our{' '}
              <Link to="/insights/how-to-choose-wafer-probe-station-university-lab" className="font-semibold text-sky-700 underline">
                university lab buyer's guide
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#FAFAFA] px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((f) => (
              <article key={f.question} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-950">{f.question}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{f.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProbeStationCtaBand
        title="Ready to spec a probe station?"
        copy="Tell us your sample size, signal type, and temperature needs — we confirm the configuration with the manufacturer and quote with US delivery and support included."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=wafer-probe-station' }}
        secondaryAction={{ label: 'Browse SEMISHARE product lines', to: '/wafer-probe-stations/semishare' }}
      />
    </div>
  );
}
