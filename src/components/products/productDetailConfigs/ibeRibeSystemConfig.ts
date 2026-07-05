import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/ibe-ribe-standardized.webp';

export const ibeRibeSystemConfig: ProductDetailConfig = {
  slug: 'ibe-ribe',
  seo: {
    title: 'IBE/RIBE Ion Beam Etching Platform',
    description:
      'Ion beam etching and reactive ion beam etching platform for magnetic materials, noble metals, optical materials, multilayer stacks, and difficult-to-etch films. Supports Kaufman sources up to 6 inch wafers, RF sources up to 12 inch wafers, 0-90 degree tilt, 1-10 rpm rotation, <7x10^-7 Torr base pressure, and <5% non-uniformity.',
    keywords:
      'IBE, RIBE, ion beam etching, reactive ion beam etching, ion milling, magnetic material etching, noble metal etching, optical material etching',
  },
  schema: {
    name: 'IBE/RIBE Ion Beam Etching Platform',
    description:
      'Ion beam etching and reactive ion beam etching platform for precision physical milling and chemically assisted directional etching of difficult materials.',
    sku: 'ibe-ribe',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'When should I choose IBE/RIBE instead of RIE?',
      answer:
        'Choose IBE/RIBE when the material has no practical volatile reactive chemistry, when beam angle control is critical, or when magnetic, noble-metal, optical, multilayer, or 2D material stacks need directional physical milling.',
    },
    {
      question: 'What is the difference between IBE and RIBE?',
      answer:
        'IBE uses an inert ion beam for physical sputter removal. RIBE introduces reactive gases to combine directional beam control with chemical enhancement for selected material systems.',
    },
    {
      question: 'What core specifications define the IBE/RIBE platform?',
      answer:
        'The IBE/RIBE platform supports Kaufman ion sources for up to 6 inch wafers, RF ion sources for up to 12 inch wafers, 0 to 90 degree tilt, 1 to 10 rpm rotation, base pressure below 7x10^-7 Torr, and <5% non-uniformity.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'IBE/RIBE',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'IBE/RIBE Ion Beam Etching Platform',
    description:
      'Directional ion beam etching and reactive ion beam etching for magnetic films, noble metals, optical materials, multilayer stacks, and difficult-to-etch research materials.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls IBE/RIBE ion beam etching platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Ion Source', value: 'Kaufman / RF' },
      { label: 'Tilt', value: '0-90 deg' },
      { label: 'Rotation', value: '1-10 rpm' },
      { label: 'Base Pressure', value: '<7x10^-7 Torr' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=ibe-ribe',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=ibe-ribe',
    },
  },
  datasheet: {
    fileUrl: '/docs/ibe-ribe-system-datasheet.pdf',
    fileName: 'NineScrolls-IBE-RIBE-Datasheet.pdf',
    title: 'Download IBE/RIBE Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Build the etch window around material volatility, beam angle, and redeposition control.',
    copy:
      'IBE/RIBE selection starts with the material stack, desired profile angle, mask budget, redeposition risk, wafer size, endpoint needs, and whether the process requires pure physical milling or chemically assisted ion beam etching.',
    windows: [
      {
        title: 'Physical Ion Milling',
        copy: 'Inert ion beam removal for noble metals, magnetic stacks, and material systems without useful volatile etch products.',
        details: ['Ar ion beam', 'Noble metals', 'Magnetic stacks'],
      },
      {
        title: 'Reactive Ion Beam Etching',
        copy: 'Reactive gases add chemical enhancement while retaining directional beam control for selected materials and profiles.',
        details: ['RIBE mode', 'Chemical assist', 'Profile control'],
      },
      {
        title: 'Angle-Controlled Profiles',
        copy: 'Tilt and rotation help tune sidewall angle, redeposition, taper, and uniformity for precision pattern transfer.',
        details: ['0-90 deg tilt', '1-10 rpm rotation', 'Redeposition control'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare RIE Etching',
      href: '/products/rie-etcher',
    },
    cards: [
      {
        title: 'Ion source selection',
        copy: 'Kaufman and RF source options let teams match beam architecture to wafer size, material stack, and process energy requirements.',
      },
      {
        title: 'Beam angle and rotation',
        copy: 'Programmable tilt and rotation support sidewall shaping, improved uniformity, and redeposition management across complex stacks.',
      },
      {
        title: 'Material-agnostic milling',
        copy: 'Physical sputter removal supports magnetic materials, Au, Pt, Cu, glass, quartz, 2D materials, and quantum device materials.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for IBE/RIBE process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy datasheet table for fast process screening. Final source type, gas lines, loading, cooling, and endpoint options should be confirmed with engineering during quote review.',
    testId: 'ibe-ribe-specifications',
    items: [
      { label: 'Ion Source', value: 'Kaufman <=6 in / RF <=12 in' },
      { label: 'Wafer Size', value: 'Up to 12 in' },
      { label: 'Tilt Angle', value: '0-90 deg' },
      { label: 'Rotation', value: '1-10 rpm' },
      { label: 'Base Pressure', value: '<7x10^-7 Torr' },
      { label: 'Uniformity', value: '<5% non-uniformity' },
      { label: 'Gas Lines', value: '1-3 standard, customizable' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for difficult-to-etch materials and precision directional milling.',
    items: [
      'Magnetic materials',
      'Noble metal patterning',
      'Optical device fabrication',
      'MEMS / NEMS',
      'Multilayer film etching',
      '2D and quantum materials',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose between plasma and ion beam etch paths.',
    items: [
      {
        title: 'Ion Beam Etching (IBE) & RIBE Guide',
        href: '/insights/ion-beam-etching-ribe-guide',
        meta: 'Kaufman vs RF sources, IBE/RIBE modes, tilt angle, and materials',
      },
      {
        title: 'RIE vs Ion Milling',
        href: '/insights/reactive-ion-etching-vs-ion-milling',
        meta: 'Chemistry-driven RIE compared with physical ion milling',
      },
      {
        title: 'Metal Etching Complete Guide',
        href: '/insights/metal-etching-complete-guide',
        meta: 'Metal-by-metal etch routes including IBE/RIBE for difficult stacks',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a controlled ion beam etch process with NineScrolls',
    copy: 'Share your material stack, wafer size, target sidewall profile, tilt requirements, redeposition concerns, gas needs, and timeline.',
    primaryAction: {
      label: 'Start IBE/RIBE Quote',
      href: '/request-quote?products=ibe-ribe',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=ibe-ribe',
    },
    backgroundImage: productImage,
  },
};
