import type { ProductDetailConfig } from '../ProductDetailPage.types';

const plutoFImage = '/assets/images/redesign/products/pluto-f-standardized.webp';
const plutoFChamberOpenImage = '/assets/images/redesign/products/pluto-f-chamber-open.webp';
const plutoFChamberInteriorImage = '/assets/images/redesign/products/pluto-f-chamber-interior.webp';
const plutoFWithPumpImage = '/assets/images/redesign/products/pluto-f-with-pump.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const plutoFConfig: ProductDetailConfig = {
  slug: 'pluto-f',
  seo: {
    title: 'PLUTO-F Flagship RF Plasma Cleaner',
    description: 'Flagship 500 W RF plasma cleaner (13.56 MHz) with ~14.5L aluminum alloy chamber, advanced recipe management, and 2 gas lines for high-power cleaning and large batches.',
    keywords: 'PLUTO-F plasma cleaner, 500W RF plasma cleaner, flagship plasma cleaner, large batch plasma cleaning, core facility plasma cleaner',
  },
  schema: {
    name: 'PLUTO-F Flagship RF Plasma Cleaner',
    description: 'Flagship 500 W RF plasma cleaner with ~14.5L 6061-T6 aluminum alloy chamber and advanced touchscreen recipe management.',
    sku: 'pluto-f',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'How is PLUTO-F different from PLUTO-M?',
      answer: 'PLUTO-F moves to a ~14.5L aluminum alloy chamber with 500 W of RF power — for faster cycles, larger batches, and harder-to-clean contamination — and adds advanced multi-step recipe management for shared facilities. PLUTO-M is the ~8L, 200 W mid-capacity option.',
    },
    {
      question: 'Can PLUTO-F be purchased directly?',
      answer: 'Yes. PLUTO-F can be ordered directly, and institutional buyers can also request a budgetary quote for PO-based purchasing.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'PLUTO-F',
  },
  hero: {
    eyebrow: 'Flagship RF Plasma Cleaner',
    title: 'PLUTO-F Flagship RF Plasma Cleaner',
    description: 'A 500 W RF plasma cleaner with ~14.5L aluminum alloy chamber and advanced recipe management for high-power cleaning, large batches, and multi-user core facilities.',
    backgroundImage: plutoFChamberInteriorImage,
    image: {
      src: plutoFImage,
      alt: 'PLUTO-F flagship RF plasma cleaner',
      width: 1024,
      height: 904,
    },
    stats: [
      { label: 'Chamber', value: '~14.5 L' },
      { label: 'RF Power', value: '500 W' },
      { label: 'Gas Lines', value: '2' },
      { label: 'Recipes', value: 'Multi-step' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=pluto-f' },
  },
  commerce: {
    variants: [
      {
        sku: 'pluto-f',
        label: 'RF (13.56 MHz)',
        price: 15999,
        cartName: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
      },
    ],
    defaultSku: 'pluto-f',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-f' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'High-Power Batch Processing',
    title: '500 W RF processing for large batches and stubborn contamination.',
    copy: 'PLUTO-F pairs a 500 W RF source with a ~14.5L aluminum alloy chamber, shortening process cycles and handling contamination that lower-power systems leave behind.',
    windows: [
      { title: 'High-Power Cleaning', copy: 'Aggressive contaminant removal with continuously adjustable 0-500 W RF.', details: ['1 W power precision', 'O2 / N2 / Ar'] },
      { title: 'Large Batches', copy: 'Process wafers, devices, and components together in a ~14.5L chamber.', details: ['240 x 300 x 200 mm chamber', '205 x 205 mm electrode'] },
      { title: 'Advanced Recipes', copy: 'Multi-step recipe sequences stay reproducible across users and sessions.', details: ['Store and recall recipes', 'Core facility ready'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for high-power, multi-user plasma workflows.',
    compareAction: { label: 'Compare PLUTO-M', href: '/products/pluto-m' },
    cards: [
      { title: 'Core Facility Workflows', copy: 'Recipe locking and multi-step sequences keep shared-lab processing consistent.' },
      { title: 'Large-Batch Preparation', copy: 'Clean and activate multiple wafers, devices, or components per run.' },
      { title: 'Process Development', copy: 'A wide 0-500 W window supports aggressive and delicate recipes on one platform.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'PLUTO-F configuration window',
    copy: 'Representative PLUTO-F configuration from the equipment summary and legacy datasheet table. Confirm process-specific requirements during quote review.',
    testId: 'pluto-f-specifications',
    items: [
      { label: 'Chamber', value: '~14.5 L, 6061-T6 aluminum alloy' },
      { label: 'Chamber Size', value: '240 x 300 x 200 mm' },
      { label: 'RF Power', value: '0-500 W, 1 W precision' },
      { label: 'Frequency', value: '13.56 MHz, auto-impedance matching' },
      { label: 'Electrode', value: '205 x 205 mm flat plate' },
      { label: 'Gas Lines', value: '2 lines, needle valve control (O2 / N2 / Ar)' },
      { label: 'Vacuum', value: 'Oil pump included; dry pump optional' },
      { label: 'Control', value: '4.3 in touchscreen, advanced recipe management' },
      { label: 'System Size', value: '405 x 610 x 670 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where PLUTO-F fits',
    items: ['High-power plasma cleaning', 'Large-batch surface activation', 'Wafer and device preparation', 'High-power surface treatment', 'Multi-user core facilities', 'Semiconductor process development'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the ~14.5L chamber, electrode format, and complete vacuum system before configuration review.',
    images: [
      {
        src: plutoFChamberOpenImage,
        alt: 'PLUTO-F open chamber with batch tray',
        label: 'Open chamber',
        width: 1024,
        height: 1024,
      },
      {
        src: plutoFChamberInteriorImage,
        alt: 'PLUTO-F chamber interior with flat plate electrode',
        label: 'Chamber interior',
        width: 1024,
        height: 1024,
      },
      {
        src: plutoFWithPumpImage,
        alt: 'PLUTO-F complete system with vacuum pump',
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
    title: 'Choose PLUTO-F for high-power batch plasma processing.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-f' },
    backgroundImage: plutoFChamberInteriorImage,
  },
};
