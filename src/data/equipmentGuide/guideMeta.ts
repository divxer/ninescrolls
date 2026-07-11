import type { EquipmentGuideData, GuideCover } from './types';

export const cover: GuideCover = {
  eyebrow: 'Precision Instrumentation',
  title: 'Equipment Guide',
  tagline: 'Etching, thin-film deposition, lithography, and surface-processing platforms for university, national laboratory, institute, and corporate R&D facilities.',
  edition: 'Equipment Guide · 2026 Edition · ninescrolls.com · info@ninescrolls.com',
};

export const about: EquipmentGuideData['about'] = {
  title: 'About NineScrolls LLC',
  subtitle: 'U.S.-based process-equipment selection, configuration, and support',
  paragraphs: [
    'NineScrolls LLC helps universities, national laboratories, and R&D and advanced-manufacturing teams across the United States select, configure, and support semiconductor process equipment. We start from the work — your materials, target process window, sample size, and facility conditions — and match the platform to it, rather than starting from a catalog.',
    'As a U.S.-based partner, we coordinate selection, configuration, quoting, delivery, and after-sales support so a research team gets a process-ready platform and a local point of contact.',
  ],
  pillars: [
    { heading: 'Process-first platform selection', body: 'We confirm materials, process window, sample size, and facility conditions first, then match the platform — not the other way around.' },
    { heading: 'Configured around your lab', body: 'Platforms are specified to your throughput, wafer sizes, gases, and space, rather than sold as a fixed SKU.' },
    { heading: 'U.S.-based project coordination and support', body: 'Selection, configuration, quoting, delivery, and after-sales support are coordinated locally.' },
    { heading: 'Peer-reviewed validation for represented platforms', body: 'The corresponding platform classes appear in real peer-reviewed research — validating the process capability, not NineScrolls-owned equipment or NineScrolls-authored papers.' },
  ],
};

export const evidence: EquipmentGuideData['evidence'] = {
  title: 'Peer-Reviewed Validation for the Platforms We Represent',
  subtitle: 'Research using corresponding plasma, deposition, and vacuum process platforms has appeared in Nature Portfolio journals, Advanced Materials, Materials Today, and Scientific Reports.',
  intro: 'Real published research using corresponding process platforms.',
  studies: [
    { journal: 'Nature Communications', year: 2021, title: 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions', platform: 'RIE', citations: 245, citationsAsOf: 'Jul 2026', doi: '10.1038/s41467-021-21861-6' },
    { journal: 'Light: Science & Applications', year: 2026, title: 'On-chip nonlocal metasurface for color router', platform: 'RIE', doi: '10.1038/s41377-025-02146-9' },
    { journal: 'Advanced Materials', year: 2026, title: 'Diffraction-free omnidirectional antireflection binary metasurface', platform: 'ICP', doi: '10.1002/adma.202519943' },
    { journal: 'Materials Today', year: 2026, title: 'Solar-blind deep-UV photodetector based on β-Ga₂O₃/AlN/p-Si', platform: 'PECVD', citations: 9, citationsAsOf: 'Jul 2026', doi: '10.1016/j.mattod.2026.103220' },
    { journal: 'Scientific Reports', year: 2025, title: 'Experimental study of inductively coupled plasma etching of patterned single crystal diamonds', platform: 'ICP', citations: 4, citationsAsOf: 'Jul 2026', doi: '10.1038/s41598-025-08066-3' },
  ],
  disclaimer: 'These publications validate represented platform classes and process capabilities. They are not claims of NineScrolls-branded installed-base citations.',
};

export const contact: EquipmentGuideData['contact'] = {
  office: ['12546 Cabezon Pl', 'San Diego, CA 92129', 'United States'],
  hours: ['Monday – Friday', '9:00 AM – 5:00 PM PST'],
  contacts: [
    { label: 'General Inquiries', value: 'info@ninescrolls.com' },
    { label: 'Sales', value: 'sales@ninescrolls.com' },
    { label: 'Urgent Matters', value: '+1 (858) 879-8898' },
  ],
  support: [
    { label: 'Support Email', value: 'support@ninescrolls.com' },
    { label: 'Support Hours', value: 'Monday – Friday, 8:00 AM – 6:00 PM PST' },
    { label: 'Emergency Support', value: '24/7 available for critical issues' },
  ],
};
