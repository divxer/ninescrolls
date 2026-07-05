import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = 'https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg';

export const hy4lConfig: ProductDetailConfig = {
  slug: 'hy-4l',
  seo: {
    title: 'HY-4L Compact Plasma Cleaner',
    description:
      'Compact HY-4L plasma cleaner for teaching labs, small research groups, surface activation, bonding preparation, and process development. Available in RF 150W or mid-frequency 300W configurations with a ~4L chamber.',
    keywords:
      'HY-4L plasma cleaner, compact plasma cleaner, RF plasma cleaner, mid-frequency plasma cleaner, surface activation, bonding preparation, teaching lab plasma cleaner',
  },
  schema: {
    name: 'HY-4L Compact Plasma Cleaner',
    description:
      'Compact ~4L plasma cleaner for education, small-lab research, surface activation, bonding preparation, and process development. Available in RF and mid-frequency configurations.',
    sku: 'hy-4l',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'What is the difference between the HY-4L RF and mid-frequency configurations?',
      answer:
        'The HY-4L RF configuration uses 150W at 13.56 MHz for higher-density RF plasma work, while the mid-frequency configuration uses 300W at 40 kHz for cost-efficient cleaning and activation workflows.',
    },
    {
      question: 'Who is the HY-4L designed for?',
      answer:
        'HY-4L is designed for teaching labs, compact research groups, materials labs, and process-development teams that need a small plasma cleaner for surface activation, bonding preparation, and routine sample preparation.',
    },
    {
      question: 'When should I move from HY-4L to a 20L plasma cleaner?',
      answer:
        'Move to HY-20L or HY-20LRF when your workflow needs larger batch volume, more repeatable multi-sample processing, or documented RF batch capability beyond the HY-4L compact chamber.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Plasma Cleaners',
    parentHref: '/products/plasma-cleaner',
    current: 'HY-4L',
  },
  hero: {
    eyebrow: 'Plasma Cleaner',
    title: 'HY-4L Compact Plasma Cleaner',
    description:
      'A compact RF or mid-frequency plasma cleaner for labs that need practical surface activation, bonding preparation, and sample cleaning without stepping into a larger batch platform.',
    image: {
      src: productImage,
      alt: 'NineScrolls HY-4L compact plasma cleaner',
      width: 1024,
      height: 666,
    },
    stats: [
      { label: 'Chamber', value: '~4L' },
      { label: 'RF Option', value: '150W / 13.56 MHz' },
      { label: 'MF Option', value: '300W / 40 kHz' },
      { label: 'Price', value: '$6,499-$7,999' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=hy-4l',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=hy-4l',
    },
  },
  datasheet: {
    fileUrl: '/NineScrolls-Equipment-Guide.pdf',
    fileName: 'NineScrolls-Equipment-Guide.pdf',
    title: 'Download Equipment Guide',
    buttonLabel: 'Download Guide',
  },
  processIntro: {
    eyebrow: 'Cleaner-family positioning',
    title: 'Start with chamber size, plasma source, and repeatability needs.',
    copy:
      'HY-4L is the compact entry point in the cleaner family. It is best evaluated by sample size, required plasma source, gas access, available bench space, and whether the work is exploratory cleaning, bonding preparation, or teaching-lab process development.',
    windows: [
      {
        title: 'Compact Lab Entry',
        copy: 'A ~4L chamber keeps the footprint practical for teaching labs, shared research benches, and early process development.',
        details: ['~4L chamber', 'Compact footprint', 'Entry research'],
      },
      {
        title: 'RF Or Mid-Frequency',
        copy: 'Choose RF when the process benefits from 13.56 MHz plasma behavior, or mid-frequency when cost-efficient routine cleaning is the priority.',
        details: ['150W RF', '300W MF', '2 gas channels'],
      },
      {
        title: 'Surface Preparation',
        copy: 'Best suited for cleaning, activation, wettability adjustment, and bonding preparation where a compact plasma cleaner is enough.',
        details: ['Surface activation', 'Bonding prep', 'Sample cleaning'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Selection Windows',
    title: 'Where HY-4L fits inside the cleaner lineup.',
    compareAction: {
      label: 'Compare Plasma Cleaners',
      href: '/products/plasma-cleaner/compare',
    },
    cards: [
      {
        title: 'Entry compact work',
        copy: 'HY-4L owns the compact, education, and early research segment rather than competing with higher-throughput batch plasma cleaners.',
      },
      {
        title: 'RF versus MF choice',
        copy: 'The page keeps RF and mid-frequency options together so labs can compare source behavior without splitting authority across duplicate pages.',
      },
      {
        title: 'Upgrade path clarity',
        copy: 'HY-20L and HY-20LRF remain the next step for larger volume, batch processing, and repeatable research workflows.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Verified HY-4L screening values.',
    copy:
      'The values below come from the published equipment summary. Final pump configuration, gas hardware, and RF/MF selection should be confirmed during quote review.',
    testId: 'hy-4l-specifications',
    items: [
      { label: 'Price', value: 'RF $7,999 / MF $6,499' },
      { label: 'Chamber', value: '~4L' },
      { label: 'RF Power', value: '150W @ 13.56 MHz' },
      { label: 'MF Power', value: '300W @ 40 kHz' },
      { label: 'Gas Channels', value: '2 channels' },
      { label: 'Control', value: 'PLC + touchscreen' },
      { label: 'Best For', value: 'Compact cleaning, activation, education, process development' },
      { label: 'Series Role', value: 'Compact HY entry platform' },
    ],
  },
  gallery: {
    eyebrow: 'Product Views',
    heading: 'HY-4L Product Views',
    copy:
      'Use these supplier-provided views to review the compact enclosure, service-side access, chamber placement, and bench integration before configuration review.',
    images: [
      {
        src: productImage,
        alt: 'HY-4L compact plasma cleaner front three-quarter product view',
        label: 'Front view',
        width: 1024,
        height: 666,
      },
      {
        src: 'https://cdn.ninescrolls.com/products/ns-plasma-4r/image-1.jpg',
        alt: 'HY-4L compact plasma cleaner angled side product view',
        label: 'Side view',
        width: 1024,
        height: 741,
      },
      {
        src: 'https://cdn.ninescrolls.com/products/ns-plasma-4r/image-2.jpg',
        alt: 'HY-4L compact plasma cleaner rear service-side product view',
        label: 'Rear service view',
        width: 1024,
        height: 796,
      },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Compact plasma cleaning and activation workflows.',
    items: [
      'Teaching lab demonstrations',
      'Surface activation before bonding',
      'PDMS and polymer surface treatment',
      'Glass and silicon sample cleaning',
      'Small-batch wettability control',
      'Early process development',
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help labs choose the right cleaner configuration.',
    items: [
      {
        title: 'What Is a Plasma Cleaner?',
        href: '/insights/what-is-plasma-cleaner-principles-types',
        meta: 'Plasma cleaning mechanisms, source types, and surface activation basics',
      },
      {
        title: 'Plasma Cleaner Buying Guide',
        href: '/insights/plasma-cleaner-buying-guide',
        meta: 'How to choose chamber size, source type, vacuum options, and total cost',
      },
      {
        title: 'PLUTO vs HY Plasma Cleaners',
        href: '/insights/pluto-vs-hy-plasma-cleaner-comparison',
        meta: 'Series-level comparison across HY and PLUTO cleaner platforms',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Configure HY-4L',
    title: 'Choose the compact cleaner configuration that fits your lab',
    copy: 'Share your sample size, surface goal, preferred gases, RF or mid-frequency preference, pump requirements, and timeline.',
    primaryAction: {
      label: 'Start HY-4L Quote',
      href: '/request-quote?products=hy-4l',
    },
    secondaryAction: {
      label: 'Talk to Cleaner Specialist',
      href: '/contact?topic=expert&product=hy-4l',
    },
    backgroundImage: productImage,
  },
};
