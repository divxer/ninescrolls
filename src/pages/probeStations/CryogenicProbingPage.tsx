import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { SchematicFigure } from '../../components/probeStations/SchematicFigure';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function CryogenicProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-white text-slate-950">
      <SEO
        title="Cryogenic Probe Stations: Low-Temperature Wafer Probing Guide"
        description="When your science lives at low temperature — superconductors, quantum transport, 2D materials — the cryogenic stage is the most important part of the probe station. A buyer's guide for research labs."
        keywords="cryogenic probe station, low temperature probe station, vacuum probe station, quantum transport measurement"
        url="/applications/cryogenic-probing"
      />
      <Breadcrumbs items={[{ name: 'Cryogenic Probing', path: '/applications/cryogenic-probing' }]} />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Applications</p>
        <h1 className="mt-3 text-4xl font-bold">Cryogenic probe stations for low-temperature research</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Ambient probing covers most electrical characterization. But if your devices only show
          their physics cold — superconducting electronics, quantum transport, 2D material
          devices — the temperature stage becomes the defining (and most expensive) part of the
          system. Here is how to think about it.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">The three temperature regimes</h2>
        <p className="mt-3 text-slate-700">
          Probing setups fall into three tiers. An ambient station measures at room temperature.
          A thermal-chuck station adds a heated or cooled chuck for reliability and
          temperature-dependent I–V work. A cryogenic-vacuum station encloses the sample in
          vacuum and cools it with liquid nitrogen or liquid helium / closed-cycle architectures —
          the regime where superconductivity and quantum transport phenomena become measurable.
          Exact usable temperature limits depend on the chuck, cooling architecture, vacuum
          package, wiring, and options; verify the range against the selected configuration.
        </p>
        <SchematicFigure
          src="/assets/images/insights/probe-station-temperature-regimes.png"
          alt="Ambient, thermal-chuck, and cryogenic-vacuum probing regimes with example applications"
          caption="Temperature regimes and the research that maps to each"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Why vacuum matters</h2>
        <p className="mt-3 text-slate-700">
          Below the dew point, any surface in open air ices over. Cryogenic stations therefore
          probe inside an evacuated chamber: the vacuum prevents condensation, improves thermal
          stability, and reduces convective heat load on the chuck. Optical windows and
          magnetic-field options extend the same platform to spintronics and optoelectronic
          studies.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What to check before you buy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li>Base temperature under real probing load — not just the bare-chuck figure.</li>
          <li>Cooldown time and liquid-cryogen consumption per run, which set your daily cadence.</li>
          <li>Probe-arm thermal anchoring, so the tips do not heat your device.</li>
          <li>Optical access, magnet options, and RF feedthroughs if your roadmap needs them.</li>
        </ul>
        <p className="mt-4 text-slate-700">
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
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Planning a low-temperature setup?</h2>
          <p className="mt-2 text-white/80">
            Tell us your target temperature, sample size, and signal type — we will confirm a
            configuration with the manufacturer and quote with US delivery and support.
          </p>
          <Link to="/request-quote?products=cryogenic-probe-station" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
