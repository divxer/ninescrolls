import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { ProbeStationHero, HeroAtAGlance } from '../../components/probeStations/ProbeStationHero';
import { ProbeStationCtaBand } from '../../components/probeStations/ProbeStationCtaBand';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function SiliconPhotonicsProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-[#FAFAFA] text-slate-950">
      <SEO
        title="Silicon Photonics Wafer-Level Testing: Probe Station Guide"
        description="Wafer-level photonic testing needs fiber alignment alongside electrical probes. What silicon photonics groups should look for in a probe station: coupling method, alignment automation, and mixed-signal probing."
        keywords="silicon photonics testing, wafer-level photonic testing, fiber alignment probe station, photonics probe station"
        url="/applications/silicon-photonics-probing"
      />

      <ProbeStationHero
        motif="photonics"
        breadcrumbs={[{ label: 'Silicon Photonics Probing', to: '/applications/silicon-photonics-probing' }]}
        eyebrow="Applications"
        title="Silicon photonics probing at wafer level"
        description="Photonic chips have to be tested before dicing just like electronic ones — but the signal is light. Wafer-level photonic testing adds fiber alignment stages next to the electrical probes, so you can couple light into on-chip waveguides while driving and reading the device electrically."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=silicon-photonics-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
        aside={
          <HeroAtAGlance
            title="Coupling & signals"
            items={[
              { label: 'Grating coupler', value: 'Vertical fiber, ~1–2 µm' },
              { label: 'Edge coupling', value: 'Polished facets, sub-µm' },
              { label: 'Mixed-signal', value: 'DC + RF + optical' },
            ]}
          />
        }
      />

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            What makes photonic probing different
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Electrical probes tolerate a few microns of placement error; optical coupling does not.
            Grating couplers accept fiber from above with an alignment tolerance of a micron or
            two, while edge coupling needs polished facets and sub-micron control. A photonics-capable probe
            station therefore adds piezo-driven fiber positioners, alignment optimization (peak
            search on transmitted power), and stable mechanics so alignment holds during the sweep.
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            Mixed-signal reality: photonics is also electronics
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Modulators, photodetectors, and tuning heaters mean most photonic measurements are
            electro-optical: DC bias plus RF drive plus optical input and output on the same die.
            Plan the station for all three from the start — retrofitting fiber stages onto an
            electrical-only platform is rarely satisfying.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-headline text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
            What to check before you buy
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-6 text-base leading-8 text-slate-600">
            <li>Coupling method support: grating (vertical) vs edge coupling, or both.</li>
            <li>Alignment automation: manual peak-up is fine for a few devices, painful for a wafer.</li>
            <li>Simultaneous electrical probing: enough positioners around the fiber stages.</li>
            <li>Upgrade path to semi-automatic stepping if your device counts will grow.</li>
          </ul>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-base leading-8 text-slate-600">
            <p>
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
          </div>
        </div>
      </section>

      <ProbeStationCtaBand
        title="Building a photonic test setup?"
        copy="Tell us your coupling method, wavelength range, and electrical probing needs — we will scope a configuration and quote with US delivery and support."
        primaryAction={{ label: 'Request a quote', to: '/request-quote?products=silicon-photonics-probe-station' }}
        secondaryAction={{ label: 'Probe station selection hub', to: '/wafer-probe-stations' }}
      />
    </div>
  );
}
