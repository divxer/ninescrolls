import type { ProductRecord, ManufacturerRecord, CategoryRecord, ProductVariant } from '../types';

const tyloong: ManufacturerRecord = {
  id: 'tyloong',
  slug: 'beijing-tailong',
  name: 'Beijing Tailong Electronic Technology (Tyloong)',
  description: '30+ years of semiconductor equipment experience with 1000+ systems installed globally.',
  highlights: [
    'Industry-leading R&D capabilities',
    'Global technical support network',
    'Proven track record in semiconductor manufacturing',
    'Comprehensive training and documentation',
    'Customizable solutions for specific research needs'
  ],
  supportPolicy: 'US-based coordination with global manufacturing support.',
};

export const seedManufacturers: ManufacturerRecord[] = [tyloong];

export const seedCategories: CategoryRecord[] = [
  { id: 'etching', name: 'Etching' },
  { id: 'deposition', name: 'Deposition' },
  { id: 'coating', name: 'Coating/Developing' },
  { id: 'cleaning', name: 'Cleaning/Stripping' },
];

const nsPlasma4rVariants: ProductVariant[] = [
  {
    id: 'ns-plasma-4r-mf',
    label: 'Mid-Frequency (40 kHz)',
    name: 'NS-Plasma 4R - Mid-Frequency Plasma Cleaner',
    price: 6499,
    description: 'Robust, cost-effective for routine cleaning and activation',
    isDefault: true,
  },
  {
    id: 'ns-plasma-4r-rf',
    label: 'RF (13.56 MHz)',
    name: 'NS-Plasma 4R - RF Plasma Cleaner',
    price: 7999,
    description: 'Finer control for advanced surface modification',
  },
];

const nsPlasma20rVariants: ProductVariant[] = [
  {
    id: 'ns-plasma-20r-mf',
    label: 'Mid-Frequency (40 kHz)',
    name: 'NS-Plasma 20R - Mid-Frequency Plasma System',
    price: 11999,
    description: 'Best value for routine batch processing',
    isDefault: true,
  },
  {
    id: 'ns-plasma-20r-rf',
    label: 'RF (13.56 MHz)',
    name: 'NS-Plasma 20R - RF Plasma System',
    price: 14999,
    description: 'Finer process control and broader recipe window',
  },
];

