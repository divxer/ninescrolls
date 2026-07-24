import type { ProductDetailConfig } from '../ProductDetailPage.types';

const plutoTImage = '/assets/images/redesign/products/pluto-t-standardized.webp';
const plutoTChamberImage = '/assets/images/redesign/products/pluto-t-chamber.webp';
const plutoTSamplesImage = '/assets/images/redesign/products/pluto-t-samples.webp';
const plutoTWithPumpImage = '/assets/images/redesign/products/pluto-t-with-pump.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const plutoTConfig: ProductDetailConfig = {
  slug: 'pluto-t',
  seo: {
    title: 'PLUTO-T Compact RF Plasma Cleaner',
    description: 'Compact 200 W RF plasma cleaner (13.56 MHz) with ~4.3L stainless steel chamber, touchscreen control, and 1-2 gas lines for single-sample cleaning and surface activation.',
    keywords: 'PLUTO-T plasma cleaner, 200W RF plasma cleaner, compact RF plasma cleaner, single-sample plasma cleaning, benchtop plasma cleaner 13.56 MHz',
  },
  schema: {
    name: 'PLUTO-T Compact RF Plasma Cleaner',
    description: 'Compact 200 W RF plasma cleaner with ~4.3L stainless steel chamber, 13.56 MHz auto-impedance matching, and touchscreen control.',
    sku: 'pluto-t',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'How is PLUTO-T different from PLUTO-M?',
      answer: 'PLUTO-T is an RF-only 200 W compact cleaner with a ~4.3L chamber and 1 W power precision, sized for single-sample workflows. PLUTO-M shares the same 200 W RF generator in a larger ~8L chamber with two standard gas lines and recipe storage, for larger fixtures and small batches.',
    },
    {
      question: 'Can PLUTO-T be purchased directly?',
      answer: 'Yes. PLUTO-T can be ordered directly, and institutional buyers can also request a budgetary quote for PO-based purchasing.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'PLUTO-T',
  },
  hero: {
    eyebrow: 'Compact RF Plasma Cleaner',
    title: 'PLUTO-T Compact RF Plasma Cleaner',
    description: 'A compact 200 W RF plasma cleaner for single-sample cleaning, surface activation, and small-lab entry into plasma processing.',
    backgroundImage: plutoTChamberImage,
    image: {
      src: plutoTImage,
      alt: 'PLUTO-T compact RF plasma cleaner',
      width: 1024,
      height: 1024,
    },
    stats: [
      { label: 'Chamber', value: '~4.3 L' },
      { label: 'RF Power', value: '200 W' },
      { label: 'Frequency', value: '13.56 MHz' },
      { label: 'Control', value: 'Touchscreen' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=pluto-t' },
  },
  commerce: {
    variants: [
      {
        sku: 'pluto-t',
        label: 'RF (13.56 MHz)',
        price: 9999,
        cartName: 'PLUTO-T - 200W RF Plasma Cleaner',
      },
    ],
    defaultSku: 'pluto-t',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-t' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Single-Sample Plasma Processing',
    title: 'High power density RF cleaning in a benchtop footprint.',
    copy: 'PLUTO-T pairs a 200 W RF source with a compact ~4.3L stainless steel chamber, giving small labs precise, repeatable plasma cleaning without a full-size system.',
    windows: [
      { title: 'Cleaning', copy: 'Remove organic residue before bonding, coating, or analysis.', details: ['O2 / N2 / Ar', '1 W power precision'] },
      { title: 'Activation', copy: 'Raise surface energy for adhesion, wetting, and PDMS bonding.', details: ['Polymers', 'Glass', 'Metals'] },
      { title: 'Small-Lab Entry', copy: 'Touchscreen automation makes plasma processing approachable for new users.', details: ['Fully automated runs', 'Benchtop format'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for compact single-sample plasma workflows.',
    compareAction: { label: 'Compare PLUTO-M', href: '/products/pluto-m' },
    cards: [
      { title: 'Sample Cleaning', copy: 'Prepare individual substrates and samples with adjustable 0-200 W RF power.' },
      { title: 'Surface Activation', copy: 'Activate surfaces before bonding, coating, or microfluidic assembly.' },
      { title: 'Teaching and Prototyping', copy: 'A compact automated platform for teaching labs and early process development.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'PLUTO-T configuration window',
    copy: 'Representative PLUTO-T configuration from the equipment summary and legacy datasheet table. Confirm process-specific requirements during quote review.',
    testId: 'pluto-t-specifications',
    items: [
      { label: 'Chamber', value: '~4.3 L stainless steel' },
      { label: 'Chamber Size', value: 'φ150 mm x 245 mm depth' },
      { label: 'RF Power', value: '0-200 W, 1 W precision' },
      { label: 'Frequency', value: '13.56 MHz, auto-impedance matching' },
      { label: 'Electrode', value: '95 x 170 mm flat plate' },
      { label: 'Gas Lines', value: '1 standard, optional 2nd (O2 / N2 / Ar)' },
      { label: 'Control', value: '4.3 in touchscreen, fully automated' },
      { label: 'System Size', value: '380 x 500 x 490 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where PLUTO-T fits',
    items: ['Single-sample cleaning', 'Surface activation', 'PDMS and microfluidic bonding', 'SEM sample preparation', 'Teaching labs', 'Process prototyping'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the chamber interior, electrode format, sample handling, and benchtop footprint before configuration review.',
    images: [
      {
        src: plutoTChamberImage,
        alt: 'PLUTO-T chamber interior with flat plate electrode',
        label: 'Chamber interior',
        width: 1024,
        height: 962,
      },
      {
        src: plutoTSamplesImage,
        alt: 'PLUTO-T sample tray with wafer during plasma processing',
        label: 'Sample processing',
        width: 1024,
        height: 848,
      },
      {
        src: plutoTWithPumpImage,
        alt: 'PLUTO-T complete system with vacuum pump',
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
    title: 'Choose PLUTO-T for compact RF plasma processing.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=pluto-t' },
    backgroundImage: plutoTChamberImage,
  },
};
