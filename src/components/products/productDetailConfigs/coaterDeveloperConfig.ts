import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/coater-developer-standardized.webp';

export const coaterDeveloperConfig: ProductDetailConfig = {
  slug: 'coater-developer',
  seo: {
    title: 'Coater/Developer Photolithography Track Platform',
    description:
      'Coater/developer photolithography track platform for repeatable spin coating, photoresist development, HMDS priming, hotplate bake, lift-off preparation, EBR, and thick-film process development. Supports pieces to 12 inch wafers, up to 8000 rpm coater speed, RT to 200 C hotplate operation, and modular coat, develop, and bake configurations.',
    keywords:
      'coater developer, spin coater, photoresist coater, wafer developer, photolithography track, resist coating, developer system, hotplate module, edge bead removal',
  },
  schema: {
    name: 'Coater/Developer Photolithography Track Platform',
    description:
      'Modular photolithography track platform for spin coating, resist development, hotplate bake, HMDS priming, EBR, and repeatable photoresist process development.',
    sku: 'coater-developer',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'When should I choose a coater/developer track instead of a manual spin coater?',
      answer:
        'Choose a coater/developer track when repeatable recipes, controlled coat-to-bake timing, developer integration, hotplate modules, EBR, and operator-independent uniformity matter more than single-step manual coating.',
    },
    {
      question: 'What modules can be configured on the Coater/Developer platform?',
      answer:
        'The platform can be configured around coater, developer, hotplate, dispense, EBR, and environmental-control modules. Final module count and layout should be selected around substrate size, resist family, developer chemistry, throughput, and cleanroom workflow.',
    },
    {
      question: 'What core specifications define the Coater/Developer platform?',
      answer:
        'Core specifications include pieces to 12 inch wafers, coater speed up to 8000 rpm +/-1 rpm, developer speed up to 5000 rpm +/-1 rpm, RT to 200 C hotplate operation, 2 resist lines, 2 developer lines plus DI, and an approx. 1.0m x 0.8m footprint.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'Coater/Developer',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'Coater/Developer Photolithography Track Platform',
    description:
      'Modular spin coating, development, hotplate, HMDS, and EBR process control for repeatable photolithography workflows from research wafers to pilot-line substrates.',
    backgroundImage: productImage,
    image: {
      src: productImage,
      alt: 'NineScrolls coater developer photolithography track system',
      width: 1400,
      height: 1400,
    },
    stats: [
      { label: 'Wafer Size', value: 'Pieces to 12 in' },
      { label: 'Coater Speed', value: '8000 rpm' },
      { label: 'Hotplate', value: 'RT to 200 C' },
      { label: 'Developer Speed', value: '5000 rpm' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=coater-developer',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=coater-developer',
    },
  },
  datasheet: {
    fileUrl: '/docs/coater-developer-system-datasheet.pdf',
    fileName: 'NineScrolls-Coater-Developer-Datasheet.pdf',
    title: 'Download Coater/Developer Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Build the lithography track around coating uniformity, bake timing, and developer control.',
    copy:
      'Coater/developer selection starts with substrate size, resist chemistry, target film thickness, spin profile, dispense strategy, bake queue time, developer method, EBR need, and whether the workflow needs integrated coat, develop, and hotplate modules rather than manual transfers.',
    windows: [
      {
        title: 'Spin Coating Control',
        copy: 'High-speed coater modules support programmable spin profiles, acceleration control, dispense timing, and repeatable coating thickness for research lithography.',
        details: ['Up to 8000 rpm', 'Recipe control', 'Resist dispense'],
      },
      {
        title: 'Develop And Rinse',
        copy: 'Developer modules support puddle, spray, or multi-step development strategies with developer lines, DI rinse, and process timing control.',
        details: ['2 developer lines', 'DI water', 'Puddle / spray'],
      },
      {
        title: 'Bake And Queue Timing',
        copy: 'Integrated hotplate modules reduce uncontrolled coat-to-bake and exposure-to-PEB delays that can drive CD variation and process drift.',
        details: ['RT to 200 C', 'PEB timing', 'Soft bake'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare Striper',
      href: '/products/striper',
    },
    cards: [
      {
        title: 'Thickness uniformity',
        copy: 'Spin speed, acceleration, dispense position, resist viscosity, cup airflow, and EBR tuning all contribute to repeatable film-thickness uniformity.',
      },
      {
        title: 'Recipe repeatability',
        copy: 'Integrated coat, develop, and hotplate recipes reduce operator-dependent variation across spin steps, bake timing, development, rinse, and dry sequences.',
      },
      {
        title: 'Module configuration',
        copy: 'Track layouts can be selected around coater count, developer count, hotplate capacity, resist lines, developer chemistry, and throughput needs.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for photolithography track planning.',
    copy:
      'Core values are taken from the equipment summary, equipment guide, and legacy page for fast process screening. Final module layout, chemical lines, chuck set, EBR, hotplate, and environmental controls should be confirmed with engineering during quote review.',
    testId: 'coater-developer-specifications',
    items: [
      { label: 'Wafer Size', value: 'Pieces to 12 in' },
      { label: 'Coater Speed', value: 'Up to 8000 rpm +/-1 rpm' },
      { label: 'Developer Speed', value: 'Up to 5000 rpm +/-1 rpm' },
      { label: 'Hotplate', value: 'RT to 200 C' },
      { label: 'Dispense', value: '2 resist lines + 2 developer lines + DI' },
      { label: 'Footprint', value: 'Approx. 1.0m x 0.8m' },
      { label: 'EBR', value: 'Optional edge bead removal' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for repeatable lithography coating and development workflows.',
    items: [
      'Photoresist coating',
      'HMDS priming',
      'Developer processing',
      'Lift-off preparation',
      'Thick film processing',
      'Edge bead removal',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right lithography track path.',
    items: [
      {
        title: 'Coater/Developer Equipment Guide',
        href: '/insights/coater-developer-systems-equipment-guide',
        meta: 'Track system architecture, module configurations, uniformity optimization, hotplate integration, and equipment selection',
      },
      {
        title: 'Spin Coating & Development Guide',
        href: '/insights/spin-coating-development-guide',
        meta: 'Spin coating physics, resist selection, development optimization, defects, and process troubleshooting',
      },
      {
        title: 'Lithography Process Integration',
        href: '/insights/lithography-process-integration-guide',
        meta: 'Substrate preparation, HMDS, coating, bake, exposure, development, etch transfer, and resist strip integration',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build your next lithography track workflow with NineScrolls',
    copy: 'Share your substrate sizes, resist family, target thickness, developer chemistry, bake steps, EBR needs, module count, and throughput goals.',
    primaryAction: {
      label: 'Start Coater/Developer Quote',
      href: '/request-quote?products=coater-developer',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=coater-developer',
    },
    backgroundImage: productImage,
  },
};
