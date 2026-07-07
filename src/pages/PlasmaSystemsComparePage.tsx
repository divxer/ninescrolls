import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

interface CleanerComparison {
  name: string;
  route: string;
  chamber: string;
  power: string;
  frequency: string;
  gasLines: string;
  workflow: string;
  controls: string;
  price: string;
  signal: string;
}

const cleaners: CleanerComparison[] = [
  {
    name: 'HY-4L',
    route: '/products/hy-4l',
    chamber: '~4 L',
    power: 'RF or MF',
    frequency: '13.56 MHz / 40 kHz',
    gasLines: '1 standard',
    workflow: 'Teaching, validation, small samples',
    controls: 'PLC + touchscreen',
    price: 'From $6,499',
    signal: 'Lowest entry price',
  },
  {
    name: 'PLUTO-T',
    route: '/products/pluto-t',
    chamber: '~4.3 L',
    power: '200 W RF',
    frequency: '13.56 MHz',
    gasLines: '1, optional 2nd',
    workflow: 'Compact touchscreen RF cleaning',
    controls: 'Touchscreen',
    price: '$9,999',
    signal: 'Compact RF with touchscreen',
  },
  {
    name: 'HY-20L',
    route: '/products/hy-20l',
    chamber: '20 L',
    power: 'RF or MF',
    frequency: '13.56 MHz / 40 kHz',
    gasLines: '1 standard',
    workflow: 'Batch activation and repeatable cleaning',
    controls: 'PLC + touchscreen',
    price: 'From $11,999',
    signal: 'Flexible batch workhorse',
  },
  {
    name: 'PLUTO-M',
    route: '/products/pluto-m',
    chamber: '~8 L',
    power: '200 W RF',
    frequency: '13.56 MHz',
    gasLines: '2 standard',
    workflow: 'Larger fixtures and small batches',
    controls: 'Touchscreen + recipe storage',
    price: '$12,999',
    signal: 'Mid-size RF workflow',
  },
  {
    name: 'HY-20LRF',
    route: '/products/hy-20lrf',
    chamber: '20 L',
    power: '300 W RF',
    frequency: '13.56 MHz',
    gasLines: '1 standard',
    workflow: 'Tray-based repeatable processing',
    controls: 'PLC + touchscreen',
    price: '$14,499',
    signal: 'Research batch RF',
  },
  {
    name: 'PLUTO-F',
    route: '/products/pluto-f',
    chamber: '~14.5 L',
    power: '500 W RF',
    frequency: '13.56 MHz',
    gasLines: '2 standard',
    workflow: 'Higher power and advanced recipes',
    controls: 'Touchscreen + multi-step recipes',
    price: '$15,999',
    signal: 'Highest RF power',
  },
];

const rows: Array<[string, keyof CleanerComparison]> = [
  ['Chamber', 'chamber'],
  ['Power', 'power'],
  ['Frequency', 'frequency'],
  ['Gas Lines', 'gasLines'],
  ['Best Fit', 'workflow'],
  ['Controls', 'controls'],
  ['Price', 'price'],
];

export function PlasmaSystemsComparePage() {
  useScrollToTop();

  const structuredData = {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    name: 'NineScrolls plasma cleaner comparison',
    itemListElement: cleaners.map((cleaner, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cleaner.name,
      url: `https://ninescrolls.com${cleaner.route}`,
    })),
  };

  return (
    <>
      <SEO
        title="Compare Plasma Cleaners | HY & PLUTO Models"
        description="Compare six NineScrolls plasma cleaners by chamber volume, RF power, frequency, gas lines, workflow, and price."
        keywords="plasma cleaner comparison, RF plasma cleaner comparison, HY-4L, HY-20L, HY-20LRF, PLUTO-T, PLUTO-M, PLUTO-F"
        url="/products/plasma-cleaner/compare"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <section className="border-b border-slate-200 bg-[#FAFAFA]">
        <div className="mx-auto max-w-screen-2xl px-6 py-8 lg:px-10">
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'Compare', path: '/products/plasma-cleaner/compare' },
          ]} />
          <div className="grid gap-10 py-14 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <span className="mb-5 block text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Cleaner Model Matrix</span>
              <h1 className="max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight text-slate-950 md:text-7xl">
                Compare plasma cleaners by chamber, power, and workflow.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                Six buy-online systems cover compact sample prep, teaching labs, batch surface activation, and higher-power RF cleaning. Use this page for first-pass model selection.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
              <span className="block text-xs font-bold uppercase tracking-[0.18em]">Purchase Path</span>
              <span className="mt-1 block text-2xl font-headline font-bold">Buy Online</span>
              <span className="mt-1 block text-sm font-semibold">RFQ also available for institutional procurement</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="mb-8 flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Decision Table</span>
            <h2 className="text-4xl font-headline font-bold tracking-tight text-slate-950">Side-by-side model matrix</h2>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              Compare the highest-signal specs first. Each model opens to a full product page with photos, variants, cart options, and quote path.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="sticky left-0 z-10 w-40 bg-slate-100 p-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Criteria</th>
                  {cleaners.map((cleaner) => (
                    <th key={cleaner.name} className="border-l border-slate-200 p-4 text-left align-top">
                      <span className="block text-lg font-headline font-bold text-slate-950">{cleaner.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-sky-700">{cleaner.signal}</span>
                      <Link to={cleaner.route} className="mt-3 inline-flex text-sm font-bold text-sky-700">
                        View {cleaner.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, key], rowIndex) => (
                  <tr key={label} className={`border-b border-slate-100 last:border-b-0 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <th className="sticky left-0 z-10 bg-inherit p-4 text-left text-sm font-bold text-slate-950">{label}</th>
                    {cleaners.map((cleaner) => (
                      <td key={`${cleaner.name}-${key}`} className={`border-l border-slate-100 p-4 text-sm leading-6 ${key === 'price' ? 'font-bold text-slate-950' : 'text-slate-600'}`}>
                        {cleaner[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-screen-2xl gap-6 px-6 md:grid-cols-3 lg:px-10">
          {[
            ['Start compact', 'Choose HY-4L or PLUTO-T when chamber size is secondary to price, footprint, and fast sample prep.'],
            ['Scale batch work', 'Choose HY-20L, HY-20LRF, or PLUTO-M when fixture size, repeated recipes, and batch cleaning matter.'],
            ['Maximize RF power', 'Choose PLUTO-F when higher RF power and a larger chamber are more important than entry price.'],
          ].map(([heading, copy]) => (
            <div key={heading} className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-headline font-bold text-slate-950">{heading}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="rounded-xl bg-slate-950 p-8 text-white md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">Still Deciding?</span>
                <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight">Send your sample size and process goal.</h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  We can help narrow model choice for bonding prep, polymer activation, optics cleaning, biomedical surfaces, and batch sample preparation.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/products/plasma-cleaner" className="inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  Back to Cleaners
                </Link>
                <Link to="/request-quote?products=plasma-cleaner" className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-500">
                  Request Quote
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
