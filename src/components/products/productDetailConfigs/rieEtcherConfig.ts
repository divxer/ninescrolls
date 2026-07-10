import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/rie-standardized.webp';

export const rieEtcherConfig: ProductDetailConfig = {
  slug: 'rie-etcher',
  seo: {
    title: 'RIE Plasma Etching Platform',
    description:
      'Reactive ion etching platform for universities and R&D labs. Supports 4-12 inch wafers, 300-1000 W RF power, 4 gas lines, and -70 to 200 C temperature control.',
    keywords:
      'RIE etcher, reactive ion etching, RIE plasma etching, dielectric etching, polymer removal, semiconductor R&D equipment',
  },
  schema: {
    name: 'RIE Plasma Etching Platform',
    description:
      'Reactive ion etching platform for silicon, silicon dioxide, silicon nitride, metal, polymer, and general semiconductor R&D process applications.',
    sku: 'rie-etcher',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What materials can the RIE platform process?',
      answer:
        'The RIE platform supports silicon, silicon dioxide, silicon nitride, metals, polymers, and common research process stacks used in dielectric patterning, polymer removal, surface activation, and device prototyping.',
    },
    {
      question: 'When should I choose RIE instead of ICP-RIE?',
      answer:
        'RIE is a strong fit for general-purpose dry etching, moderate anisotropy, dielectric patterning, polymer removal, and cost-conscious R&D workflows. ICP-RIE is better when the process needs high-density plasma, higher aspect ratios, or independent control of plasma density and ion energy.',
    },
    {
      question: 'What core specifications define the RIE platform?',
      answer:
        'The RIE platform supports 4 inch to 12 inch wafers, 300-1000 W RF power at 13.56 MHz, 4 process gas lines, and -70 to 200 C temperature control.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'RIE',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'RIE Plasma Etching Platform',
    description:
      'Reliable anisotropic plasma etching for dielectric patterning, polymer removal, surface activation, and device prototyping in university and R&D lab environments.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls RIE etcher platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '300-1000 W' },
      { label: 'Gas Lines', value: '4 lines' },
      { label: 'Temp Range', value: '-70 to 200 C' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=rie-etcher',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=rie-etcher',
    },
  },
  datasheet: {
    fileUrl: '/docs/rie-etcher-datasheet.pdf',
    fileName: 'NineScrolls-RIE-Etcher-Datasheet.pdf',
    title: 'Download RIE Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Tune the ion-driven etch around the material stack.',
    copy:
      'RIE decisions usually start with the target film, mask selectivity, ion directionality, allowable damage, pressure window, gas chemistry, and sample handling. This page keeps those process questions visible before narrowing the platform configuration.',
    windows: [
      {
        title: 'Dielectric Patterning',
        copy: 'Controlled plasma etching for SiO2, SiNx, and related dielectric films used in research device stacks.',
        details: ['SiO2 / SiNx', 'Mask selectivity', 'Endpoint ready'],
      },
      {
        title: 'Polymer And Resist Removal',
        copy: 'Oxygen and mixed-gas RIE workflows for photoresist, polymer films, surface cleaning, and device preparation.',
        details: ['O2 plasma', 'Polymer removal', 'Surface activation'],
      },
      {
        title: 'Device Prototyping',
        copy: 'General-purpose anisotropic etching for university labs and R&D teams building repeatable process windows.',
        details: ['Semiconductor R&D', 'MEMS support', 'Prototype workflows'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare ICP-RIE',
      href: '/products/icp-etcher',
    },
    cards: [
      {
        title: 'Ion directionality',
        copy: 'RF-driven sheath control supports anisotropic etch profiles for moderate-aspect-ratio features.',
      },
      {
        title: 'Chemistry flexibility',
        copy: 'Four gas lines support common fluorine, oxygen, argon, and mixed-gas research recipes.',
      },
      {
        title: 'Research lab efficiency',
        copy: 'Compact footprint, configurable loading, and automated recipe control suit repeated R&D workflows.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for RIE process planning.',
    copy:
      'Core values are taken from the equipment summary and presented for fast process screening. Final configuration should be confirmed with engineering during quote review.',
    testId: 'rie-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '300-1000 W' },
      { label: 'Frequency', value: '13.56 MHz' },
      { label: 'Gas System', value: '4 gas lines' },
      { label: 'Temperature', value: '-70 to 200 C' },
      { label: 'Materials', value: 'Si, SiO2, SiNx, metals, polymers' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for general-purpose dry etch workflows.',
    items: [
      'Semiconductor R&D',
      'Dielectric patterning',
      'Polymer removal',
      'Surface activation',
      'Device prototyping',
      'MEMS fabrication',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right etch path.',
    items: [
      {
        title: 'Reactive Ion Etching Guide',
        href: '/insights/reactive-ion-etching-guide',
        meta: 'RIE principles and process control',
      },
      {
        title: 'PE vs RIE vs ICP-RIE',
        href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
        meta: 'Plasma mode comparison',
      },
      {
        title: 'RIE vs Ion Milling',
        href: '/insights/reactive-ion-etching-vs-ion-milling',
        meta: 'Chemistry versus physical sputtering',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a repeatable RIE process window with NineScrolls',
    copy: 'Share your target film, mask stack, wafer size, gases, process temperature, and lab timeline.',
    primaryAction: {
      label: 'Start RIE Quote',
      href: '/request-quote?products=rie-etcher',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=rie-etcher',
    },
    backgroundImage: productImage,
  },
};
