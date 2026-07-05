import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/sputter-standardized.webp';

export const sputterSystemConfig: ProductDetailConfig = {
  slug: 'sputter',
  seo: {
    title: 'PVD Magnetron Sputtering Platform',
    description:
      'PVD magnetron sputtering platform for metal, dielectric, nitride, oxide, magnetic, and compound thin films. Supports 4-12 inch wafers, 2-6 independently configurable targets, substrate temperature from water-cooled to 1200 C, <5x10^-7 Torr base pressure, and <1% uniformity.',
    keywords:
      'sputter system, magnetron sputtering, PVD system, sputtering equipment, thin film sputtering, DC sputtering, RF sputtering, reactive sputtering',
  },
  schema: {
    name: 'PVD Magnetron Sputtering Platform',
    description:
      'Physical vapor deposition magnetron sputtering platform for metal, oxide, nitride, magnetic, compound semiconductor, optical, and protective thin-film process development.',
    sku: 'sputter',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What materials can the Sputter platform deposit?',
      answer:
        'The Sputter platform supports metal, oxide, nitride, magnetic, compound semiconductor, optical, and protective thin-film workflows depending on target configuration and DC, RF, or reactive sputtering mode.',
    },
    {
      question: 'When should I choose sputtering instead of ALD or PECVD?',
      answer:
        'Choose sputtering for broad PVD material compatibility, metal and magnetic films, conductive coatings, optical stacks, and multi-target or co-sputtering workflows. ALD is stronger for atomic-scale conformality, while PECVD is stronger for high-rate low-temperature dielectric films.',
    },
    {
      question: 'What core specifications define the Sputter platform?',
      answer:
        'The Sputter platform supports 4 inch to 12 inch wafers, 2 to 6 independently configurable targets, substrate temperature from water-cooled to 1200 C, base pressure below 5x10^-7 Torr, and <1% film uniformity.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'Sputter',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'PVD Magnetron Sputtering Platform',
    description:
      'Physical vapor deposition for metal, dielectric, nitride, oxide, magnetic, optical, and compound thin films using configurable DC/RF magnetron sputtering sources.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls PVD magnetron sputtering platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Targets', value: '2-6 configurable' },
      { label: 'Base Pressure', value: '<5x10^-7 Torr' },
      { label: 'Uniformity', value: '<1%' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=sputter',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=sputter',
    },
  },
  datasheet: {
    fileUrl: '/docs/sputter-system-datasheet.pdf',
    fileName: 'NineScrolls-Sputter-Datasheet.pdf',
    title: 'Download Sputter Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Build the PVD stack around targets, pressure, and substrate temperature.',
    copy:
      'Sputter selection starts with target materials, DC or RF power mode, reactive gas needs, base pressure, substrate temperature, wafer size, uniformity target, and whether the process needs multilayer or co-sputtering capability.',
    windows: [
      {
        title: 'Metal Films',
        copy: 'DC magnetron workflows for conductive films, contact layers, seed layers, and research metallization stacks.',
        details: ['DC sputtering', 'Conductive targets', 'Metallization'],
      },
      {
        title: 'Reactive Sputtering',
        copy: 'Reactive oxygen or nitrogen process windows for oxide and nitride films with controlled stoichiometry.',
        details: ['Oxides / nitrides', 'O2 / N2 chemistry', 'Stoichiometry control'],
      },
      {
        title: 'Multi-Target PVD',
        copy: 'Configurable target positions support multilayer films, alloy development, magnetic stacks, and co-sputtering workflows.',
        details: ['2-6 targets', 'Co-sputtering', 'Multilayers'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare E-Beam Evaporation',
      href: '/products/e-beam-evaporator',
    },
    cards: [
      {
        title: 'Target configuration',
        copy: 'Two to six independently configurable targets support single-material, multilayer, alloy, and co-sputtered film development.',
      },
      {
        title: 'DC/RF magnetron modes',
        copy: 'Power-mode flexibility supports conductive and insulating target materials across metal, oxide, nitride, and optical films.',
      },
      {
        title: 'Vacuum and temperature control',
        copy: 'Low base pressure and configurable substrate temperature help tune density, adhesion, stress, and film morphology.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for Sputter process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy datasheet table for fast process screening. Final target count, power supplies, gases, and substrate heating should be confirmed with engineering during quote review.',
    testId: 'sputter-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Targets', value: '2-6 configurable' },
      { label: 'Substrate Temperature', value: 'Water-cooled to 1200 C' },
      { label: 'Base Pressure', value: '<5x10^-7 Torr' },
      { label: 'Uniformity', value: '<1%' },
      { label: 'Power Modes', value: 'DC / RF magnetron' },
      { label: 'Process Modes', value: 'Metal, reactive, co-sputter' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for PVD thin-film process development.',
    items: [
      'Metal contacts',
      'Magnetic films',
      'Optical coatings',
      'Compound semiconductors',
      'Protective coatings',
      'Multilayer stacks',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right PVD process path.',
    items: [
      {
        title: 'Magnetron Sputtering Guide',
        href: '/insights/magnetron-sputtering-guide',
        meta: 'DC/RF modes, reactive sputtering, and film growth',
      },
      {
        title: 'PECVD vs ALD vs Sputtering',
        href: '/insights/pecvd-vs-ald-vs-sputtering-comparison',
        meta: 'Deposition technology comparison',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a repeatable sputtering process with NineScrolls',
    copy: 'Share your target materials, wafer size, power mode, substrate temperature, pressure requirements, reactive gases, and timeline.',
    primaryAction: {
      label: 'Start Sputter Quote',
      href: '/request-quote?products=sputter',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=sputter',
    },
    backgroundImage: productImage,
  },
};
