import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/pecvd-standardized.webp';

export const pecvdSystemConfig: ProductDetailConfig = {
  slug: 'pecvd',
  seo: {
    title: 'PECVD Thin Film Deposition Platform',
    description:
      'Plasma-enhanced chemical vapor deposition platform for low-temperature SiO2, SiNx, a-Si:H, SiC, SiON, DLC, passivation, and optical thin film workflows. Supports 4-12 inch wafers, 500-2000 W RF, 20 to 400 C operation, up to 6 gas lines, and <5% uniformity.',
    keywords:
      'PECVD system, plasma enhanced CVD, PECVD equipment, thin film deposition, silicon nitride deposition, silicon dioxide deposition, low temperature CVD',
  },
  schema: {
    name: 'PECVD Thin Film Deposition Platform',
    description:
      'Plasma-enhanced chemical vapor deposition system for low-temperature dielectric, semiconductor, passivation, encapsulation, and optical thin film process development.',
    sku: 'pecvd',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What films can the PECVD platform deposit?',
      answer:
        'The PECVD platform supports common dielectric and semiconductor films including SiO2, SiNx, a-Si:H, SiC, SiON, and optional DLC process configurations.',
    },
    {
      question: 'Why choose PECVD instead of thermal CVD?',
      answer:
        'PECVD uses plasma-assisted chemistry to enable film deposition at lower substrate temperatures, making it useful for passivation, encapsulation, MEMS, optical coatings, and temperature-sensitive research stacks.',
    },
    {
      question: 'What core specifications define the PECVD platform?',
      answer:
        'The PECVD platform supports 4 inch to 12 inch wafers, 500 to 2000 W RF power at 13.56 MHz and/or 400 kHz, 20 to 400 C temperature control, up to 6 gas lines, and <5% film uniformity.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'PECVD',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'PECVD Thin Film Deposition Platform',
    description:
      'Low-temperature plasma-enhanced CVD for dielectric films, passivation layers, optical coatings, MEMS stacks, and research thin-film process development.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls PECVD thin film deposition platform',
      width: 1200,
      height: 900,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '500-2000 W' },
      { label: 'Gas Lines', value: 'Up to 6' },
      { label: 'Temp Range', value: '20 to 400 C' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=pecvd',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=pecvd',
    },
  },
  datasheet: {
    fileUrl: '/docs/pecvd-system-datasheet.pdf',
    fileName: 'NineScrolls-PECVD-Datasheet.pdf',
    title: 'Download PECVD Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Build the film stack around temperature, stress, and chemistry.',
    copy:
      'PECVD selection starts with the target film, allowed thermal budget, stress target, refractive index, gas chemistry, deposition rate, and wafer handling requirements. The platform is configured around those process constraints rather than a fixed catalog setup.',
    windows: [
      {
        title: 'Dielectric Films',
        copy: 'SiO2, SiNx, and SiON deposition for passivation, interlayer dielectric, optical, and MEMS workflows.',
        details: ['SiO2 / SiNx / SiON', 'Stress control', 'Low-temperature deposition'],
      },
      {
        title: 'Semiconductor Films',
        copy: 'a-Si:H and related plasma-deposited films for device research, sensors, and thin-film electronics.',
        details: ['a-Si:H', 'Composition tuning', 'Research stacks'],
      },
      {
        title: 'Protective Coatings',
        copy: 'SiC and optional DLC process configurations for barrier, encapsulation, and protective film development.',
        details: ['SiC', 'DLC optional', 'Encapsulation'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare ALD',
      href: '/products/ald',
    },
    cards: [
      {
        title: 'Low-temperature deposition',
        copy: 'Plasma-assisted chemistry enables useful film growth at lower substrate temperatures than thermal CVD.',
      },
      {
        title: 'Film stress tuning',
        copy: 'Single or dual-frequency RF configurations support stress and ion-bombardment tuning for MEMS and optical stacks.',
      },
      {
        title: 'Multi-material flexibility',
        copy: 'Configurable gas delivery supports dielectric, semiconductor, and protective coating recipes in one platform family.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for PECVD process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy datasheet table for fast process screening. Final configuration should be confirmed with engineering during quote review.',
    testId: 'pecvd-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '500-2000 W' },
      { label: 'Frequency', value: '13.56 MHz / 400 kHz' },
      { label: 'Temperature', value: '20 to 400 C' },
      { label: 'Gas System', value: 'Up to 6 gas lines' },
      { label: 'Uniformity', value: '<5%' },
      { label: 'Vacuum System', value: 'Roots pump + mechanical pump' },
      { label: 'Loading', value: 'Open-load or load-lock' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for thin-film process development.',
    items: [
      'Passivation layers',
      'Interlayer dielectrics',
      'Optical coatings',
      'MEMS membranes',
      'Device encapsulation',
      'Flexible electronics',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right deposition path.',
    items: [
      {
        title: 'PECVD Complete Guide',
        href: '/insights/pecvd-complete-guide-plasma-enhanced-cvd',
        meta: 'Reactor principles, film recipes, and stress control',
      },
      {
        title: 'PECVD vs ALD vs Sputtering',
        href: '/insights/pecvd-vs-ald-vs-sputtering-comparison',
        meta: 'Deposition technology selection guide',
      },
      {
        title: 'HDP-CVD Applications',
        href: '/insights/hdp-cvd-applications-gap-fill-dielectrics',
        meta: 'Gap-fill and dielectric deposition comparison',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a repeatable PECVD film process with NineScrolls',
    copy: 'Share your target film, substrate temperature limit, gas chemistry, wafer size, stress target, and timeline.',
    primaryAction: {
      label: 'Start PECVD Quote',
      href: '/request-quote?products=pecvd',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=pecvd',
    },
    backgroundImage: productImage,
  },
};
