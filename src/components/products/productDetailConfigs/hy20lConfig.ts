import type { ProductDetailConfig } from '../ProductDetailPage.types';

const hy20lImage = '/assets/images/redesign/products/hy-20l-standardized.webp';
const hy20lChamberViewImage = '/assets/images/redesign/products/hy-20l-chamber-view.webp';
const hy20lDimensionsImage = '/assets/images/redesign/products/hy-20l-dimensions.webp';
const hy20lLabSceneImage = '/assets/images/redesign/products/hy-20l-lab-scene.webp';
const hy20lPlasmaDetailImage = '/assets/images/redesign/products/hy-20l-plasma-detail.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const hy20lConfig: ProductDetailConfig = {
  slug: 'hy-20l',
  seo: {
    title: 'HY-20L Batch Plasma Processing System',
    description: 'Research-grade 20L RF/MF batch plasma cleaner for multi-sample preparation, surface activation, and photoresist ashing.',
    keywords: 'HY-20L plasma cleaner, 20L plasma cleaner, batch plasma cleaning, RF plasma cleaner, mid-frequency plasma cleaner',
  },
  schema: {
    name: 'HY-20L Batch Plasma Processing System',
    description: 'Research-grade 20L batch plasma processing system with RF and mid-frequency configurations.',
    sku: 'hy-20l',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'Which HY-20L frequency should I choose?',
      answer: 'RF is the default for research batch processing and surface activation. Mid-frequency is the lower-cost option for routine batch cleaning and robust surface treatment.',
    },
    {
      question: 'How is HY-20L different from HY-4L?',
      answer: 'HY-20L increases chamber volume to 20 liters for multi-sample batch workflows while keeping the HY family PLC and touchscreen operating model.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'HY-20L',
  },
  hero: {
    eyebrow: 'Batch Plasma Cleaner',
    title: 'HY-20L Batch Plasma Processing System',
    description: 'A 20L RF/MF plasma cleaner for batch sample preparation, surface activation, and research-scale process development.',
    image: {
      src: hy20lImage,
      alt: 'HY-20L batch plasma processing system standardized product view',
      width: 1400,
      height: 1120,
    },
    stats: [
      { label: 'Chamber', value: '20 L' },
      { label: 'Power', value: '150 / 300 W' },
      { label: 'Options', value: 'RF / MF' },
      { label: 'Control', value: 'PLC' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=hy-20l' },
  },
  commerce: {
    variants: [
      {
        sku: 'hy-20l-rf',
        label: 'RF (13.56 MHz)',
        price: 14999,
        cartName: 'HY-20L - RF (13.56 MHz) Plasma Processing System',
      },
      {
        sku: 'hy-20l-mf',
        label: 'Mid-Frequency (40 kHz)',
        price: 11999,
        cartName: 'HY-20L - Mid-Frequency (40 kHz) Plasma Processing System',
      },
    ],
    defaultSku: 'hy-20l-rf',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-20l' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Batch Surface Preparation',
    title: '20L plasma processing for multi-sample workflows.',
    copy: 'HY-20L bridges compact plasma cleaning and higher-throughput batch preparation for research labs that need repeatable processing without an industrial platform.',
    windows: [
      { title: 'Batch Cleaning', copy: 'Process multiple samples per run before bonding, coating, or analysis.', details: ['20 L chamber', 'Multi-sample trays'] },
      { title: 'Surface Activation', copy: 'Improve surface energy for polymers, glass, metals, and device substrates.', details: ['RF option', 'MF option'] },
      { title: 'Photoresist Ashing', copy: 'Support oxygen plasma descum and batch organic residue removal.', details: ['Oxygen plasma', 'PLC recipes'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for larger-batch plasma workflows.',
    compareAction: { label: 'Compare plasma cleaners', href: '/products/plasma-cleaner' },
    cards: [
      { title: 'Multi-Sample Preparation', copy: 'Treat larger sample sets in a single run for research productivity.' },
      { title: 'Routine Activation', copy: 'Prepare polymers, glass, and device substrates before bonding or coating.' },
      { title: 'Core Facility Workflows', copy: 'Give shared labs a simple, documented plasma process platform.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'HY-20L configuration window',
    copy: 'Representative HY-20L options. Confirm process-specific configuration during quote review.',
    testId: 'hy-20l-specifications',
    items: [
      { label: 'Chamber Volume', value: '20 L' },
      { label: 'RF Frequency', value: '13.56 MHz' },
      { label: 'MF Frequency', value: '40 kHz' },
      { label: 'Power', value: '150 W RF / 300 W MF' },
      { label: 'Gas Channels', value: '2' },
      { label: 'Control', value: 'PLC + touchscreen' },
      { label: 'Chamber', value: 'Stainless steel' },
      { label: 'Internal Size', value: '250 x 250 x 320 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where HY-20L fits',
    items: ['Batch plasma cleaning', 'Photoresist ashing', 'Surface activation', 'Bonding preparation', 'Multi-sample preparation', 'Shared research labs'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the 20L enclosure, chamber access, front controls, and bench integration before configuration review.',
    images: [
      {
        src: hy20lChamberViewImage,
        alt: 'HY-20L open chamber with multi-level sample trays',
        label: 'Chamber view',
        width: 1400,
        height: 930,
      },
      {
        src: hy20lDimensionsImage,
        alt: 'HY-20L system dimensions and footprint',
        label: 'Dimensions',
        width: 1600,
        height: 1067,
      },
      {
        src: hy20lLabSceneImage,
        alt: 'HY-20L plasma cleaner integrated in a laboratory workflow',
        label: 'Lab integration',
        width: 1600,
        height: 1067,
      },
      {
        src: hy20lPlasmaDetailImage,
        alt: 'HY-20L plasma glow inside the chamber viewport',
        label: 'Plasma detail',
        width: 1400,
        height: 766,
      },
    ],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Related Resources',
    items: [
      { title: 'What Is a Plasma Cleaner?', href: '/insights/what-is-plasma-cleaner-principles-types', meta: 'Principles, types, and how plasma cleaning works' },
      { title: 'Plasma Cleaner Applications', href: '/insights/plasma-cleaner-applications-guide', meta: 'Research and production use cases' },
      { title: 'Plasma Cleaner Buying Guide', href: '/insights/plasma-cleaner-buying-guide', meta: 'Selection guide for chamber size, vacuum systems, and TCO' },
    ],
  },
  finalCta: {
    eyebrow: 'Ready to Configure',
    title: 'Choose the HY-20L configuration for your batch workflow.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-20l' },
    backgroundImage: hy20lLabSceneImage,
  },
};
