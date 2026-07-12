import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function SiliconPhotonicsProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-white text-slate-950">
      <SEO
        title="Silicon Photonics Wafer-Level Testing: Probe Station Guide"
        description="Wafer-level photonic testing needs fiber alignment alongside electrical probes. What silicon photonics groups should look for in a probe station: coupling method, alignment automation, and mixed-signal probing."
        keywords="silicon photonics testing, wafer-level photonic testing, fiber alignment probe station, photonics probe station"
        url="/applications/silicon-photonics-probing"
      />
      <Breadcrumbs items={[{ name: 'Silicon Photonics Probing', path: '/applications/silicon-photonics-probing' }]} />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Applications</p>
        <h1 className="mt-3 text-4xl font-bold">Silicon photonics probing at wafer level</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Photonic chips have to be tested before dicing just like electronic ones — but the
          signal is light. Wafer-level photonic testing adds fiber alignment stages next to the
          electrical probes, so you can couple light into on-chip waveguides while driving and
          reading the device electrically.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What makes photonic probing different</h2>
        <p className="mt-3 text-slate-700">
          Electrical probes tolerate a few microns of placement error; optical coupling does not.
          Grating couplers accept fiber from above with an alignment tolerance of a micron or
          two, while edge coupling needs polished facets and sub-micron control. A photonics-capable probe
          station therefore adds piezo-driven fiber positioners, alignment optimization (peak
          search on transmitted power), and stable mechanics so alignment holds during the sweep.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Mixed-signal reality: photonics is also electronics</h2>
        <p className="mt-3 text-slate-700">
          Modulators, photodetectors, and tuning heaters mean most photonic measurements are
          electro-optical: DC bias plus RF drive plus optical input and output on the same die.
          Plan the station for all three from the start — retrofitting fiber stages onto an
          electrical-only platform is rarely satisfying.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What to check before you buy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li>Coupling method support: grating (vertical) vs edge coupling, or both.</li>
          <li>Alignment automation: manual peak-up is fine for a few devices, painful for a wafer.</li>
          <li>Simultaneous electrical probing: enough positioners around the fiber stages.</li>
          <li>Upgrade path to semi-automatic stepping if your device counts will grow.</li>
        </ul>
        <p className="mt-4 text-slate-700">
          The{' '}
          <Link to="/wafer-probe-stations" className="font-semibold text-sky-700 underline">
            probe station selection hub
          </Link>{' '}
          covers the base-platform decisions; wafer-level silicon photonics probing configurations
          are available through{' '}
          <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
            SEMISHARE product lines
          </Link>{' '}
          with US procurement and support.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Building a photonic test setup?</h2>
          <p className="mt-2 text-white/80">
            Tell us your coupling method, wavelength range, and electrical probing needs — we will
            scope a configuration and quote with US delivery and support.
          </p>
          <Link to="/request-quote?products=silicon-photonics-probe-station" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
