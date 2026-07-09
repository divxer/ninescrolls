import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useMemo, useState } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

type ProductFamily = 'Etching' | 'Deposition' | 'Lithography' | 'Plasma Cleaning';
type ProductTab = 'All' | ProductFamily;

interface ProductCard {
  name: string;
  route: string;
  family: ProductFamily;
  eyebrow: string;
  image: string;
  alt: string;
  description: string;
  chips: string[];
  buyingMode: 'RFQ Platform' | 'Buy Online';
  price?: string;
  featured?: boolean;
}

const tabs: ProductTab[] = ['All', 'Etching', 'Deposition', 'Lithography', 'Plasma Cleaning'];

const products: ProductCard[] = [
  {
    name: 'ICP-RIE',
    route: '/products/icp-etcher',
    family: 'Etching',
    eyebrow: 'Featured Etch Platform',
    image: '/assets/images/redesign/products/icp-rie-standardized.webp',
    alt: 'ICP‑RIE plasma etching system in cleanroom',
    description: 'High-density plasma source for deep silicon etching, MEMS, diamond processing, and demanding anisotropy.',
    chips: ['Deep silicon etching', 'MEMS fabrication', 'Diamond processing'],
    buyingMode: 'RFQ Platform',
    featured: true,
  },
  {
    name: 'RIE',
    route: '/products/rie-etcher',
    family: 'Etching',
    eyebrow: 'Directional Etch',
    image: '/assets/images/redesign/products/rie-standardized.webp',
    alt: 'Reactive Ion Etching system (RIE) for anisotropic etch',
    description: 'Reliable anisotropic plasma etching for universities, pilot labs, and surface activation workflows.',
    chips: ['Semiconductor R&D', 'Surface activation', 'Device prototyping'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'Compact Benchtop RIE',
    route: '/products/compact-rie',
    family: 'Etching',
    eyebrow: 'SV-RIE',
    image: '/assets/images/redesign/products/compact-rie-standardized.webp',
    alt: 'Compact RIE Etcher (SV-RIE) - compact reactive ion etching system',
    description: 'Benchtop reactive ion etcher for education, failure analysis, and small-lab process development.',
    chips: ['Small footprint', 'Teaching labs', 'Failure analysis'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'IBE/RIBE',
    route: '/products/ibe-ribe',
    family: 'Etching',
    eyebrow: 'Ion Beam Etch',
    image: '/assets/images/redesign/products/ibe-ribe-standardized.webp',
    alt: 'Ion Beam Etching (IBE/RIBE) system for directional etch',
    description: 'Ion beam milling for directional removal, hard masks, redeposition control, and precision angle etching.',
    chips: ['Ion milling', 'Angle control', 'Endpoint options'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'PECVD',
    route: '/products/pecvd',
    family: 'Deposition',
    eyebrow: 'Plasma CVD',
    image: '/assets/images/redesign/products/pecvd-standardized.webp',
    alt: 'PECVD thin film deposition system',
    description: 'Plasma-enhanced thin-film deposition for dielectric films, passivation, and low-temperature stacks.',
    chips: ['Dielectric films', 'Passivation', 'Low-temperature deposition'],
    buyingMode: 'RFQ Platform',
    featured: true,
  },
  {
    name: 'ALD',
    route: '/products/ald',
    family: 'Deposition',
    eyebrow: 'Atomic Layer Deposition',
    image: '/assets/images/redesign/products/ald-standardized.webp',
    alt: 'Atomic Layer Deposition (ALD) system',
    description: 'Conformal ALD for nanolaminates, barrier layers, high-k dielectrics, and high-aspect-ratio structures.',
    chips: ['Conformal films', 'High-k oxides', 'Remote plasma option'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'Sputter',
    route: '/products/sputter',
    family: 'Deposition',
    eyebrow: 'PVD Platform',
    image: '/assets/images/redesign/products/sputter-standardized.webp',
    alt: 'Sputter deposition system for high‑quality PVD coatings',
    description: 'Magnetron sputtering for metals, oxides, nitrides, reactive sputter, and co-sputtered film stacks.',
    chips: ['2-6 targets', 'DC/RF magnetron', 'Reactive sputter'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'HDP-CVD',
    route: '/products/hdp-cvd',
    family: 'Deposition',
    eyebrow: 'Gap-Fill CVD',
    image: '/assets/images/redesign/products/hdp-cvd-standardized.webp',
    alt: 'HDP‑CVD system for high‑density plasma chemical vapor deposition',
    description: 'High-density plasma CVD for gap fill, STI/IMD/PMD dielectric stacks, and advanced packaging.',
    chips: ['Gap fill', 'Deposition + sputter', 'Advanced packaging'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'E-Beam Evaporator',
    route: '/products/e-beam-evaporator',
    family: 'Deposition',
    eyebrow: 'MEB-600',
    image: '/assets/images/redesign/products/e-beam-standardized.webp',
    alt: 'MEB-600 e-beam and thermal evaporation system for IR and photonic thin films',
    description: 'Multi-source e-beam and thermal evaporation for IR sensors, photonic crystals, and optical multilayers.',
    chips: ['6-pocket e-gun', 'QCM monitoring', 'Optical films'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'Coater/Developer',
    route: '/products/coater-developer',
    family: 'Lithography',
    eyebrow: 'Photoresist Track',
    image: '/assets/images/redesign/products/coater-developer-standardized.webp',
    alt: 'Coater/Developer system for photolithography',
    description: 'Spin coating, developing, bake, HMDS, EBR, and PEB modules for photolithography preparation.',
    chips: ['Spin coat', 'Develop', 'Bake modules'],
    buyingMode: 'RFQ Platform',
    featured: true,
  },
  {
    name: 'Striper',
    route: '/products/striper',
    family: 'Lithography',
    eyebrow: 'Resist Removal',
    image: '/assets/images/redesign/products/striper-standardized.webp',
    alt: 'Plasma photoresist stripping system',
    description: 'Plasma photoresist stripping and ashing platform for post-lithography resist removal.',
    chips: ['Photoresist stripping', 'Ashing', 'Residue removal'],
    buyingMode: 'RFQ Platform',
  },
  {
    name: 'HY-4L',
    route: '/products/hy-4l',
    family: 'Plasma Cleaning',
    eyebrow: 'Compact Cleaner',
    image: '/assets/images/redesign/products/hy-4l-standardized.webp',
    alt: 'HY-4L - Compact RF Plasma System',
    description: 'Compact plasma cleaner for sample preparation, teaching labs, bonding prep, and low-volume research.',
    chips: ['~4 L chamber', 'RF or MF', 'Benchtop workflow'],
    buyingMode: 'Buy Online',
    price: 'From $6,499',
  },
  {
    name: 'HY-20L',
    route: '/products/hy-20l',
    family: 'Plasma Cleaning',
    eyebrow: 'Batch Cleaner',
    image: '/assets/images/redesign/products/hy-20l-standardized.webp',
    alt: 'HY-20L - Compact RF Plasma Processing System',
    description: '20-liter batch plasma processing for surface activation, bonding prep, and repeatable lab cleaning.',
    chips: ['20 L chamber', 'RF or MF', 'Batch processing'],
    buyingMode: 'Buy Online',
    price: 'From $11,999',
  },
  {
    name: 'HY-20LRF',
    route: '/products/hy-20lrf',
    family: 'Plasma Cleaning',
    eyebrow: 'Research Batch Cleaner',
    image: '/assets/images/redesign/products/hy-20lrf-standardized.webp',
    alt: 'HY-20LRF - Research-Grade Batch Plasma Cleaning',
    description: 'Research-grade 20 L RF plasma cleaner with tray-based processing and documented repeatability.',
    chips: ['300 W RF', '4-layer tray', 'Repeatable recipes'],
    buyingMode: 'Buy Online',
    price: '$14,499',
  },
  {
    name: 'PLUTO-T',
    route: '/products/pluto-t',
    family: 'Plasma Cleaning',
    eyebrow: 'Touchscreen Cleaner',
    image: '/assets/images/redesign/products/pluto-t-standardized.webp',
    alt: 'PLUTO-T - Compact RF Plasma Cleaner',
    description: 'Compact RF plasma cleaner with touchscreen control for activation, cleaning, and surface preparation.',
    chips: ['200 W RF', '~4.3 L chamber', 'Touchscreen'],
    buyingMode: 'Buy Online',
    price: '$9,999',
  },
  {
    name: 'PLUTO-M',
    route: '/products/pluto-m',
    family: 'Plasma Cleaning',
    eyebrow: 'Mid-Size Cleaner',
    image: '/assets/images/redesign/products/pluto-m-standardized.webp',
    alt: 'PLUTO-M - Mid-Size RF Plasma Cleaner',
    description: 'Mid-size RF plasma cleaner for larger fixtures, small batch work, and routine lab preparation.',
    chips: ['200 W RF', '~8 L chamber', 'Batch capable'],
    buyingMode: 'Buy Online',
    price: '$12,999',
  },
  {
    name: 'PLUTO-F',
    route: '/products/pluto-f',
    family: 'Plasma Cleaning',
    eyebrow: 'Flagship Cleaner',
    image: '/assets/images/redesign/products/pluto-f-standardized.webp',
    alt: 'PLUTO-F - Flagship RF Plasma Cleaner',
    description: 'Flagship RF plasma cleaner with expanded chamber volume and recipe management for advanced labs.',
    chips: ['500 W RF', '~14.5 L chamber', 'Recipe management'],
    buyingMode: 'Buy Online',
    price: '$15,999',
  },
];

const familyIntros: Record<ProductFamily, { heading: string; copy: string }> = {
  Etching: {
    heading: 'Etching Platforms',
    copy: 'Directional plasma and ion-beam systems for silicon, diamond, MEMS, photonics, compound semiconductors, and failure analysis.',
  },
  Deposition: {
    heading: 'Deposition Platforms',
    copy: 'PECVD, ALD, PVD, e-beam, and HDP-CVD platforms for thin films, dielectric stacks, optical coatings, and gap-fill processes.',
  },
  Lithography: {
    heading: 'Lithography & Resist Processing',
    copy: 'Coating, developing, bake, and resist-removal tools that support patterning workflows before and after etch or deposition.',
  },
  'Plasma Cleaning': {
    heading: 'Plasma Cleaning Systems',
    copy: 'Buy-online plasma cleaners for surface activation, bonding prep, sample cleaning, and routine laboratory workflows.',
  },
};

const trustSignals = [
  ['12+', 'Equipment platforms'],
  ['50+', 'Supported processes'],
  ['2-Year', 'Standard warranty'],
];

function ProductCardView({ product }: { product: ProductCard }) {
  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_20px_60px_rgba(15,23,42,0.10)] ${product.featured ? 'lg:col-span-2' : ''}`}>
      <Link to={product.route} className="flex h-full flex-col">
        <div className={`bg-slate-50 ${product.featured ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
          <img
            src={product.image}
            alt={product.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </div>
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">{product.eyebrow}</span>
              <h3 className="mt-2 text-2xl font-headline font-bold tracking-tight text-slate-950">{product.name}</h3>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${product.buyingMode === 'Buy Online' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {product.buyingMode}
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-600">{product.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {product.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between pt-6">
            <span className="text-sm font-bold text-slate-950">{product.price ?? 'Configure to quote'}</span>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-sky-700">
              View Platform
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ProductsPage() {
  useScrollToTop();
  const [selected, setSelected] = useState<ProductTab>('All');
  const [gateOpen, setGateOpen] = useState(false);

  const visibleProducts = selected === 'All' ? products : products.filter((product) => product.family === selected);

  const schema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'NineScrolls semiconductor process equipment platforms',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: `https://ninescrolls.com${product.route}`,
    })),
  }), []);

  return (
    <>
      <SEO
        title="Semiconductor Process Equipment | Plasma Etching, Deposition & Cleaning"
        description="Choose NineScrolls process equipment by application: ICP-RIE, RIE, PECVD, ALD, sputter, IBE/RIBE, e-beam evaporation, HDP-CVD, coating/developing, stripping, and plasma cleaning systems."
        keywords="semiconductor process equipment, plasma etching systems, thin film deposition systems, plasma cleaner, ICP-RIE, PECVD, ALD, sputter, e-beam evaporator"
        url="/products/"
      />

      <section className="border-b border-slate-200 bg-[#FAFAFA]">
        <div className="mx-auto max-w-screen-2xl px-6 py-8 lg:px-10">
          <Breadcrumbs items={[{ name: 'Products', path: '/products' }]} />
          <div className="grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <span className="mb-5 block text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Process-led equipment selection</span>
              <h1 className="max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight text-slate-950 md:text-7xl">
                Choose the platform that matches your process window.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                Browse NineScrolls systems by process capability, application fit, and purchasing path. RFQ platforms support custom configurations; plasma cleaners can be purchased online or quoted for institutional procurement.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/request-quote" className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700">
                  Request Quote
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => setGateOpen(true)}
                >
                  Download Guide
                </button>
                <Link to="/products/plasma-cleaner" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-slate-400 hover:bg-slate-50">
                  Shop Plasma Cleaners
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              {trustSignals.map(([value, label]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <span className="block text-3xl font-headline font-bold tracking-tight text-slate-950">{value}</span>
                  <span className="mt-2 block text-sm font-semibold text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">Equipment Platforms</span>
              <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight text-slate-950">Process families</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Start with the process you need to run, then compare platform size, process role, purchasing path, and application fit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Product family filters">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelected(tab)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${selected === tab ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                  aria-pressed={selected === tab}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {selected === 'All' ? (
            <div className="mt-10 space-y-14">
              {(Object.keys(familyIntros) as ProductFamily[]).map((family) => (
                <section key={family} aria-labelledby={`${family.replace(/\W+/g, '-').toLowerCase()}-heading`}>
                  <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 id={`${family.replace(/\W+/g, '-').toLowerCase()}-heading`} className="text-2xl font-headline font-bold tracking-tight text-slate-950">
                        {familyIntros[family].heading}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{familyIntros[family].copy}</p>
                    </div>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {products.filter((product) => product.family === family).map((product) => (
                      <ProductCardView key={product.route} product={product} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="mt-10" aria-labelledby="filtered-products-heading">
              <div className="mb-6">
                <h2 id="filtered-products-heading" className="text-2xl font-headline font-bold tracking-tight text-slate-950">
                  {familyIntros[selected].heading}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{familyIntros[selected].copy}</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCardView key={product.route} product={product} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-screen-2xl gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">How To Choose</span>
            <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight text-slate-950">Find the right entry point.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Engineers usually evaluate by process first, then platform size, substrate, chemistry, and procurement path. This overview keeps those decisions visible before you open a detail page.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Etch', 'Need anisotropy, profile control, deep silicon, diamond, or ion milling? Start with ICP-RIE, RIE, Compact RIE, or IBE/RIBE.'],
              ['Deposit', 'Need dielectric films, conformal ALD, PVD metals, optical stacks, or gap fill? Start with PECVD, ALD, Sputter, E-Beam, or HDP-CVD.'],
              ['Pattern', 'Need coating, developing, bake, stripping, or resist removal around lithography? Start with Coater/Developer or Striper.'],
              ['Clean', 'Need surface activation or lab-scale plasma cleaning? Start with HY and PLUTO buy-online platforms.'],
            ].map(([heading, copy]) => (
              <div key={heading} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-headline font-bold text-slate-950">{heading}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-screen-2xl px-6 lg:px-10">
          <div className="rounded-xl bg-slate-950 p-8 text-white md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">Engineering Support</span>
                <h2 className="mt-3 text-4xl font-headline font-bold tracking-tight">Need help matching a process?</h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  Share your material stack, wafer size, process goal, and timeline. NineScrolls can help narrow the platform family before configuration review.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/request-quote" className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-500">
                  Request Quote
                </Link>
                <Link to="/contact?topic=expert" className="inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  Talk to an Engineer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl="/NineScrolls-Equipment-Guide.pdf"
        fileName="NineScrolls-Equipment-Guide.pdf"
        title="Download Equipment Guide"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
