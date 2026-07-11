import type { GuideProduct } from './types';

const IMG = '/assets/images/redesign/products';

export const PRODUCT_ROUTES: Record<string, string> = {
  rie: '/products/rie-etcher', 'icp-rie': '/products/icp-etcher', stripper: '/products/striper',
  'ibe-ribe': '/products/ibe-ribe', ald: '/products/ald', pecvd: '/products/pecvd',
  'hdp-cvd': '/products/hdp-cvd', sputter: '/products/sputter', 'coater-developer': '/products/coater-developer',
  'plasma-cleaner': '/products/plasma-cleaner', 'e-beam': '/products/e-beam-evaporator',
};

export const products: GuideProduct[] = [
  {
    id: 'rie', series: 'RIE Etcher Series', order: 1,
    image: `${IMG}/rie-standardized.webp`, imageAlt: 'NineScrolls RIE etcher platform',
    footprint: 'ref 1.0m × 1.0m',
    content: {
      lead: 'Reliable anisotropic plasma etching for university and R&D labs — dielectric patterning, polymer removal, surface activation, and device prototyping across silicon, compound, and 2D materials.',
      applications: ['Semiconductor R&D', 'Dielectric patterning', 'Polymer removal', 'Surface activation'],
      applicationCount: 4,
      href: '/products/rie-etcher',
    },
    bullets: [
      { heading: 'Broad material range.', body: 'Si-based films, compounds (InP/GaN/GaAs), 2D materials, and metals — plus failure-analysis work — in one chamber.' },
      { heading: 'Wide, repeatable process window.', body: '300–1000 W RF, 4 gas lines, and a −70 to 200 °C stage; non-uniformity under ±5% (edge exclusion).' },
      { heading: 'Tunable by design.', body: 'Showerhead gas feed and a configurable discharge gap give tunable etch profiles.' },
      { heading: 'Lab-ready and configurable.', body: '1.0 × 1.0 m footprint; open-load or load-lock; cost- or performance-optimized builds.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Si-Based (Si/SiO2/SiNx/SiC/Quartz etc.), Compounds (InP/GaN/GaAs/Ga2O3/ZnS etc.), 1D&2D Materials (MoS2/BN/Graphene etc.), Metals (Au/Pt/W/Ta/Mo etc.), Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range 300-1000W, optional' },
      { label: 'Gas System', value: '4 lines (Standard) or customized' },
      { label: 'Wafer Cooling', value: 'Water Cooling or He Backside Cooling optional' },
      { label: 'Wafer Stage Temperature Range', value: 'From -70℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'rie-etcher',
      // Website config: rieEtcherConfig.ts specifications.items
      //   Wafer Size '4-12 in' | RF Power '300-1000 W' | Gas System '4 gas lines' | Temperature '-70 to 200 C'
      checks: [
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '4lines', websiteExpected: '4gaslines' },
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: '12inch', websiteExpected: '4-12in' },
        { guideLabel: 'RF Power', websiteLabel: 'RF Power', guideExpected: '300-1000w', websiteExpected: '300-1000w' },
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Temperature', guideExpected: '-70℃to200℃', websiteExpected: '-70to200c' },
      ],
    },
  },
  {
    id: 'icp-rie', series: 'ICP Etcher Series', order: 2,
    image: `${IMG}/icp-rie-standardized.webp`, imageAlt: 'NineScrolls ICP-RIE plasma etching platform',
    footprint: 'ref 1.0m × 1.5m',
    content: {
      lead: 'High-density plasma etching for demanding research — silicon, MEMS, diamond, and compound semiconductors, with independent control of plasma density and ion energy.',
      applications: ['MEMS fabrication', 'Advanced packaging', 'Photonics', 'Power electronics'],
      applicationCount: 4,
      href: '/products/icp-etcher',
    },
    bullets: [
      { heading: 'Independent plasma control.', body: 'Separate source (1000–3000 W) and bias (300–1000 W) RF let plasma density and ion energy be tuned independently.' },
      { heading: 'Hard-to-etch materials.', body: 'Si, compounds (InP/GaN/GaAs), 2D materials, metals (W/Ta/Mo), and diamond in one platform.' },
      { heading: 'Gentle when needed.', body: 'Low-power plasma technology with an ion damage-free option for sensitive devices.' },
      { heading: 'Wide process window.', body: '5 gas lines, He backside cooling, and a −70 to 200 °C stage; non-uniformity under ±5% (edge exclusion).' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Si-Based (Si/SiO2/SiNx/SiC/Quartz etc.), Compounds (InP/GaN/GaAs/Ga2O3 etc.), 2D Materials (MoS2/BN/Graphene etc.), Metals (W/Ta/Mo etc.), Diamond, Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Source 1000-3000W, Bias 300-1000W, optional' },
      { label: 'Gas System', value: '5 lines (Standard) and He backside cooling, or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From -70℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'icp-etcher',
      // Website config: icpEtcherConfig.ts specifications.items
      //   Wafer Size '4-12 in' | Gas System '5 lines std.' | Stage Temp '-70 to 200 C' | RF Power '1000-3000 W' | Bias RF '300-1000 W optional'
      checks: [
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Stage Temp', guideExpected: '-70℃to200℃', websiteExpected: '-70to200c' },
        { guideLabel: 'RF Power', websiteLabel: 'RF Power', guideExpected: 'source1000-3000w', websiteExpected: '1000-3000w' },
        { guideLabel: 'RF Power', websiteLabel: 'Bias RF', guideExpected: 'bias300-1000w', websiteExpected: '300-1000w' },
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '5lines', websiteExpected: '5lines' },
      ],
    },
  },
  {
    id: 'stripper', series: 'Plasma Photoresist Stripping Series', order: 3,
    image: `${IMG}/striper-standardized.webp`, imageAlt: 'NineScrolls plasma photoresist stripping platform',
    footprint: 'ref 0.8m × 0.8m',
    content: {
      lead: 'Dedicated plasma stripping and ashing for photoresist, post-etch residue, and organic contamination removal — gentle enough for damage-sensitive process flows.',
      applications: ['Photoresist stripping', 'Plasma ashing', 'Post-etch residue cleaning', 'Organic contamination removal'],
      applicationCount: 4,
      href: '/products/striper',
    },
    bullets: [
      { heading: 'Thorough organic removal.', body: 'Strips photoresist, PMMA, and PS nanospheres, and cleans residue on 2D materials and failure-analysis samples.' },
      { heading: 'Uniform, repeatable ashing.', body: 'Chamber-center pump-down and uniform gas feed-in; non-uniformity under ±5% (edge exclusion).' },
      { heading: 'Temperature to match the resist.', body: 'Water-cooled stage adjustable from 5 to 200 °C, with 300–1000 W RF and 2 gas lines.' },
      { heading: 'Compact and simple.', body: '0.8 × 0.8 m footprint with open-load handling; cost- or performance-optimized builds.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Organics (PR/PMMA/PS nanosphere etc.), 2D Materials (MoS2/BN/Graphene etc.), Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'Mechanical pump' },
      { label: 'RF Power', value: 'Full range 300-1000W, optional' },
      { label: 'Gas System', value: '2 lines (Standard) or customized' },
      { label: 'Wafer Cooling', value: 'Water cooling' },
      { label: 'Wafer Stage Temperature Range', value: 'From 5℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'striper',
      // Website config: striperSystemConfig.ts specifications.items
      //   Wafer Size '4-12 in' | RF Power '300-1000 W' | Temperature '5 to 200 C' | Gas System '2 lines standard / expandable'
      checks: [
        { guideLabel: 'RF Power', websiteLabel: 'RF Power', guideExpected: '300-1000w', websiteExpected: '300-1000w' },
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '2lines', websiteExpected: '2lines' },
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Temperature', guideExpected: '5℃to200℃', websiteExpected: '5to200c' },
      ],
    },
  },
  {
    id: 'ibe-ribe', series: 'IBE/RIBE Series', order: 4,
    image: `${IMG}/ibe-ribe-standardized.webp`, imageAlt: 'NineScrolls ion beam etching (IBE/RIBE) platform',
    footprint: 'ref 1.0m × 0.8m',
    content: {
      lead: 'Directional ion beam and reactive ion beam etching for difficult-to-etch research materials — magnetic films, noble metals, optical materials, and multilayer stacks.',
      applications: ['Magnetic materials', 'Noble metal patterning', 'Optical device fabrication', 'MEMS / NEMS'],
      applicationCount: 4,
      href: '/products/ibe-ribe',
    },
    bullets: [
      { heading: 'Swappable ion sources.', body: 'Kaufman (up to 6 inch) or RF (up to 12 inch) sources in an easy-to-swap design, matched to your materials.' },
      { heading: 'Controlled beam geometry.', body: 'Stage tilt from 0° to 90° and rotation from 1–10 rpm for tunable etch angles and profiles.' },
      { heading: 'Clean, high-vacuum process.', body: 'Base vacuum better than 7E-7 Torr, with a water-cooled 5 to 20 °C stage and optional He backside cooling.' },
      { heading: 'Easy to run and maintain.', body: '1.0 × 0.8 m footprint; open-load or load-lock; sample holder and ion source designed for easy operation.' },
    ],
    specHeaders: ['Kaufman ion source', 'RF ion Source'],
    specs: [
      { label: 'Wafer Size Range', value: 'up to 6 inch', value2: 'up to 12 inch' },
      { label: 'Gas System', value: '1 line (standard) or customized', value2: '3 line (standard) or customized' },
      { label: 'Wafer Stage Motion', value: 'Tilt from 0° to 90°, Rotation from 1-10 rpm/min' },
      { label: 'Wafer Stage Cooling', value: 'From 5 to 20℃, Water cooling; He backside cooling optional' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'Base Vacuum', value: 'Better than 7E-7 Torr' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'ibe-ribe',
      // Website config: ibeRibeSystemConfig.ts specifications.items
      //   Ion Source 'Kaufman <=6 in / RF <=12 in' | Wafer Size 'Up to 12 in' | Tilt Angle '0-90 deg' | Rotation '1-10 rpm' | Gas Lines '1-3 standard, customizable'
      checks: [
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: 'upto12in', websiteExpected: 'upto12in' },
        { guideLabel: 'Wafer Stage Motion', websiteLabel: 'Rotation', guideExpected: '1-10rpm', websiteExpected: '1-10rpm' },
      ],
    },
  },
  {
    id: 'ald', series: 'ALD Series', order: 5,
    image: `${IMG}/ald-standardized.webp`, imageAlt: 'NineScrolls ALD system',
    footprint: 'ref 0.8m × 1.0m',
    content: {
      lead: 'Atomic-level thin-film deposition for research stacks — conformal coatings, high-k dielectrics, and passivation layers, even on demanding 3D structures.',
      applications: ['Gate dielectrics', 'Passivation layers', 'MEMS coatings', 'Energy storage materials'],
      applicationCount: 4,
      href: '/products/ald',
    },
    bullets: [
      { heading: 'Conformal on high-AR structures.', body: 'Box-in-box chamber, multiple gas inlets, and vertical precursor throw for high-AR step coverage.' },
      { heading: 'Broad material library.', body: 'Oxides (Al2O3/HfO2/SiO2), nitrides (TiN/AlN/SiNx), and metals (Pt/Pd/W) with 2–6 precursor lines.' },
      { heading: 'Tight uniformity.', body: 'Non-uniformity under ±1% (Al2O3) across 4–12 inch wafers, supersize optional.' },
      { heading: 'Thermal and plasma modes.', body: 'Wafer temperatures from 20 to 400 °C plus an optional 300–1000 W remote plasma source.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or Supersize optional' },
      { label: 'Growth Materials', value: 'Oxides (Al2O3/HfO2/SiO2/TiO2/Ga2O3/ZnO etc.), Nitrides (TiN/TaN/SiNx/AlN/GaN etc.), Metals (Pt/Pd/W etc.), etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'Base Vacuum', value: 'Better than 5E-5 Torr' },
      { label: 'RF Power', value: 'Remote Plasma 300-1000W, optional' },
      { label: 'Number of Precursor', value: '2-6 lines or customized' },
      { label: 'Temperature of Source', value: 'From 20℃ to 150℃ (Standard), 200℃ optional' },
      { label: 'Wafer Temperature Range', value: 'From 20℃ to 400℃, higher temperature optional' },
      { label: 'Non-Uniformity', value: 'Less than ±1% (Al2O3)' },
    ],
    websiteSpecParity: {
      productSlug: 'ald',
      // Website config: aldSystemConfig.ts specifications.items
      //   Wafer Size '4-12 in' | Wafer Temperature '20 to 400 C' | Precursor Lines '2-6 lines' | Remote Plasma '300-1000 W optional'
      checks: [
        { guideLabel: 'Wafer Temperature Range', websiteLabel: 'Wafer Temperature', guideExpected: '20℃to400℃', websiteExpected: '20to400c' },
        { guideLabel: 'Number of Precursor', websiteLabel: 'Precursor Lines', guideExpected: '2-6lines', websiteExpected: '2-6lines' },
        { guideLabel: 'RF Power', websiteLabel: 'Remote Plasma', guideExpected: '300-1000w', websiteExpected: '300-1000w' },
      ],
    },
  },
  {
    id: 'pecvd', series: 'PECVD Series', order: 6,
    image: `${IMG}/pecvd-standardized.webp`, imageAlt: 'NineScrolls PECVD thin film deposition system',
    footprint: 'ref 1.0m × 1.0m',
    content: {
      lead: 'Low-temperature plasma-enhanced CVD for research thin films — dielectric layers, passivation, optical coatings, MEMS stacks, and process development.',
      applications: ['Passivation layers', 'Interlayer dielectrics', 'Optical coatings', 'MEMS membranes'],
      applicationCount: 4,
      href: '/products/pecvd',
    },
    bullets: [
      { heading: 'Dual-frequency RF for low stress.', body: 'Electrode RF drive with dual-frequency options for film-stress tuning and process control.' },
      { heading: 'Core dielectric films.', body: 'α-Si:H, SiO2, SiNx, and SiC deposition across 4–12 inch wafers.' },
      { heading: 'Wide process window.', body: '500–2000 W RF, 6 gas lines, and a 20 to 400 °C stage; non-uniformity under ±5% (edge exclusion).' },
      { heading: 'Tunable plasma geometry.', body: 'Variable discharge gap, chamber liner, and electrode temperature control adapt to different processes.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Deposition Materials', value: 'Si-Based (α-Si:H/SiO2/SiNx/SiC etc.), etc.' },
      { label: 'Vacuum', value: 'Roots & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range 500-2000W, optional' },
      { label: 'Gas System', value: '6 lines (Standard) or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From 20℃ to 400℃, higher temperature optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'pecvd',
      // Website config: pecvdSystemConfig.ts specifications.items
      //   Wafer Size '4-12 in' | RF Power '500-2000 W' | Temperature '20 to 400 C' | Gas System 'Up to 6 gas lines'
      checks: [
        { guideLabel: 'RF Power', websiteLabel: 'RF Power', guideExpected: '500-2000w', websiteExpected: '500-2000w' },
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Temperature', guideExpected: '20℃to400℃', websiteExpected: '20to400c' },
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '6lines', websiteExpected: '6gaslines' },
      ],
    },
  },
  {
    id: 'hdp-cvd', series: 'HDP-CVD Series', order: 7,
    image: `${IMG}/hdp-cvd-standardized.webp`, imageAlt: 'NineScrolls HDP-CVD system',
    footprint: 'ref 1.0m × 1.5m',
    content: {
      lead: 'High-density plasma CVD for dense dielectrics and void-free trench fill — STI, IMD, PMD, and advanced packaging process development.',
      applications: ['STI gap-fill', 'IMD / PMD dielectrics', 'Advanced packaging dielectrics', 'TSV isolation workflows'],
      applicationCount: 4,
      href: '/products/hdp-cvd',
    },
    bullets: [
      { heading: 'Built for gap-fill.', body: 'Step coverage tuned as a process parameter for trench-fill and dense dielectric work.' },
      { heading: 'Independent source and bias.', body: '1000–3000 W source and 300–1000 W bias RF, each configurable to the process.' },
      { heading: 'Dielectric film set.', body: 'Si, SiO2, SiNx, SiON, and SiC films with 6 gas lines and a 20 to 200 °C stage.' },
      { heading: 'Lab-ready platform.', body: '1.0 × 1.5 m footprint; process design kits; open-load or load-lock handling.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Deposition Materials', value: 'Si/SiO2/SiNx/SiON/SiC, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range: Source 1000-3000W, Bias 300-1000W, optional' },
      { label: 'Gas System', value: '6 lines (Standard) or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From 20℃ to 200℃' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'hdp-cvd',
      // Website config: hdpCvdSystemConfig.ts specifications.items
      //   Wafer Size '4-12 in' | Source RF '1000-3000 W' | Bias RF '300-1000 W' | Temperature '20 to 200 C' | Gas System '6 gas lines'
      checks: [
        { guideLabel: 'RF Power', websiteLabel: 'Source RF', guideExpected: 'source1000-3000w', websiteExpected: '1000-3000w' },
        { guideLabel: 'RF Power', websiteLabel: 'Bias RF', guideExpected: 'bias300-1000w', websiteExpected: '300-1000w' },
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Temperature', guideExpected: '20℃to200℃', websiteExpected: '20to200c' },
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '6lines', websiteExpected: '6gaslines' },
      ],
    },
  },
  {
    id: 'sputter', series: 'PVD Magnetron Sputtering Series', order: 8,
    image: `${IMG}/sputter-standardized.webp`, imageAlt: 'NineScrolls sputtering system',
    footprint: 'ref 1.0m × 1.7m',
    content: {
      lead: 'Configurable DC/RF magnetron sputtering for research thin films — metals, dielectrics, nitrides, oxides, and magnetic, optical, and compound materials.',
      applications: ['Metal contacts', 'Magnetic films', 'Optical coatings', 'Compound semiconductors'],
      applicationCount: 4,
      href: '/products/sputter',
    },
    bullets: [
      { heading: 'Multi-target flexibility.', body: '2–6 magnetron sources, face-down or face-up, with tiltable angle and tunable deposition distance.' },
      { heading: 'DC and RF in one system.', body: 'DC or RF power with an automatic switcher, plus RF substrate bias for in-situ clean and process tuning.' },
      { heading: 'Cold to high-temperature substrates.', body: 'From water cooling up to 400, 800, or 1200 °C options, with a rotational, temperature-controlled electrode.' },
      { heading: 'Clean, repeatable films.', body: 'Base pressure better than 5E-7 Torr, in-situ or independent-chamber pre-clean, and non-uniformity under ±5%.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Magnetron Sputtering Source', value: '2-6 optional' },
      { label: 'Substrate Temperature', value: 'Water-cooling, 400℃, 800℃, 1200℃, optional' },
      { label: 'Gas System', value: '2 lines (Standard), number of lines customized' },
      { label: 'Power', value: 'DC or RF customized, automatic switcher' },
      { label: 'Non-Uniformity', value: 'Less than ±5%' },
      { label: 'Pre-Cleaning', value: 'Independent chamber or in-situ, RF plasma, optional' },
      { label: 'Base Pressure', value: 'Better than 5E-7 Torr, higher vacuum customized' },
    ],
    websiteSpecParity: {
      productSlug: 'sputter',
      // Website config: sputterSystemConfig.ts specifications.items
      //   Wafer Size '4-12 in' | Targets '2-6 configurable' | Substrate Temperature 'Water-cooled to 1200 C' | Base Pressure '<5x10^-7 Torr' | Uniformity '< +/-5%'
      checks: [
        { guideLabel: 'Magnetron Sputtering Source', websiteLabel: 'Targets', guideExpected: '2-6', websiteExpected: '2-6' },
        { guideLabel: 'Substrate Temperature', websiteLabel: 'Substrate Temperature', guideExpected: '1200℃', websiteExpected: '1200c' },
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: '12inch', websiteExpected: '4-12in' },
        { guideLabel: 'Non-Uniformity', websiteLabel: 'Uniformity', guideExpected: '±5%', websiteExpected: '+/-5%' },
      ],
    },
  },
  {
    id: 'coater-developer', series: 'Coater/Developer & Hotplate Series', order: 9,
    image: `${IMG}/coater-developer-standardized.webp`, imageAlt: 'NineScrolls Coater/Developer system for photolithography',
    footprint: 'ref 1.0m × 0.8m',
    content: {
      lead: 'Modular coat, develop, bake, HMDS, and EBR process control for repeatable photolithography — from small research pieces to pilot-line substrates.',
      applications: ['Photoresist coating', 'HMDS priming', 'Developer processing', 'Lift-off preparation'],
      applicationCount: 4,
      href: '/products/coater-developer',
    },
    bullets: [
      { heading: 'Precise spin control.', body: 'Coater to 8000 rpm and developer to 5000 rpm, each held to ±1 rpm.' },
      { heading: 'Broad substrate range.', body: 'Small pieces, 2–12 inch wafers, or square substrates across coater, developer, and hotplate modules.' },
      { heading: 'Modular by design.', body: 'Coater, developer, and hotplate module count customized, with options down to dispense systems and developer temperature.' },
      { heading: 'Integrated bake.', body: 'Hotplates up to 200 °C (higher optional) with 3 lift-pins, compatible down to 2 inch.' },
    ],
    specHeaders: ['Coater', 'Developer'],
    specs: [
      { label: 'Wafer Size Range', value: 'Small-piece, 2, 4, 6, 8, 12 inch or Square optional' },
      { label: 'Max. Spin Speed', value: '8000 rpm ±1rpm', value2: '5000 rpm ±1rpm' },
      { label: 'Max. Acceleration', value: '8000 rpm/s', value2: '5000 rpm/s' },
      { label: 'Dispense Arm', value: 'Up to 2 photoresist lines', value2: 'Up to 2 developer lines and deionized water line' },
      { label: 'Interlock', value: 'Vacuum pressure, uncover etc.' },
    ],
    subTable: {
      title: 'Hotplate Specifications',
      specs: [
        { label: 'Wafer Size Range', value: 'Small-piece, 2, 4, 6, 8, 12 inch or Square optional' },
        { label: 'Max. Temperature', value: 'Up to 200℃, Higher Temperature optional' },
        { label: 'Lift-Pins', value: '3 lift-pins, minimum compatible 2 inch' },
      ],
    },
    websiteSpecParity: {
      productSlug: 'coater-developer',
      // Website config: coaterDeveloperConfig.ts specifications.items
      //   Wafer Size 'Pieces to 12 in' | Coater Speed 'Up to 8000 rpm +/-1 rpm' | Developer Speed 'Up to 5000 rpm +/-1 rpm' | Hotplate 'RT to 200 C'
      checks: [
        { guideLabel: 'Max. Spin Speed', websiteLabel: 'Coater Speed', guideExpected: '8000rpm', websiteExpected: '8000rpm' },
        { guideLabel: 'Max. Spin Speed', websiteLabel: 'Developer Speed', guideExpected: '5000rpm', websiteExpected: '5000rpm' },
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: '12inch', websiteExpected: '12in' },
      ],
    },
  },
  {
    id: 'plasma-cleaner', series: 'Plasma Cleaner Systems', order: 10,
    image: `${IMG}/hy-20l-standardized.webp`, imageAlt: 'NineScrolls compact RF plasma cleaner system',
    footprint: 'ref 630 mm × 600 mm',
    content: {
      lead: 'Benchtop plasma cleaning for surface activation, cleaning, and hydrophilic or hydrophobic treatment.',
      applications: ['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep'],
      applicationCount: 4,
      href: '/products/plasma-cleaner',
    },
    bullets: [
      { heading: 'Multi-gas plasma processing.', body: 'O₂, N₂, or Ar plasma at 0–300 W or 500 W RF with automatic matching and 2–3 gas lines.' },
      { heading: 'Gentle on diverse materials.', body: 'Contact-free treatment of photoresist, PMMA, PDMS, organics, and semiconductor, optical, and biomedical materials.' },
      { heading: 'Batch-friendly.', body: 'Single- or multi-wafer batches up to 6 inch, with MFC or manual flow control (0–300 sccm).' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '≤ 6 inch, multi-wafer batch processing' },
      { label: 'RF Power', value: '0 ~ 300 W / 500 W, automatic matching' },
      { label: 'Gas System', value: '2 ~ 3 gas lines' },
      { label: 'Process Gases', value: 'O₂, N₂, Ar' },
      { label: 'Flow Control Range', value: '0 ~ 300 sccm' },
      { label: 'Flow Control', value: 'MFC or manual control' },
      { label: 'Pump System', value: 'Mechanical pump (TMP optional)' },
      { label: 'Operation', value: 'Touchscreen control, fully automated' },
      { label: 'Footprint', value: '630 mm × 600 mm' },
      { label: 'Compatible Materials', value: 'Photoresist (PR); PMMA; PDMS; HMDS; organic films and polymers; semiconductor materials; optical materials; biomedical materials' },
      { label: 'Main Functions', value: 'Surface cleaning; surface activation; hydrophilic / hydrophobic treatment; functional group modification (–OH / –H / –COOH); contact-free plasma processing' },
      { label: 'Typical Applications', value: 'Chemical & biological laboratories; failure analysis; optical components; biomedical and medical devices' },
    ],
    familyOptions: ['HY-4L', 'HY-20L', 'HY-20LRF', 'PLUTO-T', 'PLUTO-M', 'PLUTO-F'],
    // No websiteSpecParity: the guide's cleaner page is a family summary, not a single website SKU.
  },
  {
    id: 'e-beam', series: 'MEB-600 E-Beam Evaporation Series', order: 11,
    image: `${IMG}/e-beam-standardized.webp`, imageAlt: 'NineScrolls e-beam and thermal evaporation system',
    footprint: undefined,
    content: {
      lead: 'Multi-source e-beam and thermal evaporation for optical and IR research — photonic crystals, optical multilayers, IR sensors, and lift-off metallization at research-grade purity.',
      applications: ['Infrared image sensors', 'Ge/ZnS photonic crystals', 'UV down-conversion films', 'Optical AR coatings'],
      applicationCount: 4,
      href: '/products/e-beam-evaporator',
    },
    bullets: [
      { heading: 'Two evaporation sources.', body: 'E-beam plus thermal resistance for metals, oxides, fluorides, and IR films.' },
      { heading: 'Precise thickness control.', body: 'In-situ QCM endpoint monitoring; uniformity ≤±5% within Φ6 in.' },
      { heading: 'Optical and IR stacks ready.', body: 'High-purity films for photonic crystals, optical multilayers, and IR sensors.' },
      { heading: 'Flexible operation.', body: 'Manual, semi-automatic, or full-automatic; suited to lift-off metallization and patterning.' },
    ],
    specs: [
      { label: 'Substrate', value: 'Φ6 in x1 flat substrate holder' },
      { label: 'Substrate Heating', value: 'RT to 300°C' },
      { label: 'Substrate Rotation', value: '1–10 rpm' },
      { label: 'E-Gun Crucible', value: '6 pockets, 17 cc each' },
      { label: 'E-Beam Power', value: '~10 kW' },
      { label: 'Uniformity', value: '≤±5% within Φ6 in' },
      { label: 'Thickness Control', value: 'In-situ QCM endpoint' },
      { label: 'Vacuum', value: '6.7×10⁻⁵ Pa ultimate vacuum' },
      { label: 'Operating Modes', value: 'Manual / semi-auto / full-auto' },
      { label: 'Sources', value: 'E-beam + thermal resistance' },
      { label: 'Materials', value: 'Metals, oxides, fluorides, IR films' },
    ],
    websiteSpecParity: {
      productSlug: 'e-beam-evaporator',
      // Website config: eBeamEvaporatorConfig.ts specifications.items
      //   Substrate 'Φ6 in x1 flat substrate holder' | Uniformity '≤±5% within Φ6 in' | Vacuum '6.7×10⁻⁵ Pa ultimate vacuum'
      checks: [
        { guideLabel: 'Substrate', websiteLabel: 'Substrate', guideExpected: 'φ6inx1flatsubstrateholder', websiteExpected: 'φ6inx1flatsubstrateholder' },
        { guideLabel: 'Uniformity', websiteLabel: 'Uniformity', guideExpected: '≤±5%withinφ6in', websiteExpected: '≤±5%withinφ6in' },
        { guideLabel: 'Vacuum', websiteLabel: 'Vacuum', guideExpected: '6.7×10⁻⁵paultimatevacuum', websiteExpected: '6.7×10⁻⁵paultimatevacuum' },
      ],
    },
  },
];
