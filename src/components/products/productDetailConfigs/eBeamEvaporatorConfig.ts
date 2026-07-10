import type { ProductDetailConfig } from '../ProductDetailPage.types';

const productImage = '/assets/images/redesign/products/e-beam-standardized.webp';

export const eBeamEvaporatorConfig: ProductDetailConfig = {
  slug: 'e-beam-evaporator',
  seo: {
    title: 'MEB-600 E-Beam Evaporation Platform',
    description:
      'MEB-600 multi-source e-beam and thermal evaporation platform for IR sensors, photonic crystals, optical multilayers, lift-off metallization, and quantum device thin films. Supports a Φ6 in x1 flat substrate holder, 6-pocket 17 cc e-gun crucible, ≤±5% uniformity within Φ6 in, in-situ QCM endpoint detection, 6.7×10⁻⁵ Pa ultimate vacuum, and manual, semi-auto, or full-auto modes.',
    keywords:
      'e-beam evaporator, MEB-600, electron beam evaporation, thermal evaporator, PVD evaporation, QCM thickness monitor, optical multilayers, lift-off metallization',
  },
  schema: {
    name: 'MEB-600 E-Beam Evaporation Platform',
    description:
      'Multi-source e-beam and thermal evaporation platform for high-purity PVD thin films, optical coatings, IR sensors, photonic crystals, and lift-off metallization.',
    sku: 'meb-600',
    category: 'Semiconductor Manufacturing Equipment',
  },
  faq: [
    {
      question: 'When should I choose e-beam evaporation instead of sputtering?',
      answer:
        'Choose e-beam evaporation for high-purity directional deposition, lift-off metallization, optical multilayers, and refractory or IR-active source materials. Choose sputtering when compound film stoichiometry, magnetic films, or broader step coverage are the primary drivers.',
    },
    {
      question: 'What makes the MEB-600 a multi-source platform?',
      answer:
        'The MEB-600 combines e-beam evaporation and thermal-resistance evaporation in one high-vacuum chamber. The e-gun uses a 6-pocket, 17 cc-per-pocket crucible, allowing sequential materials without breaking vacuum.',
    },
    {
      question: 'What core specifications define the MEB-600?',
      answer:
        'The MEB-600 supports a Φ6 in x1 flat substrate holder, a 6-pocket 17 cc e-gun crucible, ≤±5% uniformity within Φ6 in, in-situ QCM endpoint detection, 6.7×10⁻⁵ Pa ultimate vacuum, and manual, semi-auto, or full-auto modes.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'E-Beam Evaporator',
  },
  hero: {
    eyebrow: 'Equipment Platform',
    title: 'MEB-600 E-Beam Evaporation Platform',
    description:
      'Multi-source e-beam and thermal evaporation for infrared sensors, photonic crystals, optical multilayers, lift-off metallization, and research-grade PVD thin films.',
    backgroundImage: '/assets/images/redesign/hero-home-plasma-process.webp',
    image: {
      src: productImage,
      alt: 'NineScrolls MEB-600 e-beam evaporation platform',
      width: 1400,
      height: 1295,
    },
    stats: [
      { label: 'Substrate', value: 'Φ6 in x1 flat' },
      { label: 'Crucible', value: '6x17 cc' },
      { label: 'Uniformity', value: '≤±5% @ Φ6 in' },
      { label: 'Vacuum', value: '6.7×10⁻⁵ Pa' },
    ],
    primaryAction: {
      label: 'Request Quote',
      href: '/request-quote?products=e-beam-evaporator',
    },
    secondaryAction: {
      label: 'Talk to an Engineer',
      href: '/contact?topic=expert&product=e-beam-evaporator',
    },
  },
  datasheet: {
    fileUrl: '/docs/e-beam-evaporator-datasheet.pdf',
    fileName: 'NineScrolls-MEB-600-Spec-Sheet.pdf',
    title: 'Download MEB-600 Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Process-first configuration',
    title: 'Build the PVD stack around source material, purity, and directional deposition.',
    copy:
      'E-beam evaporator selection starts with source material volatility, melting point, target film purity, lift-off profile, QCM control requirements, substrate fixture, multilayer sequencing, and whether low-melting layers need thermal evaporation in the same chamber.',
    windows: [
      {
        title: 'High-Purity E-Beam Films',
        copy: 'Localized e-beam heating supports refractory metals, oxides, fluorides, and IR-active materials while keeping the crucible water-cooled.',
        details: ['10 kW e-gun', '6-pocket crucible', 'High purity'],
      },
      {
        title: 'Thermal Evaporation',
        copy: 'Integrated thermal-resistance evaporation supports low-melting metals and organic small molecules without moving to a second tool.',
        details: ['3 kW thermal', 'Low-melt metals', 'Organics'],
      },
      {
        title: 'Optical and IR Stacks',
        copy: 'QCM endpoint control and multi-pocket sequencing support IR sensors, Ge/ZnS photonic crystals, AR coatings, and multilayer PVD stacks.',
        details: ['QCM endpoint', 'IR materials', 'Multilayers'],
      },
    ],
  },
  coreWindows: {
    eyebrow: 'Core Process Windows',
    title: 'What this platform is built to control.',
    compareAction: {
      label: 'Compare Sputtering',
      href: '/products/sputter',
    },
    cards: [
      {
        title: 'Source and material selection',
        copy: 'E-beam and thermal sources in one chamber let labs mix refractory, optical, low-melting, and organic materials in a single PVD workflow.',
      },
      {
        title: 'Thickness and endpoint control',
        copy: 'In-situ quartz-crystal monitoring supports rate and thickness control for optical stacks, sacrificial layers, and device metallization.',
      },
      {
        title: 'Directional lift-off deposition',
        copy: 'Line-of-sight evaporation is well suited to lift-off metallization, MEMS contacts, optoelectronic devices, and quantum hardware layers.',
      },
    ],
  },
  specifications: {
    eyebrow: 'Technical Specifications',
    title: 'Clear screening values for MEB-600 process planning.',
    copy:
      'Core values are taken from the MEB-600 technical specification for fast process screening. Final fixture, crucible, pump, monitor, and automation options should be confirmed with engineering during quote review.',
    testId: 'e-beam-specifications',
    items: [
      { label: 'Substrate', value: 'Φ6 in x1 flat substrate holder' },
      { label: 'E-Gun Crucible', value: '6 pockets, 17 cc each' },
      { label: 'Uniformity', value: '≤±5% within Φ6 in' },
      { label: 'Thickness Control', value: 'In-situ QCM endpoint' },
      { label: 'Vacuum', value: '6.7×10⁻⁵ Pa ultimate vacuum' },
      { label: 'Modes', value: 'Manual / semi-auto / full-auto' },
      { label: 'Sources', value: 'E-beam + thermal resistance' },
      { label: 'Materials', value: 'Metals, oxides, fluorides, IR films' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Built for high-purity PVD films and optical device stacks.',
    items: [
      'Infrared image sensors',
      'Ge/ZnS photonic crystals',
      'UV down-conversion films',
      'Optical AR coatings',
      'Lift-off metallization',
      'Quantum device thin films',
    ],
  },
  research: {
    eyebrow: 'Research Validation',
    title: 'Verified in peer-reviewed evaporation research.',
    cards: [
      {
        eyebrow: 'ACS Applied Materials & Interfaces',
        title: 'Dimension-Confined Growth of a Crack-Free PbS Microplate Array',
        meta: 'Wan et al., 2024. Infrared image sensing work using MEB-600 evaporation for PbS/MgO process layers.',
      },
      {
        eyebrow: 'Journal of Infrared and Millimeter Waves',
        title: 'Coronene Enhanced CMOS Image Sensor',
        meta: 'Luo et al., 2023. UV down-conversion film work involving thermal evaporation on CMOS image sensor surfaces.',
      },
      {
        eyebrow: 'Basic Sciences Journal of Textile Universities',
        title: 'Ge/ZnS Photonic Crystal Infrared-Wave Transmitting Properties',
        meta: 'Su et al., 2025. Photonic crystal fabrication using Ge/ZnS evaporation for infrared optical stacks.',
      },
    ],
  },
  resources: {
    eyebrow: 'Related Resources',
    title: 'Help engineers choose the right PVD and pattern-transfer path.',
    items: [
      {
        title: 'E-Beam vs Thermal vs Sputter',
        href: '/insights/e-beam-vs-thermal-vs-sputter-pvd-system-selection',
        meta: 'PVD technique selection across evaporation, thermal, and sputtering workflows',
      },
      {
        title: 'Hard Mask Processing',
        href: '/insights/hard-mask-processing-materials-integration-and-pattern-transfer-strategies',
        meta: 'Mask materials, evaporation, deposition choices, and pattern-transfer integration',
      },
      {
        title: 'Quantum Device Fabrication',
        href: '/insights/quantum-device-micro-nanofabrication-guide',
        meta: 'Thin-film deposition, lift-off, and quantum hardware process integration',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Request a quote',
    title: 'Build your next evaporation stack with NineScrolls',
    copy: 'Share your source materials, substrate size, desired film thickness, QCM requirements, multilayer sequence, lift-off constraints, and timeline.',
    primaryAction: {
      label: 'Start E-Beam Quote',
      href: '/request-quote?products=e-beam-evaporator',
    },
    secondaryAction: {
      label: 'Talk to Process Engineering',
      href: '/contact?topic=expert&product=e-beam-evaporator',
    },
    backgroundImage: productImage,
  },
};
