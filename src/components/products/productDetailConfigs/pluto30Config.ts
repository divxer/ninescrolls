import type { ProductDetailConfig } from '../ProductDetailPage.types';

// Quote-only product page for the PLUTO-30 (30L vertical plasma system).
// Specs transcribed from the authoritative OEM catalog (总样本, p8): 电极间隙 30mm,
// RF 500W/13.56MHz, 外形 706x804x735mm. No commerce/Stripe (quote-only, like RIE/ICP).
const productImage = '/assets/images/redesign/products/pluto-30-standardized.webp';
const pluto30ClosedImage = '/assets/images/redesign/products/pluto-30-closed.webp';
const pluto30LabImage = '/assets/images/redesign/products/pluto-30-lab-scene.webp';
const pluto30DimensionsImage = '/assets/images/redesign/products/pluto-30-dimensions.webp';

export const pluto30Config: ProductDetailConfig = {
  slug: 'pluto-30',
  seo: {
    title: 'PLUTO-30 Batch RF Plasma System',
    description:
      'PLUTO-30 is a 30L vertical RF plasma system (500 W, 13.56 MHz) with up to 7 adjustable sample shelves, MFC gas control, and a 7 in touchscreen for batch cleaning, activation, and etching in R&D and pilot production.',
    keywords:
      'PLUTO-30 plasma system, 30L plasma cleaner, batch plasma cleaning, MFC plasma system, vertical plasma system, pilot production plasma',
  },
  schema: {
    name: 'PLUTO-30 Batch RF Plasma System',
    description:
      'A 30L vertical RF plasma system with up to 7 adjustable sample shelves, MFC gas control, and 7 in touchscreen for batch cleaning, activation, and etching.',
    sku: 'pluto-30',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'How is PLUTO-30 different from the benchtop PLUTO cleaners?',
      answer:
        'PLUTO-30 steps up from the benchtop 4-14L cleaners to a 30L vertical chamber with up to 7 adjustable sample shelves, digital MFC gas control (1 standard, up to 4), and a 7 in touchscreen with recipe storage. It targets higher-throughput batch work and pilot production rather than single-sample lab use.',
    },
    {
      question: 'What processes does PLUTO-30 support?',
      answer:
        'PLUTO-30 handles plasma cleaning, surface activation, and etching. Flexible electrode configurations and MFC-controlled gas distribution let one system move quickly between products and recipes, run automatically or manually, and store validated process menus.',
    },
    {
      question: 'Can PLUTO-30 be purchased directly?',
      answer:
        'PLUTO-30 is configured per application and quoted directly. Share your samples, throughput, and gas chemistry and we will confirm the electrode and MFC configuration during quote review.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'PLUTO-30',
  },
  hero: {
    eyebrow: 'Batch RF Plasma System',
    title: 'PLUTO-30 Batch RF Plasma System',
    description:
      'A 30L vertical RF plasma system with up to 7 adjustable sample shelves, MFC gas control, and a 7 in touchscreen for repeatable batch cleaning, activation, and etching.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'PLUTO-30 batch RF plasma system',
      width: 1002,
      height: 1100,
    },
    stats: [
      { label: 'Chamber', value: '30 L' },
      { label: 'RF Power', value: '500 W' },
      { label: 'Shelves', value: 'Up to 7' },
      { label: 'Gas Control', value: 'MFC' },
    ],
    primaryAction: { label: 'Request Quote', href: '/request-quote?products=pluto-30' },
    secondaryAction: { label: 'Talk to an Engineer', href: '/contact?topic=expert&product=pluto-30' },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Batch And Pilot-Scale Plasma',
    title: 'Digital gas control and multi-shelf batches in one system.',
    copy:
      'PLUTO-30 pairs a 500 W RF source and automatic matching network with a 30L vertical chamber, up to 7 adjustable shelves, and MFC-controlled gas. Recipes and permissions live on a 7 in touchscreen so shared teams get repeatable batch results.',
    windows: [
      {
        title: 'Multi-Shelf Batch Cleaning',
        copy: 'Load up to 7 adjustable sample shelves for higher throughput cleaning and activation.',
        details: ['30 L chamber', 'Up to 7 shelves', '30 mm electrode gap'],
      },
      {
        title: 'MFC Gas Control',
        copy: 'Digital mass-flow control (1 standard, up to 4) supports repeatable, tunable chemistry.',
        details: ['1-4 MFCs', 'Recipe storage', 'Auto / manual modes'],
      },
      {
        title: 'Flexible Electrodes',
        copy: 'Configurable electrodes and gas distribution enable fast changeover between products and processes.',
        details: ['Cleaning', 'Activation', 'Etching'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for higher-throughput batch and pilot plasma workflows.',
    compareAction: { label: 'Compare PLUTO-F', href: '/products/pluto-f' },
    cards: [
      { title: 'R&D To Pilot Production', copy: 'A vertical batch system that bridges lab development and small-batch production.' },
      { title: 'Surface Activation', copy: 'Uniform activation for adhesion, bonding, and coating preparation across a full load.' },
      { title: 'Etching And Descum', copy: 'Configurable electrodes and MFC gas for controlled etch and residue removal.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'PLUTO-30 configuration window',
    copy:
      'Representative PLUTO-30 configuration transcribed from the equipment summary. Confirm electrode, MFC, and gas configuration during quote review.',
    testId: 'pluto-30-specifications',
    items: [
      { label: 'Chamber', value: '30 L, 300 x 280 x 366 mm' },
      { label: 'Sample Shelves', value: 'Up to 7 adjustable' },
      { label: 'Electrode Gap', value: '30 mm' },
      { label: 'Electrodes', value: 'Power 226 x 210, ground 260 x 210 mm' },
      { label: 'RF Power', value: '500 W, 13.56 MHz auto-match' },
      { label: 'Gas Control', value: '1 MFC standard, up to 4' },
      { label: 'Control', value: '7 in touchscreen, recipe storage' },
      { label: 'Vacuum', value: 'Oil pump, 32 m3/h' },
      { label: 'System Size', value: '706 x 804 x 735 mm' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where PLUTO-30 fits',
    items: [
      'Batch plasma cleaning',
      'Surface activation',
      'Plasma etching',
      'Adhesion and bonding preparation',
      'Pilot production',
      'Core facility workflows',
    ],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Actual PLUTO-30 system photos: the open chamber with adjustable shelves, the complete floor-standing unit, an installed cleanroom scene, and chamber dimensions.',
    images: [
      { src: pluto30ClosedImage, alt: 'PLUTO-30 complete floor-standing plasma system', label: 'Complete system', width: 908, height: 1000 },
      { src: pluto30LabImage, alt: 'PLUTO-30 installed and running in a cleanroom', label: 'In use', width: 800, height: 1000 },
      { src: pluto30DimensionsImage, alt: 'PLUTO-30 chamber interior dimensions', label: 'Chamber dimensions', width: 1000, height: 878 },
    ],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Related Resources',
    items: [
      { title: 'What Is a Plasma Cleaner?', href: '/insights/what-is-plasma-cleaner-principles-types', meta: 'Principles, types, and how plasma cleaning works' },
      { title: 'Plasma Cleaner Buying Guide', href: '/insights/plasma-cleaner-buying-guide', meta: 'Selection guide for chamber size, vacuum systems, and TCO' },
      { title: 'PLUTO vs HY Comparison', href: '/insights/pluto-vs-hy-plasma-cleaner-comparison', meta: 'Architecture, power density, and cost-of-ownership comparison' },
    ],
  },
  finalCta: {
    eyebrow: 'Request a Quote',
    title: 'Scale plasma processing to batch and pilot production with PLUTO-30.',
    copy: 'Share your samples, throughput, and gas chemistry for an application-matched configuration.',
    primaryAction: { label: 'Start PLUTO-30 Quote', href: '/request-quote?products=pluto-30' },
    secondaryAction: { label: 'Talk to Process Engineering', href: '/contact?topic=expert&product=pluto-30' },
    backgroundImage: productImage,
  },
};
