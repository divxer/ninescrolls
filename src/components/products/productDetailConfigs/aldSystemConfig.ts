import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/ald-standardized.webp';

export const aldSystemConfig: ProductDetailConfig = {
  slug: 'ald',
  seo: {
    title: 'ALD Atomic Layer Deposition Platform',
    description:
      'Atomic layer deposition platform for conformal thin films with 4-12 inch wafer support, 20 to 400 C wafer temperature, <1% Al2O3 uniformity, 2-6 precursor lines, and optional 300-1000 W remote plasma.',
    keywords:
      'ALD system, atomic layer deposition, ALD equipment, conformal coating, Al2O3 deposition, HfO2 deposition, PEALD, thin film deposition',
  },
  schema: {
    name: 'ALD Atomic Layer Deposition Platform',
    description:
      'Atomic layer deposition platform for conformal oxides, nitrides, metals, complex oxides, high-aspect-ratio coatings, gate dielectrics, passivation, and research thin-film process development.',
    sku: 'ald',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What is atomic layer deposition and how does it work?',
      answer:
        'Atomic layer deposition builds films through sequential, self-limiting surface reactions. Each cycle deposits a controlled layer, enabling precise thickness control, strong conformality, and high uniformity on complex 3D structures.',
    },
    {
      question: 'What materials can the ALD platform deposit?',
      answer:
        'The ALD platform supports oxide, nitride, metal, and complex oxide process families including Al2O3, HfO2, SiO2, TiO2, TiN, TaN, Pt, Pd, W, Ru, and related research materials depending on precursor configuration.',
    },
    {
      question: 'When should I choose ALD instead of PECVD?',
      answer:
        'Choose ALD when the process requires atomic-level thickness control, very high conformality, high-aspect-ratio coverage, or gate dielectric and passivation films on complex geometries. PECVD is typically better for higher-rate dielectric deposition when perfect conformality is less critical.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'ALD',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'ALD Atomic Layer Deposition Platform',
    description:
      'Atomic-level thin film deposition for conformal coatings, high-k dielectrics, passivation layers, 3D structures, and research material stacks.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls ALD atomic layer deposition platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Wafer Temp', value: '20 to 400 C' },
      { label: 'Uniformity', value: '<1%' },
      { label: 'Precursor', value: '2-6 lines' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=ald',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=ald',
    },
  },
  datasheet: {
    fileUrl: '/docs/ald-system-datasheet.pdf',
    fileName: 'NineScrolls-ALD-Datasheet.pdf',
    title: 'Download ALD Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Control each film cycle around surface chemistry and geometry.',
    copy:
      'ALD selection starts with precursor chemistry, purge efficiency, temperature window, nucleation behavior, aspect ratio, plasma-assist requirements, and target film properties. The platform is configured around those self-limiting process constraints.',
    windows: [
      {
        title: 'High-k Dielectrics',
        copy: 'Atomic-layer control for Al2O3, HfO2, TiO2, and related oxide films used in gate dielectric and passivation research.',
        details: ['Al2O3 / HfO2', 'Thickness control', 'Gate stacks'],
      },
      {
        title: '3D Conformal Coatings',
        copy: 'High step coverage for high-aspect-ratio structures, MEMS devices, porous materials, and complex research substrates.',
        details: ['Conformal coverage', 'High aspect ratio', '3D structures'],
      },
      {
        title: 'Plasma-Enhanced ALD',
        copy: 'Optional remote plasma supports lower-temperature process windows and additional material chemistries.',
        details: ['PEALD optional', '300-1000 W plasma', 'Low-temperature films'],
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
        title: 'Self-limiting chemistry',
        copy: 'Sequential precursor exposure and purge cycles support atomic-scale thickness control and repeatable growth-per-cycle.',
      },
      {
        title: 'Conformality on 3D structures',
        copy: 'The ALD process is built for coverage inside high-aspect-ratio, porous, or non-planar features where line-of-sight deposition struggles.',
      },
      {
        title: 'Thermal or plasma-assisted modes',
        copy: 'Thermal ALD and optional PEALD let engineers tune temperature, reactivity, and film properties around substrate limits.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for ALD process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy datasheet table for fast process screening. Final precursor and plasma configuration should be confirmed with engineering during quote review.',
    testId: 'ald-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Wafer Temperature', value: '20 to 400 C' },
      { label: 'Uniformity', value: '<1%' },
      { label: 'Precursor Lines', value: '2-6 lines' },
      { label: 'Remote Plasma', value: '300-1000 W optional' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for conformal thin-film process development.',
    items: [
      'Gate dielectrics',
      'Passivation layers',
      'MEMS coatings',
      'Energy storage materials',
      'Optical coatings',
      '2D material devices',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right ALD process path.',
    items: [
      {
        title: 'Atomic Layer Deposition Guide',
        href: '/insights/atomic-layer-deposition-ald-comprehensive-guide',
        meta: 'Self-limiting chemistry, precursors, and ALD windows',
      },
      {
        title: 'PECVD vs ALD vs Sputtering',
        href: '/insights/pecvd-vs-ald-vs-sputtering-comparison',
        meta: 'Deposition technology selection guide',
      },
      {
        title: '2D Materials Device Fabrication',
        href: '/insights/2d-materials-device-fabrication-guide',
        meta: 'ALD gate dielectrics and van der Waals device flows',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a repeatable ALD film process with NineScrolls',
    copy: 'Share your target film, precursor needs, wafer size, thermal budget, aspect ratio, plasma requirements, and timeline.',
    primaryAction: {
      label: 'Start ALD Quote',
      href: '/request-quote?products=ald',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=ald',
    },
    backgroundImage: productImage,
  },
};
