import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { SchematicFigure } from '../../components/probeStations/SchematicFigure';
import { ProbeStationHero, HeroAtAGlance } from '../../components/probeStations/ProbeStationHero';
import { ProbeStationCtaBand } from '../../components/probeStations/ProbeStationCtaBand';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function CryogenicProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-[#FAFAFA] text-slate-950">
      <SEO
        title="Cryogenic Probe Stations: When Your Research Needs Low-Temperature Probing"
        description="When superconductors, quantum transport, or 2D materials only show their physics cold, here is when a cryogenic-vacuum probe station is the right tool — and when a thermal chuck is enough."
        keywords="cryogenic probe station, low temperature probe station, vacuum probe station, quantum transport measurement"
        url="/applications/cryogenic-probing"
      />

      <ProbeStationHero
        motif="cryo"
        breadcrumbs={[{ label: 'Cryogenic Probing', to: '/applications/cryogenic-probing' }]}
        eyebrow="Applications"
        title="Cryogenic probe stations for low-temperature research"
        description="Ambient probing covers most electrical characterization. But if your devices only show their physics cold — superconducting electronics, quantum transport, 2D material devices — the temperature stage becomes the defining (and most expensive) part of the system. Here is how to think about it."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=cryogenic-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
        aside={
          <HeroAtAGlance
            title="Three temperature regimes"
            items={[
              { label: 'Ambient', value: 'Room-temperature probing' },
              { label: 'Thermal chuck', value: 'Heated / cooled chuck' },
              { label: 'Cryogenic vacuum', value: 'LN₂ / LHe, inside vacuum' },
            ]}
          />
        }
      />

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            The three temperature regimes
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Probing setups fall into three tiers. An ambient station measures at room temperature.
            A thermal-chuck station adds a heated or cooled chuck for reliability and
            temperature-dependent I–V work. A cryogenic-vacuum station encloses the sample in
            vacuum and cools it with liquid nitrogen or liquid helium / closed-cycle architectures —
            the regime where superconductivity and quantum transport phenomena become measurable.
            Exact usable temperature limits depend on the chuck, cooling architecture, vacuum
            package, wiring, and options; verify the range against the selected configuration.
          </p>
          <SchematicFigure
            srcBase="/assets/images/insights/probe-station-temperature-regimes"
            alt="Ambient, thermal-chuck, and cryogenic-vacuum probing regimes with example applications"
            caption="Temperature regimes and the research that maps to each"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            Why vacuum matters
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Below the dew point, any surface in open air ices over. Cryogenic stations therefore
            probe inside an evacuated chamber: the vacuum prevents condensation, improves thermal
            stability, and reduces convective heat load on the chuck. Optical windows and
            magnetic-field options extend the same platform to spintronics and optoelectronic
            studies.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            What to check before you buy
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-6 text-base leading-8 text-slate-600">
            <li>Base temperature under real probing load — not just the bare-chuck figure.</li>
            <li>Cooldown time and liquid-cryogen consumption per run, which set your daily cadence.</li>
            <li>Probe-arm thermal anchoring, so the tips do not heat your device.</li>
            <li>Optical access, magnet options, and RF feedthroughs if your roadmap needs them.</li>
          </ul>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-base leading-8 text-slate-600">
            <p>
              Start from the{' '}
              <Link to="/wafer-probe-stations" className="font-semibold text-sky-700 underline">
                probe station selection hub
              </Link>{' '}
              for the full decision framework, or browse{' '}
              <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
                SEMISHARE product lines
              </Link>{' '}
              — including cryogenic vacuum systems — available with US procurement and support.
            </p>
            <p className="mt-4">
              Ready to compare systems? Read the full{' '}
              <Link to="/insights/cryogenic-probe-station-buyers-guide" className="font-semibold text-sky-700 underline">
                cryogenic probe station buyer&rsquo;s guide
              </Link>{' '}
              for cooling architectures, spec interpretation, and an acceptance-ready RFQ checklist.
            </p>
          </div>
        </div>
      </section>

      <ProbeStationCtaBand
        title="Planning a low-temperature setup?"
        copy="Tell us your target temperature, sample size, and signal type — we will confirm a configuration with the manufacturer and quote with US delivery and support."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=cryogenic-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
      />
    </div>
  );
}
