import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = 'https://cdn.ninescrolls.com/products/hdp-cvd/main.jpg';

export const hdpCvdSystemConfig: ProductDetailConfig = {
  slug: 'hdp-cvd',
  seo: {
    title: 'HDP-CVD Gap-Fill Deposition Platform',
    description:
      'High-density plasma CVD platform for void-free dielectric gap-fill, STI, IMD, PMD, advanced packaging, and dense oxide process development. Supports 4-12 inch wafers, 1000-3000 W source RF, 300-1000 W bias RF, 20 to 200 C processing, 6 gas lines, and <5% uniformity.',
    keywords:
      'HDP-CVD, high density plasma CVD, gap fill deposition, dielectric deposition, STI fill, IMD dielectric, PMD dielectric, advanced packaging CVD',
  },
  schema: {
    name: 'HDP-CVD Gap-Fill Deposition Platform',
    description:
      'High-density plasma chemical vapor deposition platform for void-free dielectric gap-fill, dense films, STI, IMD, PMD, and advanced packaging process development.',
    sku: 'hdp-cvd',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What is HDP-CVD used for?',
      answer:
        'HDP-CVD is used for high-density dielectric films and void-free gap-fill in high-aspect-ratio features, including STI, IMD, PMD, TSV-related dielectrics, MEMS cavity sealing, and advanced packaging workflows.',
    },
    {
      question: 'How is HDP-CVD different from PECVD?',
      answer:
        'HDP-CVD combines plasma-enhanced deposition with ion-assisted sputtering. That dep/sputter balance keeps feature openings clear during deposition, improving gap-fill where standard PECVD can pinch off and form voids.',
    },
    {
      question: 'What core specifications define the HDP-CVD platform?',
      answer:
        'The HDP-CVD platform supports 4 inch to 12 inch wafers, 1000 to 3000 W source RF, optional 300 to 1000 W bias RF, 20 to 200 C operation, a 6-line gas system, and <5% uniformity.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'HDP-CVD',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'HDP-CVD Gap-Fill Deposition Platform',
    description:
      'High-density plasma CVD for dense dielectric films, void-free trench fill, STI, IMD, PMD, and advanced packaging process development.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls HDP-CVD high-density plasma CVD platform',
      width: 1200,
      height: 800,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Source RF', value: '1000-3000 W' },
      { label: 'Bias RF', value: '300-1000 W' },
      { label: 'Gas Lines', value: '6' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=hdp-cvd',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=hdp-cvd',
    },
  },
  datasheet: {
    fileUrl: '/docs/hdp-cvd-system-datasheet.pdf',
    fileName: 'NineScrolls-HDP-CVD-Datasheet.pdf',
    title: 'Download HDP-CVD Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Tune the process around deposition, sputter-back, and gap geometry.',
    copy:
      'HDP-CVD selection starts with feature aspect ratio, target dielectric, D/S ratio, source power, bias power, gas chemistry, wafer temperature, film stress, and whether the process needs blanket dense films or true gap-fill performance.',
    windows: [
      {
        title: 'Dep/Sputter Gap-Fill',
        copy: 'High-density plasma deposition plus controlled ion sputtering helps prevent top pinch-off and supports void-free fill strategies.',
        details: ['Dep/sputter balance', 'Void suppression', 'D/S tuning'],
      },
      {
        title: 'Dense Dielectrics',
        copy: 'Process windows support SiO2, Si3N4, SiON, SiC, low-k, and doped silicate glass film development.',
        details: ['SiO2 / Si3N4', 'Low-k dielectrics', 'BSG / PSG / BPSG'],
      },
      {
        title: 'Low Thermal Budget',
        copy: '20 to 200 C operation supports research flows where dense films and plasma-assisted fill are needed without high thermal exposure.',
        details: ['20 to 200 C', 'Dense films', 'Research stacks'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare PECVD',
      href: '/products/pecvd',
    },
    cards: [
      {
        title: 'Gap-fill quality',
        copy: 'The primary process target is void suppression in trenches, vias, and dense topography where conformal deposition alone can close the opening too early.',
      },
      {
        title: 'Source and bias balance',
        copy: 'Independent source and bias RF ranges let engineers tune plasma density, ion energy, resputtering, and net deposition behavior.',
      },
      {
        title: 'Film density and uniformity',
        copy: 'HDP-CVD is configured for dense dielectric films with <5% uniformity and process windows for stress, wet etch rate, and dielectric quality.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for HDP-CVD process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy page for fast process screening. Final gas chemistry, source, bias, loading, and chamber options should be confirmed with engineering during quote review.',
    testId: 'hdp-cvd-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Source RF', value: '1000-3000 W' },
      { label: 'Bias RF', value: '300-1000 W' },
      { label: 'Temperature', value: '20 to 200 C' },
      { label: 'Gas System', value: '6 gas lines' },
      { label: 'Uniformity', value: '<5%' },
      { label: 'Loading', value: 'Open-load or load-lock' },
      { label: 'Footprint', value: 'Approx. 1.0m x 1.5m' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for dielectric gap-fill and dense film development.',
    items: [
      'STI gap-fill',
      'IMD / PMD dielectrics',
      'Advanced packaging dielectrics',
      'TSV isolation workflows',
      'MEMS cavity sealing',
      'Silicon photonics cladding',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right gap-fill and dielectric deposition path.',
    items: [
      {
        title: 'HDP-CVD In-Depth Guide',
        href: '/insights/hdp-cvd-in-depth-guide-practical-handbook',
        meta: 'Process principles, gap-fill behavior, PECVD and ALD comparison, and equipment selection',
      },
      {
        title: 'HDP-CVD Applications',
        href: '/insights/hdp-cvd-applications-gap-fill-dielectrics',
        meta: 'STI, IMD, PMD, advanced packaging, D/S ratio optimization, and void-free fill strategies',
      },
      {
        title: 'PECVD vs ALD vs Sputtering',
        href: '/insights/pecvd-vs-ald-vs-sputtering-comparison',
        meta: 'Deposition technology comparison for thin-film process planning',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build your next dielectric gap-fill process with NineScrolls',
    copy: 'Share your target film, feature geometry, aspect ratio, wafer size, gas chemistry, source and bias requirements, and timeline.',
    primaryAction: {
      label: 'Start HDP-CVD Quote',
      href: '/request-quote?products=hdp-cvd',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=hdp-cvd',
    },
    backgroundImage: productImage,
  },
};
