import type { EquipmentGuideData } from './types';

export const about: EquipmentGuideData['about'] = {
  title: 'About NineScrolls LLC',
  subtitle: 'Leading Innovation in Scientific Research Equipment',
  paragraphs: [
    'NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and integration in the scientific research equipment industry. Our primary focus is on establishing a comprehensive platform that connects manufacturers, researchers, and industry professionals across the United States.',
    'By fostering collaboration and streamlining access to cutting-edge laboratory equipment, we aim to empower scientific discovery and drive technological advancements. At NineScrolls LLC, we are committed to delivering tailored solutions and creating value for our partners and clients through expertise, efficiency, and innovation.',
  ],
  pillars: [
    { heading: 'Integration', body: 'We create seamless connections between manufacturers, researchers, and industry professionals to advance scientific discovery.' },
    { heading: 'Innovation', body: 'We drive advancement in the scientific equipment industry through innovative solutions and platforms.' },
    { heading: 'Collaboration', body: 'We foster partnerships and facilitate connections across the scientific community to accelerate progress.' },
    { heading: 'Expertise', body: 'We leverage deep industry knowledge to deliver tailored solutions that create value for our partners and clients.' },
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
