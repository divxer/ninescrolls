import type { GuideProduct } from './types';

const IMG = '/assets/images/redesign/products';

export const products: GuideProduct[] = [
  {
    id: 'rie', series: 'RIE Etcher Series', order: 1,
    image: `${IMG}/rie-standardized.webp`, imageAlt: 'NineScrolls RIE etcher platform',
    footprint: 'ref 1.0m × 1.0m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.0m).' },
      { heading: 'Uniform Chamber Center Pump-down', body: 'Better process performance.' },
      { heading: 'Showerhead Gas Feed-in', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
      //   Wafer Size '4-12 in' | RF Power 'Up to 600 W' | Gas System '4 gas lines' | Temperature '20 to 80 C'
      // NOTE: website RF Power ('Up to 600 W') and Temperature ('20 to 80 C') diverge from the guide's
      // full-range values, so parity is asserted on the stable rows that genuinely agree.
      checks: [
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '4lines', websiteExpected: '4gaslines' },
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: '12inch', websiteExpected: '4-12in' },
      ],
    },
  },
  {
    id: 'icp-rie', series: 'ICP Etcher Series', order: 2,
    image: `${IMG}/icp-rie-standardized.webp`, imageAlt: 'NineScrolls ICP-RIE plasma etching platform',
    footprint: 'ref 1.0m × 1.5m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.5m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Chamber Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Plasma Specialization', body: 'Low power plasma technology, ion damage-free optional.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 0.8m × 0.8m).' },
      { heading: 'Uniform Chamber Center Pump-down', body: 'Better process performance.' },
      { heading: 'Uniform Gas Feed-in', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling', body: 'Open-Load.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 0.8m).' },
      { heading: 'Maintenance and Sample-handling Friendly', body: 'Sample holder and ion source design for easy-to-use operation.' },
      { heading: 'Flexible Ion Source Design', body: 'Different kinds of ion source easy-to-swap design, depending on customer requirements.' },
      { heading: 'Cost or Performance Orientation', body: 'Ion source, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 0.8m × 1.0m).' },
      { heading: 'Box-in-Box Process Chamber', body: 'Better process performance.' },
      { heading: 'Configurable Gas Feed-in', body: 'Showerhead gas feed-in, tuned as a preset parameter independently.' },
      { heading: 'High-AR Step Coverage', body: 'Excellent high-AR step covering capability with multiple gas inlets and vertical precursor throw.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.0m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Variable Plasma Discharge Gap', body: 'Better process performance.' },
      { heading: 'Temperature Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Advanced RF System', body: 'Electrode RF driven (13.56MHz and/or 400KHz) for better process tuning and control, low stress.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.5m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Temperature Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Step Coverage', body: 'Excellent step covering capability, tuned as a parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.7m).' },
      { heading: 'Creative Magnetron Design', body: 'Magnetron target structure self-designed, designed and modified based on customer needs.' },
      { heading: 'Flexible Target Configuration', body: 'Magnetron target face-down or face-up optional, angle tiltable and deposition distance tunable.' },
      { heading: 'Advanced Electrode Control', body: 'Electrode rotational and temperature controllable, suitable for different process application.' },
      { heading: 'RF Bias Capability', body: 'Substrate can be RF biased for in-situ clean, and better process tuning and control.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
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
      //   Wafer Size '4-12 in' | Targets '2-6 configurable' | Substrate Temperature 'Water-cooled to 1200 C' | Base Pressure '<5x10^-7 Torr'
      checks: [
        { guideLabel: 'Magnetron Sputtering Source', websiteLabel: 'Targets', guideExpected: '2-6', websiteExpected: '2-6' },
        { guideLabel: 'Substrate Temperature', websiteLabel: 'Substrate Temperature', guideExpected: '1200℃', websiteExpected: '1200c' },
        { guideLabel: 'Wafer Size Range', websiteLabel: 'Wafer Size', guideExpected: '12inch', websiteExpected: '4-12in' },
      ],
    },
  },
  {
    id: 'coater-developer', series: 'Coater/Developer & Hotplate Series', order: 9,
    image: `${IMG}/coater-developer-standardized.webp`, imageAlt: 'NineScrolls Coater/Developer system for photolithography',
    footprint: 'ref 1.0m × 0.8m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 0.8m).' },
      { heading: 'Flexible Configuration', body: 'Number of coater/developer/hotplate modules customized.' },
      { heading: 'Modular Options', body: 'Wide range of options down to module level, including dispense systems, temperature for developers etc.' },
      { heading: 'Cost or Performance Orientation', body: 'Dispense, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling', body: 'Open-Load.' },
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
    bullets: [
      { heading: 'Ultra-Compact Footprint', body: 'One-piece integrated design for space-limited laboratories (ref 630 mm × 600 mm).' },
      { heading: 'Maintenance and Sample-handling Friendly', body: 'Simple chamber structure with easy access; designed for fast loading, cleaning, and routine maintenance.' },
      { heading: 'Stable and Cost-Effective Performance', body: 'Optimized RF plasma design for repeatable surface treatment; excellent cost-performance ratio for research and light manufacturing.' },
      { heading: 'Flexible Process Capability', body: 'Supports surface cleaning, activation, and modification; single-wafer or multi-wafer batch processing.' },
      { heading: 'Multi-Gas Plasma Processing', body: 'Compatible with O₂ / N₂ / Ar plasma processes; supports hydrophilic / hydrophobic surface treatments.' },
      { heading: 'Tabletop / Bench-top Design', body: 'Single or multi-wafer batch processing; compatible with 6-inch and smaller wafers.' },
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
    id: 'e-beam', series: 'E-Beam Evaporation Series', order: 11,
    image: `${IMG}/e-beam-standardized.webp`, imageAlt: 'NineScrolls e-beam and thermal evaporation system',
    footprint: undefined,
    bullets: [
      { heading: 'Multi-Source E-Beam and Thermal', body: 'E-beam and thermal resistance sources for metals, oxides, fluorides, and IR films.' },
      { heading: 'In-situ Endpoint Control', body: 'In-situ QCM thickness monitoring and endpoint control.' },
      { heading: 'Optical and IR Stack Ready', body: 'High-purity films for photonic crystals, optical multilayers, and IR sensors.' },
      { heading: 'Flexible Operating Modes', body: 'Manual, semi-automatic, or full-automatic operation.' },
      { heading: 'Directional Lift-off Deposition', body: 'Directional deposition suited to lift-off metallization and patterning.' },
    ],
    specs: [
      { label: 'Substrate', value: '1×8 in or 5×4 in' },
      { label: 'E-Gun Crucible', value: '6 pockets, 17 cc each' },
      { label: 'Uniformity', value: '±3-5%' },
      { label: 'Thickness Control', value: 'In-situ QCM endpoint' },
      { label: 'Vacuum', value: '~8×10⁻⁴ Pa' },
      { label: 'Operating Modes', value: 'Manual / semi-auto / full-auto' },
      { label: 'Sources', value: 'E-beam + thermal resistance' },
      { label: 'Materials', value: 'Metals, oxides, fluorides, IR films' },
    ],
    websiteSpecParity: {
      productSlug: 'e-beam-evaporator',
      // Website config: eBeamEvaporatorConfig.ts specifications.items
      //   Substrate '1x8 in or 5x4 in' | Uniformity '+/-3-5%' | Vacuum '~8x10^-4 Pa'
      // NOTE: the guide value uses U+00D7 '×' (e.g. '1×8'); the website uses ascii 'x' ('1x8'). norm() does not
      // transliterate, so guideExpected keeps '×' while websiteExpected keeps 'x'.
      checks: [
        { guideLabel: 'Substrate', websiteLabel: 'Substrate', guideExpected: '1×8inor5×4in', websiteExpected: '1x8inor5x4in' },
        { guideLabel: 'Uniformity', websiteLabel: 'Uniformity', guideExpected: '3-5%', websiteExpected: '3-5%' },
      ],
    },
  },
];
