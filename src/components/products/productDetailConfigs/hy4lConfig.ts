import type { ProductDetailConfig } from '../ProductDetailPage.types';

const hy4lImage = '/assets/images/redesign/products/hy-4l-standardized.webp';
const hy4lFrontViewImage = '/assets/images/redesign/products/hy-4l-front-view.webp';
const hy4lRearConnectionsImage = '/assets/images/redesign/products/hy-4l-rear-connections.webp';
const hy4lLabSceneImage = '/assets/images/redesign/products/hy-4l-lab-scene.webp';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const hy4lConfig: ProductDetailConfig = {
  slug: 'hy-4l',
  seo: {
    title: 'HY-4L Plasma Cleaner',
    description: 'Compact 4L plasma cleaner with RF and mid-frequency configurations for research labs, teaching labs, and sample preparation.',
    keywords: 'HY-4L plasma cleaner, compact plasma cleaner, RF plasma cleaner, mid-frequency plasma cleaner',
  },
  schema: {
    name: 'HY-4L Plasma Cleaner',
    description: 'Compact 4L plasma cleaner with RF and mid-frequency configurations.',
    sku: 'hy-4l',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'Which HY-4L frequency should I choose?',
      answer: 'RF is the default for research plasma cleaning and surface activation. Mid-frequency is a lower-cost option for routine sample preparation.',
    },
    {
      question: 'Can HY-4L be purchased directly?',
      answer: 'Yes. HY-4L can be ordered directly by configuration, and institutional buyers can also request a budgetary quote for PO-based purchasing.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'HY-4L',
  },
  hero: {
    eyebrow: 'Compact Plasma Cleaner',
    title: 'HY-4L Plasma Cleaner',
    description: 'A compact 4L plasma cleaner for research labs, teaching labs, and low-volume sample preparation.',
    image: {
      src: hy4lImage,
      alt: 'HY-4L compact plasma cleaner standardized product view',
      width: 1400,
      height: 1120,
    },
    stats: [
      { label: 'Chamber', value: '4 L' },
      { label: 'Power', value: '150 / 300 W' },
      { label: 'Options', value: 'RF / MF' },
      { label: 'Lead Time', value: '3-4 weeks' },
    ],
    // Commerce pages render ProductCommercePanel instead of hero.primaryAction;
    // keep route-safe fallback values for type parity.
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=hy-4l' },
  },
  commerce: {
    variants: [
      { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
      { sku: 'hy-4l-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
    ],
    defaultSku: 'hy-4l-rf',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Surface Preparation',
    title: 'Compact plasma treatment for small-lab workflows.',
    copy: 'HY-4L supports cleaning, activation, and sample preparation without the footprint of a full-size plasma system.',
    windows: [
      { title: 'Cleaning', copy: 'Remove organic residue before bonding, coating, or analysis.', details: ['Oxygen plasma', 'Low-volume samples'] },
      { title: 'Activation', copy: 'Improve surface energy for adhesion and wetting.', details: ['Polymers', 'Glass', 'Metals'] },
      { title: 'Education', copy: 'A compact platform for teaching and prototyping labs.', details: ['4 L chamber', 'Bench format'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for compact lab plasma workflows.',
    compareAction: { label: 'Compare plasma cleaners', href: '/products/plasma-cleaner' },
    cards: [
      { title: 'Sample Cleaning', copy: 'Prepare small substrates and samples before downstream processing.' },
      { title: 'Surface Activation', copy: 'Increase surface energy before bonding, coating, or printing.' },
      { title: 'Teaching Labs', copy: 'Support hands-on plasma processing education with a compact system.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'HY-4L configuration window',
    copy: 'Representative HY-4L options. Confirm process-specific configuration during quote review.',
    testId: 'hy-4l-specifications',
    items: [
      { label: 'Chamber Volume', value: '4 L' },
      { label: 'RF Frequency', value: '13.56 MHz' },
      { label: 'MF Frequency', value: '40 kHz' },
      { label: 'Power', value: '150 W RF / 300 W MF' },
      { label: 'Gas Channels', value: '2' },
      { label: 'Control', value: 'PLC + touchscreen' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where HY-4L fits',
    items: ['Surface cleaning', 'Surface activation', 'Bonding preparation', 'Teaching labs', 'Small sample preparation', 'Research prototyping'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the compact enclosure, service-side access, chamber placement, and bench integration before configuration review.',
    images: [
      {
        src: hy4lFrontViewImage,
        alt: 'HY-4L plasma cleaner front control view',
        label: 'Front view',
        width: 1400,
        height: 1050,
      },
      {
        src: hy4lRearConnectionsImage,
        alt: 'HY-4L plasma cleaner rear service connections',
        label: 'Rear connections',
        width: 1400,
        height: 1050,
      },
      {
        src: hy4lLabSceneImage,
        alt: 'HY-4L plasma cleaner on a laboratory bench',
        label: 'Lab integration',
        width: 1600,
        height: 1100,
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
    title: 'Choose the HY-4L configuration for your lab.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'View Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
    backgroundImage: hy4lLabSceneImage,
  },
};
