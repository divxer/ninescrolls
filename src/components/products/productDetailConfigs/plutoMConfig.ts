import type { ProductDetailConfig } from '../ProductDetailPage.types';

const plutoMImage = '/assets/images/redesign/products/pluto-m-standardized.webp';
const plutoMChamberImage = '/assets/images/redesign/products/pluto-m-chamber-open.webp';
const plutoMWithPumpImage = '/assets/images/redesign/products/pluto-m-with-pump.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const plutoMConfig: ProductDetailConfig = {
  slug: 'pluto-m',
  seo: {
    title: 'PLUTO-M Mid-Capacity RF Plasma Cleaner',
    description: 'Mid-capacity 200 W RF plasma cleaner (13.56 MHz) with ~8L stainless steel chamber, gas-shower electrode, recipe storage, and two-stage vacuum system for multi-sample batches.',
    keywords: 'PLUTO-M plasma cleaner, 8L plasma cleaner, mid-capacity RF plasma cleaner, batch plasma cleaning, recipe storage plasma cleaner',
  },
  schema: {
    name: 'PLUTO-M Mid-Capacity RF Plasma Cleaner',
    description: 'Mid-capacity 200 W RF plasma cleaner with ~8L stainless steel chamber, perforated gas-shower electrode, and touchscreen recipe storage.',
    sku: 'pluto-m',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'How is PLUTO-M different from PLUTO-T?',
      answer: 'PLUTO-M doubles the chamber volume to ~8L for multi-sample batches, adds a second gas line as standard, uses a perforated gas-shower electrode for uniform distribution, and stores recipes on the touchscreen for repeatable runs. PLUTO-T is the compact single-sample entry point.',
    },
    {
      question: 'Can PLUTO-M be purchased directly?',
      answer: 'Yes. PLUTO-M can be ordered directly, and institutional buyers can also request a budgetary quote for PO-based purchasing.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'PLUTO-M',
  },
  hero: {
    eyebrow: 'Mid-Capacity RF Plasma Cleaner',
    title: 'PLUTO-M Mid-Capacity RF Plasma Cleaner',
    description: 'An ~8L RF plasma cleaner with gas-shower electrode and recipe storage for multi-sample batches, polymer treatment, and photoresist ashing.',
    backgroundImage: plutoMChamberImage,
    image: {
      src: plutoMImage,
      alt: 'PLUTO-M mid-capacity RF plasma cleaner',
      width: 1024,
      height: 1024,
    },
    stats: [
      { label: 'Chamber', value: '~8 L' },
      { label: 'RF Power', value: '200 W' },
      { label: 'Gas Lines', value: '2' },
      { label: 'Recipes', value: 'Stored' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=pluto-m' },
  },
  commerce: {
    variants: [
      {
        sku: 'pluto-m',
        label: 'RF (13.56 MHz)',
        price: 12999,
        cartName: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
      },
    ],
    defaultSku: 'pluto-m',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-m' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Batch Plasma Processing',
    title: 'Multi-sample RF cleaning with recipe repeatability.',
    copy: 'PLUTO-M pairs a 200 W RF source with an ~8L chamber and perforated gas-shower electrode, so batches see uniform plasma while stored recipes keep every run consistent.',
    windows: [
      { title: 'Batch Cleaning', copy: 'Process multi-sample batches in a ~8L stainless steel chamber.', details: ['2x PLUTO-T capacity', '2 gas lines standard'] },
      { title: 'Uniform Activation', copy: 'The gas-shower electrode distributes process gas evenly across samples.', details: ['O2 / N2 / Ar', '1 W power precision'] },
      { title: 'Recipe Storage', copy: 'Store validated recipes on the touchscreen for repeatable shared-lab use.', details: ['Fully automated runs', 'Multi-user workflows'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for mid-capacity batch plasma workflows.',
    compareAction: { label: 'Compare PLUTO-T', href: '/products/pluto-t' },
    cards: [
      { title: 'Multi-Sample Preparation', copy: 'Efficient batch preparation for characterization and analysis workflows.' },
      { title: 'Polymer Treatment', copy: 'Surface modification for adhesion and biocompatibility across sample batches.' },
      { title: 'Photoresist Ashing', copy: 'Uniform RF processing for complete resist removal.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'PLUTO-M configuration window',
    copy: 'Representative PLUTO-M configuration from the equipment summary and legacy datasheet table. Confirm process-specific requirements during quote review.',
    testId: 'pluto-m-specifications',
    items: [
      { label: 'Chamber', value: '~8 L stainless steel' },
      { label: 'Chamber Size', value: 'φ210 mm x 230 mm' },
      { label: 'RF Power', value: '0-200 W, 1 W precision' },
      { label: 'Frequency', value: '13.56 MHz, auto-impedance matching' },
      { label: 'Electrode', value: '125 x 125 mm perforated gas-shower plate' },
      { label: 'Gas Lines', value: '2 lines, 6 mm connectors (O2 / N2 / Ar)' },
      { label: 'Vacuum', value: 'VRD-4 two-stage oil pump, 4 m3/h' },
      { label: 'Control', value: '4.3 in touchscreen with recipe storage' },
      { label: 'System Size', value: '405 x 610 x 670 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where PLUTO-M fits',
    items: ['Multi-sample batch cleaning', 'Surface activation', 'Polymer and plastics treatment', 'Photoresist ashing', 'SEM sample preparation', 'Core facility workflows'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the ~8L chamber, gas-shower electrode, and complete vacuum system before configuration review.',
    images: [
      {
        src: plutoMChamberImage,
        alt: 'PLUTO-M open chamber with gas-shower electrode',
        label: 'Open chamber',
        width: 1024,
        height: 1024,
      },
      {
        src: plutoMWithPumpImage,
        alt: 'PLUTO-M complete system with vacuum pump',
        label: 'Complete system',
        width: 1024,
        height: 1024,
      },
    ],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Related Resources',
    items: [
      { title: 'What Is a Plasma Cleaner?', href: '/insights/what-is-plasma-cleaner-principles-types', meta: 'Principles, types, and how plasma cleaning works' },
      { title: 'PLUTO vs HY Comparison', href: '/insights/pluto-vs-hy-plasma-cleaner-comparison', meta: 'Architecture, power density, and cost-of-ownership comparison' },
      { title: 'Plasma Cleaner Buying Guide', href: '/insights/plasma-cleaner-buying-guide', meta: 'Selection guide for chamber size, vacuum systems, and TCO' },
    ],
  },
  finalCta: {
    eyebrow: 'Ready to Configure',
    title: 'Choose PLUTO-M for repeatable batch plasma processing.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-m' },
    backgroundImage: plutoMChamberImage,
  },
};
