import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/icp-rie-standardized.webp';

export const icpEtcherConfig: ProductDetailConfig = {
  slug: 'icp-etcher',
  seo: {
    title: 'ICP-RIE Etching System for Research Labs',
    description:
      'Select a NineScrolls ICP-RIE etching system for silicon, MEMS, diamond, and compound semiconductor etching. Review specs, applications, and request a quote.',
    keywords:
      'ICP-RIE etching system, ICP etcher, ICP-RIE equipment, research plasma etcher, silicon etching, diamond processing, MEMS fabrication',
  },
  schema: {
    name: 'ICP-RIE Plasma Etching Platform',
    description:
      'ICP-RIE plasma etching platform for silicon etching, MEMS fabrication, compound semiconductors, diamond processing, and advanced research applications.',
    sku: 'icp-etcher',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What applications is the ICP-RIE platform best suited for?',
      answer:
        'The ICP-RIE platform is designed for high-aspect-ratio silicon etching, MEMS fabrication, compound semiconductor processing, diamond processing, photonics, advanced packaging, and process development where independent plasma density and ion energy control matter.',
    },
    {
      question: 'What is the difference between ICP-RIE and RIE?',
      answer:
        'ICP-RIE uses a high-density inductively coupled plasma source with separate bias control, allowing plasma density and ion energy to be tuned independently. Standard RIE is simpler and useful for many general etch workflows, but ICP-RIE provides a wider process window for demanding research applications.',
    },
    {
      question: 'What wafer sizes does the ICP-RIE platform support?',
      answer:
        'The ICP-RIE platform supports 4 inch to 12 inch wafers, with configurable loading, gas, RF, and temperature options depending on process needs.',
    },
    {
      question: 'Should I use this ICP-RIE system page or the ICP-RIE technology guide?',
      answer:
        'Use this product page when you are selecting an ICP-RIE etching system, checking wafer size, ICP power, bias control, gas lines, temperature range, applications, or quote requirements. Use the ICP-RIE Technology guide when you want to learn the principles of inductively coupled plasma generation, source power, bias power, and high-density plasma etching.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'ICP-RIE',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'ICP-RIE Plasma Etching Platform',
    description:
      'High-density plasma etching for silicon, MEMS, diamond, compound semiconductors, and process development where independent plasma density and ion energy control are critical.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls ICP-RIE plasma etching platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'ICP Power', value: '1000-3000 W' },
      { label: 'Gas Lines', value: '5 std.' },
      { label: 'Stage Temp', value: '-70 to 200 C' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=icp-etcher',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=icp-etcher',
    },
  },
  datasheet: {
    fileUrl: '/docs/icp-etcher-datasheet.pdf',
    fileName: 'NineScrolls-ICP-Etcher-Datasheet.pdf',
    title: 'Download ICP-RIE Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Configure the etch process before the chamber.',
    copy:
      'ICP-RIE purchases usually start with materials, profile goals, wafer size, thermal control, gas chemistry, and allowable damage. This page keeps those engineering decisions visible before pushing a catalog choice.',
    windows: [
      {
        title: 'Deep Silicon Etching',
        copy:
          'High-density plasma process control for MEMS, TSV, Bosch-style workflows, and profile-sensitive silicon removal.',
        details: ['High aspect ratio', 'Sidewall control', 'MEMS and TSV'],
      },
      {
        title: 'Compound Semiconductor Etching',
        copy:
          'Independent source and bias control for GaN, GaAs, InP, SiC, Ga2O3, and related device research.',
        details: ['GaN / SiC / GaAs', 'Low damage', 'Profile tuning'],
      },
      {
        title: 'Diamond And Hard Materials',
        copy:
          'Configurable plasma chemistry and chuck temperature options for diamond, sapphire, and hard-to-process materials.',
        details: ['Diamond', 'Sapphire', 'Wide bandgap'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare RIE',
      href: '/products/rie-etcher',
    },
    cards: [
      {
        title: 'High-density plasma',
        copy: 'Separate ICP source control for high etch rate and chemistry flexibility.',
      },
      {
        title: 'Independent ion energy',
        copy: 'Bias RF tuning helps control anisotropy, damage, and profile shape.',
      },
      {
        title: 'Thermal process window',
        copy: 'Configurable chuck temperature supports low-temperature and high-temperature process work.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Homepage-level clarity, detail-page confidence.',
    copy:
      'Core values are taken from the equipment guide and presented for fast screening. Final configurations should be confirmed with engineering during quote review.',
    testId: 'icp-rie-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Gas System', value: '5 lines std.' },
      { label: 'Stage Temp', value: '-70 to 200 C' },
      { label: 'RF Power', value: '1000-3000 W' },
      { label: 'Bias RF', value: '300-1000 W optional' },
      { label: 'Uniformity', value: '< +/-5% edge exclusion' },
      { label: 'Vacuum', value: 'TMP + mechanical pump' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for research teams that need process range.',
    items: [
      'MEMS fabrication',
      'Advanced packaging',
      'Photonics',
      'Power electronics',
      'Failure analysis',
      'Materials research',
    ],
  },
  research: {
    eyebrow: 'Research Validation',
    title: 'Evidence should support the equipment conversation.',
    cards: [
      {
        eyebrow: 'Peer-reviewed research',
        title: 'ICP-RIE process capability cited in peer-reviewed research',
        meta: 'Connect platform capabilities to published process work during technical review.',
      },
      {
        eyebrow: 'Process evidence',
        title: 'Plasma etching support for photonics and metasurface research',
        meta: 'Research validation for process-sensitive device fabrication.',
      },
      {
        eyebrow: 'Application Notes',
        title: 'ICP vs RIE process selection for research labs',
        meta: 'Connects the platform to the engineering decision path.',
      },
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right process path.',
    items: [
      {
        title: 'Learn ICP-RIE Technology',
        href: '/insights/icp-rie-technology-advanced-etching',
        meta: 'Technology guide for ICP-RIE principles',
      },
      {
        title: 'Compare ICP-RIE vs RIE',
        href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
        meta: 'Process selection comparison',
      },
      {
        title: 'Deep Silicon Bosch Process',
        href: '/insights/deep-reactive-ion-etching-bosch-process',
        meta: 'DRIE and deep silicon etch primer',
      },
      {
        title: 'Diamond Semiconductor Processing',
        href: '/insights/diamond-semiconductor-processing-icp-etching-deposition',
        meta: 'Wide-bandgap diamond etch guide',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build an ICP-RIE process window with NineScrolls',
    copy: 'Share your material stack, target profile, wafer size, gases, temperature needs, and lab timeline.',
    primaryAction: {
      label: 'Start ICP-RIE Quote',
      href: '/request-quote?products=icp-etcher',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=icp-etcher',
    },
    backgroundImage: productImage,
  },
};
