import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/striper-standardized.webp';

export const striperSystemConfig: ProductDetailConfig = {
  slug: 'striper',
  seo: {
    title: 'Plasma Photoresist Stripping Platform',
    description:
      'Plasma photoresist stripping and ashing platform for PR removal, PMMA and polymer stripping, post-etch residue cleaning, surface activation, and damage-sensitive cleaning. Supports 4-12 inch wafers, 300-1000 W RF power, 5 to 200 C temperature control, automated endpoint detection, and an approx. 0.8m x 0.8m footprint.',
    keywords:
      'plasma stripper, photoresist stripping, resist ashing, plasma ashing, post-etch residue cleaning, semiconductor stripping equipment, oxygen plasma strip',
  },
  schema: {
    name: 'Plasma Photoresist Stripping Platform',
    description:
      'Plasma stripping and ashing platform for photoresist removal, organic residue cleaning, surface activation, and damage-sensitive semiconductor process workflows.',
    sku: 'striper',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'When should I choose a dedicated plasma striper instead of a plasma cleaner?',
      answer:
        'Choose a dedicated plasma striper when resist removal, ashing, post-etch residue cleaning, endpoint detection, wafer-scale uniformity, and controlled temperature are the core process requirements. A plasma cleaner is better for lower-power surface activation, bonding preparation, and general sample cleaning.',
    },
    {
      question: 'What materials can the Striper process?',
      answer:
        'The Striper is positioned for organic materials including PR, PMMA, PS nanospheres, polymer residue, 2D material process residues, and organic contamination removal.',
    },
    {
      question: 'What core specifications define the Striper platform?',
      answer:
        'The Striper supports 4 inch to 12 inch wafers, 300 to 1000 W RF power, 5 to 200 C temperature control, automated endpoint detection, and an approx. 0.8m x 0.8m compact footprint.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'Striper',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'Plasma Photoresist Stripping Platform',
    description:
      'Dedicated plasma stripping and ashing for photoresist removal, post-etch residue cleaning, organic contamination removal, and damage-sensitive semiconductor process flows.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls plasma photoresist stripping system',
      width: 1400,
      height: 1400,
    },
    stats: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '300-1000 W' },
      { label: 'Temperature', value: '5 to 200 C' },
      { label: 'Endpoint', value: 'Automated' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=striper',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=striper',
    },
  },
  datasheet: {
    fileUrl: '/docs/striper-system-datasheet.pdf',
    fileName: 'NineScrolls-Stripping-System-Datasheet.pdf',
    title: 'Download Stripping System Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Tune the strip process around resist chemistry, residue type, and damage budget.',
    copy:
      'Striper selection starts with resist thickness, hard-bake history, wafer size, temperature limit, endpoint strategy, residue type, target gas chemistry, and whether the process must protect low-k, Cu, III-V, MEMS, or 2D material stacks.',
    windows: [
      {
        title: 'Photoresist Stripping',
        copy: 'Oxygen plasma chemistry removes PR and organic films through controlled ashing while reducing wet-strip chemical burden.',
        details: ['PR removal', 'Resist ash', 'Descum'],
      },
      {
        title: 'Post-Etch Residue',
        copy: 'Process windows can target polymer sidewall residue, organic contamination, and post-patterning clean-up after dry etch steps.',
        details: ['Polymer residue', 'Organic films', 'Post-etch clean'],
      },
      {
        title: 'Damage-Sensitive Cleaning',
        copy: 'Temperature, ion exposure, and gas chemistry selection matter when cleaning low-k, Cu, III-V, MEMS, and 2D material stacks.',
        details: ['Low damage', 'Endpoint control', 'Sensitive stacks'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare Plasma Cleaners',
      href: '/products/plasma-cleaner',
    },
    cards: [
      {
        title: 'Strip rate and temperature',
        copy: 'RF power and 5 to 200 C wafer-stage control help engineers balance strip rate, residue removal, and thermal budget for resist and polymer workflows.',
      },
      {
        title: 'Endpoint and repeatability',
        copy: 'Automated endpoint detection and repeatable process recipes support cleaner handoff from lithography and etch into deposition, metrology, or bonding steps.',
      },
      {
        title: 'Gas chemistry selection',
        copy: 'O2, O2/CF4, O2/N2, H2/N2, forming gas, and Ar/O2 decisions depend on resist condition, residue chemistry, and underlying material sensitivity.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for plasma stripping process planning.',
    copy:
      'Core values are taken from the equipment summary, legacy page, and stripping equipment guide for fast process screening. Final gas manifold, vacuum, wafer handling, endpoint, and temperature options should be confirmed with engineering during quote review.',
    testId: 'striper-specifications',
    items: [
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '300-1000 W' },
      { label: 'Temperature', value: '5 to 200 C' },
      { label: 'Endpoint Detection', value: 'Automated' },
      { label: 'Footprint', value: 'Approx. 0.8m x 0.8m' },
      { label: 'Gas System', value: '2 lines standard / expandable' },
      { label: 'Vacuum System', value: 'Mechanical pump' },
      { label: 'Materials', value: 'PR, PMMA, PS nanospheres, 2D materials, organic contaminants' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for resist strip, ashing, and residue-cleaning workflows.',
    items: [
      'Photoresist stripping',
      'Plasma ashing',
      'Post-etch residue cleaning',
      'Organic contamination removal',
      'Surface activation and descum',
      '2D material residue cleaning',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right stripping and cleaning path.',
    items: [
      {
        title: 'Plasma Stripping & Ashing Guide',
        href: '/insights/plasma-stripping-ashing-guide',
        meta: 'O2 plasma chemistry, downstream vs direct plasma, gas selection, endpoint detection, and equipment selection',
      },
      {
        title: 'Stripping Equipment Selection Guide',
        href: '/insights/plasma-stripping-equipment-selection-guide',
        meta: 'Barrel, downstream, and RIE-mode architectures, temperature effects, endpoint methods, and striper vs plasma cleaner decisions',
      },
      {
        title: 'Post-Etch Cleaning & Residue Removal',
        href: '/insights/post-etch-cleaning-residue-removal',
        meta: 'Residue types, dry and wet cleaning methods, in-situ vs ex-situ tradeoffs, and damage-free cleaning strategies',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build a cleaner strip process window with NineScrolls',
    copy: 'Share your resist type, wafer size, residue source, underlying materials, temperature limit, gas chemistry, endpoint needs, and timeline.',
    primaryAction: {
      label: 'Start Striper Quote',
      href: '/request-quote?products=striper',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=striper',
    },
    backgroundImage: productImage,
  },
};
