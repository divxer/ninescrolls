export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
}

export interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  formData: ContactFormData;
  onFormDataChange: (data: ContactFormData) => void;
  onSuccess?: () => void;
}

export interface InsightsPost {
  id: string;
  title: string;
  content?: string;
  excerpt?: string;
  author: string;
  publishDate: string;
  category: string;
  readTime: number;
  imageUrl: string;
  slug: string;
  tags: string[];
}

// Centralized insights posts data to avoid duplication
export const insightsPosts: InsightsPost[] = [
  {
    id: '13',
    title: 'Plasma Cleaning: Precision Surface Preparation for Next-Level Performance',
    excerpt: 'Discover how plasma cleaning technology provides eco-friendly, chemical-free surface preparation for semiconductors, medical devices, optics, and advanced manufacturing...',
    content: `
      <p>In today's high-tech manufacturing landscape—spanning semiconductors, medical devices, optics, and beyond—surface cleanliness is mission-critical. Even invisible, nano-scale contaminants like oil, dust, or oxidation can undermine adhesion, compromise performance, or cause defects in downstream processes. Plasma cleaning has emerged as an eco-friendly, highly effective solution, delivering chemical-free, residue-free, and ultra-precise surface preparation.</p>
      
      <h2>What Is Plasma Cleaning?</h2>
      <p>Plasma cleaning uses an ionized gas—plasma—to remove surface contamination and activate materials. Process involves energizing gases like oxygen, air, or inert species (e.g. argon, hydrogen) to create reactive radicals or ions that either chemically react with contaminants or physically dislodge them with micro-abrasion. The vaporized residues are then evacuated by vacuum or airflow.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <img 
          src="/assets/images/insights/plasma-cleaning-diagram-optimized.png" 
          alt="Plasma Cleaning Process Diagram - Visual representation of plasma cleaning technology showing ionized gas treatment, surface activation, and contaminant removal process" 
          style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
          loading="lazy"
        />
        <p style="margin-top: 10px; font-style: italic; color: #666; font-size: 0.9em;">Visualize with diagrams: Plasma cleaning process showing surface treatment and contaminant removal</p>
      </div>
      
      <h2>Advantages Over Traditional Cleaning</h2>
      <ul>
        <li><strong>No harsh chemicals or solvents</strong> — eco-friendly and safe, eliminating hazardous waste.</li>
        <li><strong>Non-contact, gentle yet thorough</strong> — effectively cleans delicate microstructures or optics without mechanical damage.</li>
        <li><strong>Surface activation</strong> — increases surface energy and adhesion, critical for bonding, coating, printing, and sealing processes.</li>
      </ul>
      
      <h2>Key Applications Across Industries</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Industry</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Applications & Benefits</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Electronics & Semiconductors</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Essential for PCB prep, leadframe cleaning, oxidation removal, and ensuring reliable soldering and coating.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Optics & Glass</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Cleans lenses and mirrors without abrasive damage or solvent residue.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Automotive & Aerospace</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Prepares surfaces for adhesives, sealants, and paints, enhancing durability and finish quality.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Medical Devices & Life Sciences</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Removes proteins, sterilizes surfaces, and improves biocompatibility—ideal for implants and culture substrates.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Cultural Heritage & Restoration</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Gently removes corrosion and encrustation from artifacts without damaging underlying materials.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Textiles & Polymers</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Improves wetting and adhesion on fabrics and plastics while retaining bulk properties.</td>
          </tr>
        </tbody>
      </table>
      
      <h2>Specialized Modes of Plasma Cleaning</h2>
      <ul>
        <li><strong>Atmospheric Plasma</strong> (e.g., Openair‑Plasma®) — integrates seamlessly into production lines, offers real-time, dry cleaning for metals, polymers, glass, and ceramics.</li>
        <li><strong>HydroPlasma®</strong> — adds ionized water molecules to selectively clean stubborn organic and inorganic residues without solvents.</li>
        <li><strong>Oxygen- or Air-Based Plasma</strong> — excels at removing organic films, improving wettability for printing or coating applications.</li>
        <li><strong>Hydrogen or Inert-Gas Plasma</strong> — ideal for removing oxide layers and enhancing conductivity in sensitive electronic components.</li>
      </ul>
      
      <h2>Why It Matters</h2>
      <ul>
        <li><strong>Reliability:</strong> Cleaner surfaces reduce defects and rework across critical manufacturing steps.</li>
        <li><strong>Speed:</strong> Dry, inline-ready process eliminates wait times inherent to wet cleaning and drying.</li>
        <li><strong>Environmental and Safety Leadership:</strong> Chemical-free cleaning aligns with sustainability goals and regulatory compliance.</li>
      </ul>
      
      <h2>NineScrolls: Advancing Plasma Technology for Surface Processing</h2>
      <p>At NineScrolls, we specialize in advanced plasma processing equipment and technologies that support surface preparation and thin film deposition applications. While we focus on plasma-enhanced deposition and etching systems, our expertise in plasma technology enables us to provide valuable insights and solutions for surface processing challenges.</p>
      <ul>
        <li>Advanced plasma processing systems for thin film deposition and etching</li>
        <li>Expert consultation on surface preparation and plasma technology integration</li>
        <li>Comprehensive support for plasma-enhanced manufacturing processes</li>
      </ul>
      
      <p><strong>Interested in learning more about our plasma processing solutions? <a href="/contact" style="color: #007bff; text-decoration: none; font-weight: bold;">Contact NineScrolls</a> to discuss how our plasma technology expertise can support your manufacturing needs.</strong></p>
    `,
    author: 'NineScrolls Team',
    publishDate: '2025-01-27',
    category: 'Materials Science',
    readTime: 10,
    imageUrl: '/assets/images/insights/plasma-cleaning-cover-optimized.png',
    slug: 'plasma-cleaning-precision-surface-preparation',
    tags: ['Plasma Cleaning', 'Surface Preparation', 'Semiconductor Manufacturing', 'Medical Devices', 'Optics', 'Environmental Technology', 'Manufacturing']
  },
  {
    id: '12',
    title: 'Plasma Etching Explained: From Fundamentals to Applications',
    excerpt: 'A comprehensive guide to plasma etching fundamentals, covering ion etching, chemical plasma etching, and reactive ion etching (RIE) with applications in semiconductor manufacturing...',
    author: 'NineScrolls Team',
    publishDate: '2025-01-26',
    category: 'Materials Science',
    readTime: 12,
    imageUrl: '/assets/images/insights/plasma-etching-fundamentals-cover-optimized.png',
    slug: 'plasma-etching-explained-fundamentals-applications',
    tags: ['Plasma Etching', 'Semiconductor Manufacturing', 'Materials Science', 'RIE', 'ICP-RIE', 'Microfabrication']
  },
  {
    id: '11',
    title: 'Understanding the Differences Between PE, RIE, and ICP-RIE in Plasma Etching',
    excerpt: 'A comprehensive comparison of Plasma Etching (PE), Reactive Ion Etching (RIE), and Inductively Coupled Plasma Reactive Ion Etching (ICP-RIE) technologies...',
    author: 'NineScrolls Team',
    publishDate: '2025-01-25',
    category: 'Materials Science',
    readTime: 15,
    imageUrl: '/assets/images/insights/plasma-etching-cover-optimized.png',
    slug: 'understanding-differences-pe-rie-icp-rie-plasma-etching',
    tags: ['Plasma Etching', 'PE', 'RIE', 'ICP-RIE', 'Semiconductor Manufacturing', 'Etching Technology']
  },
  {
    id: '1',
    title: 'Advanced Materials Processing: From Nanotechnology to Energy Applications',
    excerpt: 'Explore how NineScrolls equipment enables breakthroughs across materials science, nanotechnology, and energy technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-15',
    category: 'Materials Science',
    readTime: 8,
    imageUrl: '/assets/images/insights/advanced-materials.jpg',
    slug: 'advanced-materials-processing-nanotechnology-energy',
    tags: ['Advanced Materials', 'Nanotechnology', 'Energy Applications', 'Materials Science']
  },
  {
    id: '2',
    title: 'Photonics Manufacturing: Precision Engineering for Optical Devices',
    excerpt: 'Discover how precision manufacturing systems are revolutionizing photonics and optical device production...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-10',
    category: 'Photonics',
    readTime: 12,
    imageUrl: '/assets/images/insights/photonics-manufacturing.jpg',
    slug: 'photonics-manufacturing-precision-engineering',
    tags: ['Photonics', 'Optical Devices', 'Precision Manufacturing', 'Optics']
  },
  {
    id: '3',
    title: 'Nanofabrication Techniques: Building the Nanoscale Future',
    excerpt: 'Learn about cutting-edge nanofabrication methods and their applications in next-generation technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-08',
    category: 'Nanotechnology',
    readTime: 10,
    imageUrl: '/assets/images/insights/nanofabrication.jpg',
    slug: 'nanofabrication-techniques-nanoscale-future',
    tags: ['Nanofabrication', 'Nanotechnology', 'Microfabrication', 'Advanced Manufacturing']
  },
  {
    id: '4',
    title: 'Energy Storage Materials: Powering Tomorrow\'s Technologies',
    excerpt: 'Explore innovative energy storage solutions and their role in sustainable technology development...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-05',
    category: 'Energy',
    readTime: 9,
    imageUrl: '/assets/images/insights/energy-storage.jpg',
    slug: 'energy-storage-materials-tomorrow-technologies',
    tags: ['Energy Storage', 'Battery Technology', 'Sustainable Energy', 'Materials Science']
  },
  {
    id: '5',
    title: 'Biotechnology Applications: From Lab to Market',
    excerpt: 'Discover how precision manufacturing enables breakthroughs in biotechnology and medical applications...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-03',
    category: 'Biotechnology',
    readTime: 11,
    imageUrl: '/assets/images/insights/biotechnology.jpg',
    slug: 'biotechnology-applications-lab-market',
    tags: ['Biotechnology', 'Medical Applications', 'Lab Equipment', 'Precision Manufacturing']
  },
  {
    id: '6',
    title: 'Fuel Cell Technology: Powering the Hydrogen Economy',
    excerpt: 'Explore how NineScrolls precision manufacturing systems are enabling breakthroughs in fuel cell technology...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-20',
    category: 'Energy',
    readTime: 10,
    imageUrl: '/assets/images/insights/fuel-cells.jpg',
    slug: 'fuel-cell-technology-hydrogen-economy',
    tags: ['Fuel Cells', 'Hydrogen Economy', 'Clean Energy', 'Energy Technology']
  },
  {
    id: '7',
    title: 'Microfluidics Revolution: Lab-on-a-Chip Technologies',
    excerpt: 'Discover how microfluidics is transforming medical diagnostics and drug discovery processes...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-18',
    category: 'Biotechnology',
    readTime: 9,
    imageUrl: '/assets/images/insights/microfluidics.jpg',
    slug: 'microfluidics-revolution-lab-on-chip',
    tags: ['Microfluidics', 'Lab-on-a-Chip', 'Medical Diagnostics', 'Biotechnology']
  },
  {
    id: '8',
    title: 'Optical Waveguides: Modern Communications Infrastructure',
    excerpt: 'Learn about the latest developments in optical waveguide technology for telecommunications...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-16',
    category: 'Photonics',
    readTime: 11,
    imageUrl: '/assets/images/insights/optical-waveguides.jpg',
    slug: 'optical-waveguides-modern-communications',
    tags: ['Optical Waveguides', 'Telecommunications', 'Photonics', 'Communications']
  },
  {
    id: '9',
    title: 'Quantum Computing: The Future of Information Processing',
    excerpt: 'Explore how quantum computing technologies are revolutionizing information processing...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-14',
    category: 'Nanotechnology',
    readTime: 12,
    imageUrl: '/assets/images/insights/quantum-computing.jpg',
    slug: 'quantum-computing-future-information-processing',
    tags: ['Quantum Computing', 'Information Processing', 'Nanotechnology', 'Advanced Computing']
  },
  {
    id: '10',
    title: 'Solar Cell Manufacturing: Renewable Energy Solutions',
    excerpt: 'Discover advanced manufacturing techniques for next-generation solar cell technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-12',
    category: 'Energy',
    readTime: 8,
    imageUrl: '/assets/images/insights/solar-cells.jpg',
    slug: 'solar-cell-manufacturing-renewable-energy',
    tags: ['Solar Cells', 'Renewable Energy', 'Photovoltaics', 'Clean Energy']
  }
];

export const categories = [
  'All',
  'Materials Science',
  'Photonics',
  'Nanotechnology',
  'Energy',
  'Biotechnology'
]; 