export const seedProducts: ProductRecord[] = [
  {
    id: 'icp-etcher',
    slug: 'icp-etcher',
    name: 'ICP Etcher Series',
    category: 'Etching',
    typeTag: 'ICP-RIE',
    shortDesc: 'Advanced inductively coupled plasma etching system with superior process control and optimized etch rates.',
    heroSubtitle: 'High-density plasma etching for advanced research and process development',
    bullets: [
      'Independent control of ion density and ion energy',
      'High aspect-ratio etching with strong anisotropy',
      'Research-grade uniformity on 4-8 inch wafers'
    ],
    schematicImage: '/assets/images/products/icp-etcher/icp-system-schematic.webp',
    schematicCaption: 'System components include plasma coil, gas inlet, RF power, helium cooling, and vacuum exhaust paths.',
    features: [
      'High-density plasma source',
      'Multi-gas capability',
      'Advanced temperature control'
    ],
    specifications: [
      'Process chamber size: 12" standard',
      'Base pressure: < 5x10-7 Torr',
      'ICP power: 2000W standard',
      'Bias power: 600W standard'
    ],
    images: ['/assets/images/products/icp-etcher/main.jpg'],
    thumbnail: '/assets/images/products/icp-etcher/main.jpg',
    applications: [
      'Compound semiconductor research',
      'Hard dielectric etching',
      'High aspect-ratio features'
    ],
    processResults: [
      'Stable plasma ignition across common fluorine and chlorine chemistries',
      'High selectivity with tunable bias and pressure',
      'Consistent profiles for deep etch research'
    ],
    useCases: [
      'MEMS structures and HAR features',
      'R&D pilot lines for process development',
      'University lab research with advanced plasma control'
    ],
    resultsHighlights: [
      'Independent density and ion energy control',
      'Repeatable etch profiles across wafer sizes',
      'Optimized for research-grade throughput'
    ],
    keyCharacteristics: [
      'Independent density and ion energy control',
      'Stable plasma repeatability across wafer sizes',
      'Optimized for research-grade throughput'
    ],
    supportIntegration: [
      'US-based configuration consults and project kickoff',
      'Remote process onboarding for lab teams',
      'Service coordination and parts logistics support'
    ],
    deliveryAndService: 'US-based project coordination with installation and process onboarding support.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'rie-etcher',
    slug: 'rie-etcher',
    name: 'RIE Etcher Series',
    category: 'Etching',
    typeTag: 'RIE',
    shortDesc: 'Versatile reactive ion etching system for precise material processing with controlled etch rates.',
    heroSubtitle: 'Directional plasma etching for research labs and process development',
    bullets: [
      'Reliable anisotropic etching with stable process control',
      'Flexible gas chemistry support for multiple materials',
      'Compact footprint for lab-scale deployment'
    ],
    features: [
      'Flexible process control',
      'Multiple gas options',
      'Compact design'
    ],
    specifications: [
      'Process chamber size: 8" standard (12" available)',
      'Base pressure: < 1x10-6 Torr',
      'RF power: 600W standard (1000W optional)',
      'Process gases: Up to 4 MFCs standard'
    ],
    images: ['/assets/images/products/rie-etcher/main.jpg'],
    thumbnail: '/assets/images/products/rie-etcher/main.jpg',
    applications: [
      'Silicon and dielectric etching',
      'MEMS fabrication',
      'Process optimization and teaching labs'
    ],
    deliveryAndService: 'US-based configuration guidance with remote process consultation.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'compact-rie',
    slug: 'compact-rie',
    name: 'Compact RIE Etcher (SV-RIE)',
    category: 'Etching',
    typeTag: 'Compact',
    shortDesc: 'Ultra-compact reactive ion etching system ideal for research labs and pilot-scale processes.',
    heroSubtitle: 'Small footprint RIE for universities and startup labs',
    bullets: [
      '630mm x 600mm ultra-compact footprint',
      'Touchscreen control with automated recipes',
      'Modular design for easy maintenance'
    ],
    features: [
      'Ultra-compact footprint: 630mm x 600mm',
      'Touchscreen control with automated operation',
      'Modular design for easy maintenance'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" (customizable)',
      'RF Power: 300W / 500W / 1000W (customizable)',
      'Process Gases: Up to 5 gas lines simultaneously',
      'Pump: Mechanical pump / optional turbo pump'
    ],
    images: ['/assets/images/products/compact-rie/main.jpg'],
    thumbnail: '/assets/images/products/compact-rie/main.jpg',
    applications: [
      'Pilot-scale RIE processing',
      'Failure analysis and lab prototyping',
      'Teaching lab demonstrations'
    ],
    deliveryAndService: 'US-based coordination with installation planning and training.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'hdp-cvd',
    slug: 'hdp-cvd',
    name: 'HDP-CVD System Series',
    category: 'Deposition',
    typeTag: 'HDP-CVD',
    shortDesc: 'High-density plasma CVD for superior film quality and gap-fill performance.',
    heroSubtitle: 'High-density plasma CVD for research and pilot production',
    bullets: [
      'Strong gap-fill performance with tunable parameters',
      'High deposition rates with stable plasma control',
      'Multi-zone heating for uniform films'
    ],
    features: [
      'Excellent gap-fill capability',
      'High deposition rates',
      'Multi-zone heating'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF Power: Source 1000-3000W, Bias 300-1000W',
      'Process Temperature: 20 degC to 200 degC',
      'Film Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/hdp-cvd/main.jpg'],
    thumbnail: '/assets/images/products/hdp-cvd/main.jpg',
    applications: [
      'Dielectric film deposition',
      'Gap-fill for advanced structures',
      'Process development'
    ],
    deliveryAndService: 'US-based pre-sales evaluation and configuration planning.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'pecvd',
    slug: 'pecvd',
    name: 'PECVD System Series',
    category: 'Deposition',
    typeTag: 'PECVD',
    shortDesc: 'Plasma-enhanced CVD system for high-quality thin film deposition.',
    heroSubtitle: 'Low-temperature PECVD for advanced thin films',
    bullets: [
      'Low-temperature processing for sensitive substrates',
      'Flexible material options with precise control',
      'Compact platform for research labs'
    ],
    features: [
      'Low temperature processing',
      'Multiple material options',
      'Precise control'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF System: 13.56 MHz and/or 400 KHz, 500-2000W',
      'Temperature Range: 20 degC to 400 degC',
      'Film Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/pecvd/main.jpg'],
    thumbnail: '/assets/images/products/pecvd/main.jpg',
    applications: [
      'Thin film deposition',
      'Low-temperature processing',
      'Material research'
    ],
    deliveryAndService: 'US-based configuration guidance and service coordination.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'ald',
    slug: 'ald',
    name: 'ALD System Series',
    category: 'Deposition',
    typeTag: 'ALD',
    shortDesc: 'Atomic layer deposition system for precise thin film growth.',
    heroSubtitle: 'Atomic-level film control for advanced research',
    bullets: [
      'Excellent conformality on high aspect-ratio structures',
      'Compact platform with stable temperature control',
      'Optional remote plasma capability'
    ],
    features: [
      'Atomic-level precision',
      'Excellent conformality',
      'Multiple precursor lines'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or supersize',
      'Temperature Range: 20 degC to 400 degC',
      'Growth Rate: 0.5-2 A per cycle',
      'Film Uniformity: < 1% (Al2O3, edge exclusion)'
    ],
    images: ['/assets/images/products/ald/main.jpg'],
    thumbnail: '/assets/images/products/ald/main.jpg',
    applications: [
      'High aspect-ratio coatings',
      'Barrier and dielectric films',
      'Nanofabrication research'
    ],
    deliveryAndService: 'US-based project coordination with process onboarding support.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'sputter',
    slug: 'sputter',
    name: 'Sputter System Series',
    category: 'Deposition',
    typeTag: 'PVD',
    shortDesc: 'Advanced PVD system for high-quality thin film coating.',
    heroSubtitle: 'Flexible PVD sputtering for research and pilot production',
    bullets: [
      'Multiple target positions with co-sputtering support',
      'DC/RF capability for diverse materials',
      'Precise thickness control'
    ],
    features: [
      'Multiple target positions',
      'DC/RF capability',
      'Co-sputtering option'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'Magnetron Sources: 2-6 independently configurable',
      'Substrate Temperature: Water-cooled to 1200 degC',
      'Film Uniformity: < 1% typical, < 5% guaranteed'
    ],
    images: ['/assets/images/products/sputter/main.jpg'],
    thumbnail: '/assets/images/products/sputter/main.jpg',
    applications: [
      'Metal and dielectric thin films',
      'Optical coatings',
      'Process development'
    ],
    deliveryAndService: 'US-based configuration, shipping, and installation coordination.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'ibe-ribe',
    slug: 'ibe-ribe',
    name: 'IBE/RIBE System Series',
    category: 'Etching',
    typeTag: 'IBE/RIBE',
    shortDesc: 'Ion beam etching system for precise material processing.',
    heroSubtitle: 'Ion beam etching with precise angle control',
    bullets: [
      'Dual mode IBE and RIBE operation',
      'Precise angle control for profile tuning',
      'Stable beam and process repeatability'
    ],
    features: [
      'Dual mode operation',
      'Precise angle control',
      'Multiple gas options'
    ],
    specifications: [
      'Wafer Size: Up to 12" or multi-wafer',
      'Tilt Angle: 0 deg to 90 deg, rotation 1-10 rpm',
      'Base Pressure: < 7x10-7 Torr',
      'Film Non-Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/ibe-ribe/main.jpg'],
    thumbnail: '/assets/images/products/ibe-ribe/main.jpg',
    applications: [
      'Magnetic materials',
      'Hard mask etching',
      'Advanced research processes'
    ],
    deliveryAndService: 'US-based process consultation and installation planning.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'striper',
    slug: 'striper',
    name: 'Striper System Series',
    category: 'Cleaning/Stripping',
    typeTag: 'Stripper',
    shortDesc: 'Advanced photoresist stripping and surface cleaning system.',
    heroSubtitle: 'Photoresist removal and surface cleaning for research labs',
    bullets: [
      'Uniform chamber design for consistent stripping',
      'Adjustable plasma discharge gap',
      'Real-time process monitoring'
    ],
    features: [
      'Uniform chamber center pump-down design',
      'Adjustable plasma discharge gap',
      'Real-time process monitoring'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF Power: 300W to 1000W (customizable)',
      'Stage Temperature: 5 degC to 200 degC',
      'Film Non-Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/striper/main.jpg'],
    thumbnail: '/assets/images/products/striper/main.jpg',
    applications: [
      'Photoresist stripping',
      'Surface cleaning and preparation',
      'Process optimization'
    ],
    deliveryAndService: 'US-based coordination for delivery and service.',
    manufacturerId: tyloong.id,
  },
  {
    id: 'plasma-cleaner',
    slug: 'plasma-cleaner',
    name: 'Plasma Treatment/Cleaner System',
    category: 'Cleaning/Stripping',
    typeTag: 'Plasma Cleaner',
    shortDesc: 'Compact and powerful system for surface cleaning, modification, and activation.',
    heroSubtitle: 'Compact plasma cleaner for research labs and sample prep',
    bullets: [
      '630mm x 600mm footprint for lab benches',
      'Touchscreen control with automated operation',
      'Surface cleaning, modification, and activation'
    ],
    schematicImage: '/assets/images/products/plasma-cleaner/main.jpg',
    schematicCaption: 'Compact chamber layout optimized for fast pump-down and uniform plasma exposure.',
    features: [
      'Compact footprint: 630mm x 600mm',
      'Touchscreen control with automated operation',
      'Flexible processing for multi-wafer batches'
    ],
    options: [
      '4 inch to 6 inch wafer support',
      'Multi-wafer batch configurations',
      'Customized chamber fixtures'
    ],
    applications: [
      'Surface activation for bonding',
      'Removal of organic residues',
      'Surface modification of polymers'
    ],
    processResults: [
      'Improved wettability for bonding and coating',
      'Consistent residue removal with short cycle times',
      'Stable plasma conditions for delicate substrates'
    ],
    useCases: [
      'Sample preparation for microscopy',
      'Surface activation prior to adhesion tests',
      'Routine lab cleaning workflows'
    ],
    resultsHighlights: [
      'Compact footprint for crowded labs',
      'Automated touch interface reduces operator error',
      'Flexible processing for research workflows'
    ],
    keyCharacteristics: [
      'Fast pump-down and repeatable plasma cycles',
      'Touchscreen workflows for ease of use',
      'Flexible fixtures for varied samples'
    ],
    supportIntegration: [
      'US-based support routing and training',
      'Documentation and recipe guidance',
      'Preventive maintenance planning'
    ],
    whoUsesStats: [
      { label: 'Lab footprint', value: '630x600', detail: 'mm footprint' },
      { label: 'Chamber', value: '4 L', detail: 'Compact volume' },
      { label: 'Power', value: 'RF/MF', detail: 'Flexible options' },
      { label: 'Best for', value: 'Teaching', detail: 'Lab-scale workflows' }
    ],
    positioningNote: 'Ideal for teaching labs and small-batch processing that need fast, repeatable plasma treatments.',
    costEffectivePoints: [
      'Compact footprint reduces lab space requirements',
      'Simplified controls lower training overhead',
      'Flexible power options prevent over-buying'
    ],
    expectations: [
      'Guided configuration and onboarding support',
      'Process recipe documentation',
      'Service coordination and parts support'
    ],
    deliveryAndService: 'US-based support routing and maintenance coordination.',
    images: ['/assets/images/products/plasma-cleaner/main.jpg'],
    thumbnail: '/assets/images/products/plasma-cleaner/main.jpg',
    manufacturerId: tyloong.id,
  },
  {
    id: 'ns-plasma-20r',
    slug: 'ns-plasma-20r',
    name: 'NS-Plasma 20R',
    category: 'Cleaning/Stripping',
    typeTag: 'Plasma System',
    shortDesc: 'Compact research-grade plasma system for batch cleaning, ashing, and surface activation.',
    heroSubtitle: 'Compact RF plasma processing system (20 L)',
    bullets: [
      '20 L batch chamber for higher throughput',
      'RF or mid-frequency power options up to 300W',
      'PLC-controlled operation for reproducibility'
    ],
    schematicImage: '/assets/images/products/ns-plasma-20r/main.jpg',
    schematicCaption: 'Compact batch chamber with front access and PLC control for repeatable cleaning workflows.',
    features: [
      '20L stainless steel chamber',
      'RF or mid-frequency power options',
      'PLC-controlled operation'
    ],
    options: [
      'RF (13.56 MHz) or mid-frequency (40 kHz)',
      'Process recipes with PLC control',
      'Custom fixtures for batch processing'
    ],
    applications: [
      'Batch plasma cleaning',
      'Photoresist ashing',
      'Surface activation for bonding'
    ],
    processResults: [
      'Uniform surface activation across batch loads',
      'Repeatable cleaning cycles with PLC recipes',
      'Reduced contamination risk with sealed chamber design'
    ],
    useCases: [
      'University and research lab batch cleaning',
      'Device prep before bonding or coating',
      'Process transfer from R&D to small pilot runs'
    ],
    resultsHighlights: [
      'Up to 20 L batch capacity for higher throughput',
      'Flexible RF or mid-frequency power selection',
      'Documented recipes for repeatable runs'
    ],
    keyCharacteristics: [
      'Batch processing with PLC recipes',
      'RF or mid-frequency power flexibility',
      'Compact footprint with lab-friendly access',
      'Stable plasma generation for repeatable runs'
    ],
    supportIntegration: [
      'US-based configuration consults and project kickoff',
      'Remote process onboarding for lab teams',
      'Service coordination and parts logistics support'
    ],
    whoUsesStats: [
      { label: 'Research labs', value: '100+', detail: 'University and institutional groups' },
      { label: 'Throughput', value: '20 L', detail: 'Batch chamber volume' },
      { label: 'Config options', value: '2', detail: 'RF or mid-frequency' },
      { label: 'Setup time', value: '3-4 wks', detail: 'Typical delivery window' }
    ],
    positioningNote: 'Bridges desktop cleaners and full industrial plasma platforms with research-grade repeatability.',
    costEffectivePoints: [
      'Avoids industrial-only features that labs do not need',
      'Batch processing reduces per-sample cost',
      'Selectable power options align with budget and process needs'
    ],
    expectations: [
      'Configuration guidance within 1-2 business days',
      'Remote onboarding and recipe setup support',
      'Service coordination through US-based team'
    ],
    deliveryAndService: 'US-based coordination with installation planning and onboarding.',
    images: ['/assets/images/products/ns-plasma-20r/main.jpg'],
    thumbnail: '/assets/images/products/ns-plasma-20r/main.jpg',
    variants: nsPlasma20rVariants,
    manufacturerId: tyloong.id,
  },
  {
    id: 'ns-plasma-4r',
    slug: 'ns-plasma-4r',
    name: 'NS-Plasma 4R',
    category: 'Cleaning/Stripping',
    typeTag: 'Plasma Cleaner',
    shortDesc: 'Entry-level plasma cleaner for labs and small-batch processing.',
    heroSubtitle: 'Compact plasma cleaner for teaching and research labs',
    bullets: [
      '4 L chamber volume for small-batch processing',
      'RF or mid-frequency options for flexibility',
      'Desktop-friendly footprint'
    ],
    features: [
      '4L chamber volume',
      'RF or mid-frequency options',
      'Compact desktop-friendly footprint'
    ],
    options: [
      'RF (13.56 MHz) or mid-frequency (40 kHz)',
      'Custom sample fixtures',
      'Optional process recipes'
    ],
    applications: [
      'Surface cleaning and activation',
      'Polymer treatment',
      'Lab-scale prototyping'
    ],
    deliveryAndService: 'US-based support routing and service coordination.',
    images: ['/assets/images/products/ns-plasma-4r/main.jpg'],
    thumbnail: '/assets/images/products/ns-plasma-4r/main.jpg',
    variants: nsPlasma4rVariants,
    manufacturerId: tyloong.id,
  },
  {
    id: 'ns-plasma-20r-i',
    slug: 'ns-plasma-20r-i',
    name: 'NS-Plasma 20R-I (Integrated)',
    category: 'Cleaning/Stripping',
    typeTag: 'Integrated Plasma',
    shortDesc: 'Integrated RF plasma cleaner with enhanced automation and safety features.',
    heroSubtitle: 'Integrated 20 L RF plasma cleaner for research labs',
    bullets: [
      'Integrated safety interlocks and controls',
      'Automated process repeatability',
      'Optimized for research lab workflows'
    ],
    features: [
      'Integrated safety interlocks',
      'Automated process control',
      'Optimized for research labs'
    ],
    options: [
      'Integrated RF configuration',
      'Batch process recipes',
      'Custom fixtures and accessories'
    ],
    applications: [
      'Batch surface treatment',
      'Research lab cleaning workflows',
      'Process repeatability and scale-up'
    ],
    deliveryAndService: 'US-based project coordination and service routing.',
    images: ['/assets/images/products/ns-plasma-20r-i/main.jpg'],
    thumbnail: '/assets/images/products/ns-plasma-20r-i/main.jpg',
    variants: [
      {
        id: 'ns-plasma-20r-i-standard',
        label: 'Integrated RF System',
        name: 'NS-Plasma 20R-I - Integrated RF Plasma System',
        price: 14499,
        isDefault: true,
      }
    ],
    manufacturerId: tyloong.id,
  },
  {
    id: 'coater-developer',
    slug: 'coater-developer',
    name: 'Coater/Developer System Series',
    category: 'Coating/Developing',
    typeTag: 'Lithography',
    shortDesc: 'High-precision photoresist coating and developing system with modular configuration.',
    features: [
      'Flexible module configuration',
      'High-speed spin modules',
      'Optional edge bead removal (EBR)'
    ],
    specifications: [
      'Wafer Size: 2" to 12" or square substrates',
      'Coater Speed: Up to 8000 rpm +/-1 rpm',
      'Developer Speed: Up to 5000 rpm +/-1 rpm',
      'Coating Uniformity: < 0.5% (3sigma typical)'
    ],
    images: ['/assets/images/products/coater-developer/main.jpg'],
    thumbnail: '/assets/images/products/coater-developer/main.jpg',
    manufacturerId: tyloong.id,
  },
];
