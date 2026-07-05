import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = 'https://cdn.ninescrolls.com/products/compact-rie/main.jpg';

export const compactRieConfig: ProductDetailConfig = {
  slug: 'compact-rie',
  seo: {
    title: 'Compact Benchtop RIE Etcher (SV-RIE)',
    description:
      'Space-efficient SV-RIE reactive ion etching platform for research labs, failure analysis, photoresist removal, polymer etching, and rapid prototyping. Supports 4-12 inch wafers, 300-1000 W RF power, and a 630mm x 600mm footprint.',
    keywords:
      'Compact RIE, SV-RIE, compact reactive ion etching, small footprint RIE, research RIE system, failure analysis etcher, photoresist removal',
  },
  schema: {
    name: 'Compact Benchtop RIE Etcher (SV-RIE)',
    description:
      'Space-efficient SV-RIE reactive ion etching platform for research labs, failure analysis, photoresist removal, polymer etching, and rapid R&D prototyping.',
    sku: 'compact-rie',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What makes the Compact RIE different from a standard RIE system?',
      answer:
        'The Compact RIE (SV-RIE) is designed around a 630mm x 600mm footprint, roughly 50% smaller than a standard RIE configuration, while preserving true reactive ion etching capability for research and failure analysis workflows.',
    },
    {
      question: 'What materials can the Compact RIE process?',
      answer:
        'The Compact RIE supports silicon, silicon dioxide, silicon nitride, silicon carbide, photoresist, PMMA, organic polymers, and compound semiconductor process stacks used in R&D and lab-scale prototyping.',
    },
    {
      question: 'Which RF power options are available?',
      answer:
        'The SV-RIE family includes SHL100SV-RIE, SHL150SV-RIE, and SHL200SV-RIE configurations, corresponding to 300 W, 500 W, and 1000 W RF power options.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'Compact RIE',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'Compact Benchtop RIE Etcher (SV-RIE)',
    description:
      'A space-efficient SV-RIE platform for labs that need true anisotropic plasma etching capability without the footprint of a full-size RIE system.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls Compact RIE SV-RIE platform',
      width: 1024,
      height: 1024,
    },
    stats: [
      { label: 'Models', value: '300 / 500 / 1000 W' },
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'Footprint', value: '630mm x 600mm' },
      { label: 'Best For', value: 'R&D / FA labs' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=compact-rie',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=compact-rie',
    },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Bring true RIE control into smaller research spaces.',
    copy:
      'Compact RIE selection starts with the materials you need to etch, target anisotropy, available lab footprint, RF power requirement, gas chemistry, and whether the workflow is routine resist removal, failure analysis, or rapid device prototyping.',
    windows: [
      {
        title: 'Space-Constrained Labs',
        copy: 'The SV-RIE format fits RIE capability into a compact footprint for universities, shared labs, and pilot-scale environments.',
        details: ['630mm x 600mm', 'One-piece design', 'Research lab fit'],
      },
      {
        title: 'Polymer And Resist Workflows',
        copy: 'Supports common PR, PMMA, organic polymer, and descum workflows where plasma cleaner capability is not enough.',
        details: ['PR removal', 'PMMA etching', 'O2 plasma workflows'],
      },
      {
        title: 'Failure Analysis And Prototyping',
        copy: 'Useful for package opening, passivation access, and rapid process development where labs need responsive in-house etch access.',
        details: ['Failure analysis', 'Passivation removal', 'Rapid R&D'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this compact platform is built to control.',
    compareAction: {
      label: 'Compare RIE',
      href: '/products/rie-etcher',
    },
    cards: [
      {
        title: 'Footprint efficiency',
        copy: 'The defining constraint is lab space: SV-RIE keeps true reactive ion etching capability visible for teams that cannot allocate a full-size system footprint.',
      },
      {
        title: 'RF power scaling',
        copy: 'Three model options let labs choose 300 W, 500 W, or 1000 W RF power without carrying unnecessary industrial features.',
      },
      {
        title: 'Lab-scale process flexibility',
        copy: 'The platform is positioned for silicon, dielectric, polymer, PR, PMMA, and compound semiconductor process stacks in R&D settings.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for Compact RIE process planning.',
    copy:
      'Core values are taken from the equipment summary and legacy page for fast process screening. Final gas manifold, pump, wafer handling, and model configuration should be confirmed with engineering during quote review.',
    testId: 'compact-rie-specifications',
    items: [
      { label: 'Models', value: 'SHL100SV-RIE / SHL150SV-RIE / SHL200SV-RIE' },
      { label: 'Wafer Size', value: '4-12 in' },
      { label: 'RF Power', value: '300-1000 W' },
      { label: 'Frequency', value: '13.56 MHz' },
      { label: 'Footprint', value: '630mm x 600mm' },
      { label: 'Materials', value: 'Si, SiO2, SiNx, SiC, PR, PMMA, compound semiconductors' },
      { label: 'Process Gases', value: 'Up to 5 gas lines' },
      { label: 'Pump System', value: 'Mechanical pump standard / optional turbo pump' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for compact R&D etch workflows.',
    items: [
      'Space-constrained research labs',
      'Failure analysis',
      'Photoresist removal',
      'Polymer descum',
      'Passivation layer removal',
      'Rapid device prototyping',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right compact etch path.',
    items: [
      {
        title: 'Reactive Ion Etching Guide',
        href: '/insights/reactive-ion-etching-guide',
        meta: 'RIE principles, process control, and equipment selection',
      },
      {
        title: 'Semiconductor Etchers Overview',
        href: '/insights/semiconductor-etchers-overview',
        meta: 'How to choose RIE, ICP-RIE, DRIE, IBE, and compact etch platforms',
      },
      {
        title: 'PE vs RIE vs ICP-RIE',
        href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
        meta: 'Plasma mode comparison for process and equipment planning',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Fit a true RIE process window into your lab',
    copy: 'Share your target films, wafer size, process gases, RF power needs, available footprint, and timeline.',
    primaryAction: {
      label: 'Start Compact RIE Quote',
      href: '/request-quote?products=compact-rie',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=compact-rie',
    },
    backgroundImage: productImage,
  },
};
