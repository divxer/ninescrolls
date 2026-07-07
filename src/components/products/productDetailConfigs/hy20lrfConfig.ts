import type { ProductDetailConfig } from '../ProductDetailPage.types';

const hy20lrfImage = '/assets/images/redesign/products/hy-20lrf-standardized.webp';
const hy20lrfRearConnectionsImage = '/assets/images/redesign/products/hy-20lrf-rear-connections.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const hy20lrfConfig: ProductDetailConfig = {
  slug: 'hy-20lrf',
  seo: {
    title: 'HY-20LRF Research-Grade Batch Plasma Cleaner',
    description: 'Research-grade 20L RF batch plasma cleaner with 300 W RF power, 4-layer trays, PLC touchscreen control, and documented repeatable processing.',
    keywords: 'HY-20LRF plasma cleaner, 20L RF plasma cleaner, 300W RF plasma, research batch plasma cleaner, 4-layer plasma tray',
  },
  schema: {
    name: 'HY-20LRF Research-Grade Batch Plasma Cleaner',
    description: 'Research-grade 20L RF batch plasma cleaner with 300 W RF power, 4-layer sample trays, and PLC touchscreen control.',
    sku: 'hy-20lrf',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'How is HY-20LRF different from HY-20L?',
      answer: 'HY-20LRF focuses on a single higher-power RF configuration for documented, repeatable batch plasma processing. HY-20L offers RF and mid-frequency options for broader budget and process flexibility.',
    },
    {
      question: 'Can HY-20LRF be purchased directly?',
      answer: 'Yes. HY-20LRF can be ordered directly, and institutional buyers can also request a budgetary quote for PO-based purchasing.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'HY-20LRF',
  },
  hero: {
    eyebrow: 'Research Batch Plasma Cleaner',
    title: 'HY-20LRF Research-Grade Batch Plasma Cleaner',
    description: 'A 20L RF plasma cleaner for academic research teams that need documented, repeatable batch surface processing.',
    backgroundImage: hy20lrfRearConnectionsImage,
    image: {
      src: hy20lrfImage,
      alt: 'HY-20LRF research-grade batch plasma cleaner',
      width: 1400,
      height: 1400,
    },
    stats: [
      { label: 'Chamber', value: '20 L' },
      { label: 'RF Power', value: '300 W' },
      { label: 'Tray', value: '4 layers' },
      { label: 'Control', value: 'PLC' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=hy-20lrf' },
  },
  commerce: {
    variants: [
      {
        sku: 'hy-20lrf',
        label: 'RF (13.56 MHz)',
        price: 14499,
        cartName: 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner',
      },
    ],
    defaultSku: 'hy-20lrf',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-20lrf' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Repeatable Batch Processing',
    title: '20L RF plasma treatment for documented research workflows.',
    copy: 'HY-20LRF is tuned for labs that need a higher-power RF batch cleaner with repeatable recipe control, multi-layer sample loading, and straightforward operation.',
    windows: [
      { title: 'Batch Cleaning', copy: 'Process larger sample sets with a 20L stainless-steel chamber.', details: ['20 L chamber', '4-layer tray'] },
      { title: 'RF Activation', copy: 'Use 13.56 MHz RF plasma for surface activation before bonding, coating, or analysis.', details: ['300 W RF', 'O2 / N2 / Ar'] },
      { title: 'Research Documentation', copy: 'PLC touchscreen control supports repeatable runs for shared-lab workflows.', details: ['Auto / Manual', 'Documented process'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for research-grade batch plasma workflows.',
    compareAction: { label: 'Compare HY-20L', href: '/products/hy-20l' },
    cards: [
      { title: 'Core Facility Preparation', copy: 'Support repeated plasma cleaning and activation across multi-user research workflows.' },
      { title: '4-Layer Sample Loading', copy: 'Use the included tray format for larger batches and organized sample handling.' },
      { title: 'RF-Only Repeatability', copy: 'Standardize on one RF configuration when documented process consistency matters more than frequency flexibility.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'HY-20LRF configuration window',
    copy: 'Representative HY-20LRF configuration. Confirm process-specific gas and power requirements during quote review.',
    testId: 'hy-20lrf-specifications',
    items: [
      { label: 'Chamber Volume', value: '20 L' },
      { label: 'RF Frequency', value: '13.56 MHz' },
      { label: 'RF Power', value: '300 W' },
      { label: 'Gas Lines', value: '2' },
      { label: 'Sample Tray', value: '4 layers' },
      { label: 'Control', value: 'PLC + touchscreen' },
      { label: 'Chamber', value: 'Stainless steel' },
      { label: 'Internal Size', value: '250 x 250 x 320 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where HY-20LRF fits',
    items: ['Batch plasma cleaning', 'Surface activation', 'Bonding preparation', 'SEM sample preparation', 'Multi-sample processing', 'Core facility workflows'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the 20L enclosure, front controls, service-side access, and bench integration before configuration review.',
    images: [
      {
        src: hy20lrfRearConnectionsImage,
        alt: 'HY-20LRF rear service connections and vacuum ports',
        label: 'Rear connections',
        width: 1400,
        height: 1094,
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
    title: 'Choose HY-20LRF for documented RF batch processing.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-20lrf' },
    backgroundImage: hy20lrfRearConnectionsImage,
  },
};
