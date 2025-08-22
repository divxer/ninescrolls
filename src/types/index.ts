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
    id: '14',
    title: 'HDP-CVD In-Depth Guide (High-Density Plasma CVD) — A Practical Handbook for U.S. Research and Manufacturing Users',
    excerpt: 'Comprehensive guide to HDP-CVD technology for high-density thin films and superior gap-fill in high-aspect-ratio trenches. Learn about process optimization, equipment selection, and applications in semiconductor manufacturing.',
    content: `
      <p><strong>Target Readers:</strong> Semiconductor/packaging process engineers, equipment engineers, PIs/lab managers, R&D procurement teams, and technical decision-makers.</p>
      
      <h2>TL;DR Summary</h2>
      <p>HDP-CVD enables high-density thin films and superior gap-fill in high-aspect-ratio (HAR) trenches/voids through a combination of high-density plasma and ion-assisted deposition. It is particularly effective for STI, PMD/IMD dielectric layers, TSV, advanced packaging, and MEMS. Compared with conventional PECVD, HDP-CVD achieves better void suppression and film density; compared with ALD, HDP-CVD offers higher throughput and lower cost-of-ownership (when requirements are met).</p>
      
      <h2>1) What is HDP-CVD?</h2>
      <p>HDP-CVD (High-Density Plasma Chemical Vapor Deposition) is a thin film deposition technology operating at low pressures (typically <10 mTorr), using high-density plasma (commonly ICP: Inductively Coupled Plasma) to enhance chemical reactions and physical re-sputtering. The core principles are:</p>
      <ul>
        <li>Generate high-density plasma, supplying abundant radicals to accelerate precursor decomposition and film formation;</li>
        <li>Apply bias power to introduce directional ion bombardment, enabling simultaneous deposition and re-sputtering, which improves sidewall/bottom coverage inside trenches and prevents keyholes/voids;</li>
        <li>Achieve high-density, low-defect dielectric films (SiO₂, SiNₓ, SiON, SiC, etc.) at relatively low substrate temperatures.</li>
      </ul>
      
      <p><strong>Common precursor/gas chemistries:</strong></p>
      <ul>
        <li>SiO₂: TEOS/O₂/Ar or SiH₄/O₂(/N₂O)</li>
        <li>SiNₓ/SiON: SiH₄/NH₃/N₂(/N₂O)</li>
        <li>SiC: SiH₄/CH₄(/H₂/N₂)</li>
      </ul>
      
      <h2>2) How It Works (Why HDP Works)</h2>
      <ol>
        <li><strong>Chemical Deposition (CVD):</strong> Precursors decompose/react near the substrate to form solid films.</li>
        <li><strong>Plasma Activation:</strong> High-density plasma generates abundant ions/radicals, lowering activation energy and enabling high-quality deposition at lower temperatures.</li>
        <li><strong>Ion-Assisted Re-sputtering:</strong> Substrate bias accelerates ions toward the surface, lightly etching/re-distributing material so it migrates/fills trench bottoms, improving step coverage and gap-fill.</li>
      </ol>
      
             <p><em>Analogy:</em> It works like painting while smoothing at the same time — deposition "paints" the surface, while ions "smooth" excess material into gaps.</p>
       
       <div style="text-align: center; margin: 30px 0;">
         <img 
           src="/assets/images/insights/hdp-cvd-process-flow-optimized.webp" 
           alt="HDP-CVD Process Flow Diagram - High-Density Plasma Chemical Vapor Deposition process flow diagram showing plasma generation, ion bombardment, and film deposition mechanisms" 
           style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
           loading="lazy"
         />
         <p style="margin-top: 10px; font-style: italic; color: #666; font-size: 0.9em;">Figure 1: HDP-CVD Process Flow Diagram - Showing plasma generation, ion bombardment, and film deposition mechanisms</p>
       </div>
      
      <h2>3) Comparison with Mainstream Deposition Routes</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Technology</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Temp</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Pressure</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">HAR Fill Control</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Film Density</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Throughput</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Typical Applications</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>HDP-CVD</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">200–450 °C</td>
            <td style="border: 1px solid #ddd; padding: 12px;">~1–10 mTorr</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Excellent (gap-fill)</td>
            <td style="border: 1px solid #ddd; padding: 12px;">High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Medium–High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">STI, PMD/IMD, TSV, advanced packaging, MEMS</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>PECVD</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">200–400 °C</td>
            <td style="border: 1px solid #ddd; padding: 12px;">~0.1–3 Torr</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Moderate</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Moderate</td>
            <td style="border: 1px solid #ddd; padding: 12px;">High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Passivation, dielectric layers, H-doped films</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>LPCVD</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">400–800 °C</td>
            <td style="border: 1px solid #ddd; padding: 12px;">~0.1–1 Torr</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Moderate</td>
            <td style="border: 1px solid #ddd; padding: 12px;">High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Poly-Si, SiNₓ, high-temp layers</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>ALD</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">80–350 °C</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Near vacuum pulsing</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Best (atomic-level)</td>
            <td style="border: 1px solid #ddd; padding: 12px;">High</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Low</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Ultra-thin, ultra-uniform, gate oxides</td>
          </tr>
        </tbody>
      </table>
      
      <p><strong>Rules of Thumb:</strong></p>
             <ul>
         <li>For deep trenches, void-free, high-density films with higher throughput, use HDP-CVD;</li>
         <li>For extreme HAR or sub-10 nm ultra-uniform layers, ALD is preferred;</li>
         <li>For general coverage with cost sensitivity, PECVD is sufficient.</li>
       </ul>
       
       <div style="text-align: center; margin: 30px 0;">
         <img 
           src="/assets/images/insights/pecvd-hdp-cvd-comparison-optimized.webp" 
           alt="PECVD vs HDP-CVD Gap-Fill Comparison - Comparison showing gap-fill performance between PECVD and HDP-CVD technologies in high-aspect-ratio trenches" 
           style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
           loading="lazy"
         />
         <p style="margin-top: 10px; font-style: italic; color: #666; font-size: 0.9em;">Figure 2: PECVD vs HDP-CVD Gap-Fill Comparison - Demonstrating performance differences between the two technologies in high-aspect-ratio trenches</p>
       </div>
      
      <h2>4) Key Metrics & Influencing Factors</h2>
      <ul>
        <li><strong>Gap-fill capability:</strong> Influenced by bias power, source power, pressure, Ar/O₂ ratio, substrate temp;</li>
        <li><strong>Film stress:</strong> Higher ion energy introduces more stress; optimized via temp control, bias/source ratio, gas composition;</li>
        <li><strong>Refractive index/density/dielectric constant:</strong> Dependent on precursor chemistry (TEOS vs SiH₄), plasma energy, post-treatment;</li>
        <li><strong>Charge/plasma damage:</strong> Mitigated by pulsed bias, soft-landing, and shielding.</li>
      </ul>
      
      <h2>5) Typical Applications</h2>
      <ul>
        <li><strong>STI (Shallow Trench Isolation):</strong> Void suppression, CMP compatibility;</li>
        <li><strong>PMD/IMD Dielectrics:</strong> Denser insulation, reduced leakage, improved reliability;</li>
        <li><strong>TSV/Advanced Packaging/Flip-Chip:</strong> Dielectric gap-fill, passivation;</li>
        <li><strong>MEMS/Sensors:</strong> Dielectric deposition/encapsulation above structures;</li>
        <li><strong>Power Devices/Compound Semiconductors:</strong> High-quality dielectrics for high-voltage/temperature.</li>
      </ul>
      
      <h2>6) Starter Process Window (Example, Non-Production Recipe)</h2>
      <p>Ranges vary by tool/film target; baseline starting points:</p>
      <ul>
        <li><strong>Pressure:</strong> 1–10 mTorr</li>
        <li><strong>Substrate Temperature:</strong> 200–450 °C</li>
        <li><strong>RF Source Power:</strong> 1.0–3.0 kW</li>
        <li><strong>Substrate Bias:</strong> 300–1000 W</li>
        <li><strong>Gas Chemistry:</strong>
          <ul>
            <li>SiO₂ (TEOS/O₂/Ar): Ar improves directional re-sputtering;</li>
            <li>SiO₂ (SiH₄/O₂/N₂O): Higher rate, but watch H-content/stress;</li>
            <li>SiNₓ (SiH₄/NH₃/N₂): Adjust N/H ratio, refractive index.</li>
          </ul>
        </li>
      </ul>
      <p><strong>DOE Tip:</strong> Use Source/Bias/Pressure as 3-factor matrix, verify via SEM (gap-fill) + wafer bow (stress).</p>
      
      <h2>7) Equipment Selection Checklist</h2>
      <ul>
        <li><strong>Chamber design:</strong> Single/multi-chamber, replaceable liners, electrode temperature control;</li>
        <li><strong>RF System:</strong> Source/bias range, matching network speed, pulsed/modulated capability;</li>
        <li><strong>Temperature Control:</strong> Independent electrode/wall heating, reduce particles/defects;</li>
        <li><strong>Gas Delivery:</strong> Multi-zone MFCs, precursor heating/TEOS bubbling stability;</li>
        <li><strong>Vacuum System:</strong> Dry pump + turbo, low-pressure stability, fast pump-down;</li>
        <li><strong>Wafer Handling:</strong> Open-Load vs Load-Lock (throughput, cleanliness);</li>
        <li><strong>Monitoring & Traceability:</strong> Chamber pressure/RF/temp/flow logged for SPC;</li>
        <li><strong>Safety Compliance:</strong> Toxic/flammable gas interlocks, abatement, NFPA/local codes.</li>
      </ul>
      
      <h2>8) Facility & EHS Notes</h2>
      <ul>
        <li><strong>Precursors/Gases:</strong> TEOS, SiH₄, NH₃, CH₄, O₂, Ar, N₂; (SiH₄/NH₃ = flammable/toxic, requires gas cabinets, detection, interlocks);</li>
        <li><strong>Exhaust Abatement:</strong> Dry/wet/combustion scrubbers (per chemistry);</li>
        <li><strong>Safety:</strong> Blast panels, interlocks per regulations;</li>
        <li><strong>Training:</strong> Standardized operation, maintenance, emergency SOPs.</li>
      </ul>
      
      <h2>9) Maintenance & Cost of Ownership (CoO)</h2>
      <ul>
        <li>Replaceable liners/electrodes reduce particles/cleaning frequency;</li>
        <li>Plasma clean recipes + periodic wet cleans;</li>
        <li>Consumables: liners, O-rings, MFC filters, pump oil;</li>
        <li>Downtime scheduling aligned with fab/lab planning;</li>
        <li>CoO includes gases/precursors, consumables, pumps, utilities.</li>
      </ul>
      
      <h2>10) Metrology & Validation</h2>
      <ul>
        <li><strong>Thickness/uniformity:</strong> Ellipsometry, XRR;</li>
        <li><strong>Composition/bonding:</strong> FTIR, XPS;</li>
        <li><strong>Density/stress:</strong> Wafer bow, refractive index benchmarking;</li>
        <li><strong>Structural:</strong> Cross-section SEM/TEM (gap-fill, voids);</li>
        <li><strong>Electrical:</strong> CV, leakage, breakdown strength.</li>
      </ul>
      
      <h2>11) Common Issues & Troubleshooting</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Issue</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Possible Cause</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Quick Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Voids in trench</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Low bias, high pressure, low Ar</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Increase bias, lower pressure, add Ar, adjust source/bias ratio</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Excess stress/wafer bow</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">High ion energy, temp instability</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Lower bias, split deposition steps, improve electrode temp control</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Particles/rough surface</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Dirty chamber, insufficient cleans</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Increase cleaning, check liner wear</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>Refractive index/composition drift</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">MFC drift, unstable precursor</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Calibrate MFC, check TEOS heating/stability</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;"><strong>RF/matching instability</strong></td>
            <td style="border: 1px solid #ddd; padding: 12px;">Matching box/cable/ground issues</td>
            <td style="border: 1px solid #ddd; padding: 12px;">Inspect matching unit, RF cabling, grounding</td>
          </tr>
        </tbody>
      </table>
      
      <h2>12) NineScrolls HDP-CVD Highlights</h2>
      <ul>
        <li>Compact uni-body design (~1.0 m × 1.5 m footprint);</li>
        <li>Multi-material compatibility: Si, SiO₂, SiNₓ, SiON, SiC;</li>
        <li>RF Options: Source 1000–3000 W / Bias 300–1000 W;</li>
        <li>Electrode & liner temp control: Stress tuning, contamination control;</li>
        <li>Multi-zone gas lines: 6 standard, customizable;</li>
        <li>Wafer handling: Open-Load or Load-Lock;</li>
        <li>Excellent step coverage/gap-fill, tunable for stress & dielectric performance;</li>
        <li>Modular upgrades: Balance performance vs cost.</li>
             </ul>
       
       <div style="text-align: center; margin: 30px 0;">
         <img 
           src="/assets/images/insights/hdp-cvd-system-structure-optimized.webp" 
           alt="NineScrolls HDP-CVD System Modular Structure - Modular system architecture diagram showing chamber design, RF systems, gas delivery, and control modules" 
           style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
           loading="lazy"
         />
         <p style="margin-top: 10px; font-style: italic; color: #666; font-size: 0.9em;">Figure 3: NineScrolls HDP-CVD System Modular Structure - Showing chamber design, RF systems, gas delivery, and control modules</p>
       </div>
       
       <p><strong>Product page:</strong> <a href="/products/hdp-cvd" style="color: #007bff; text-decoration: none;">https://www.ninescrolls.com/products/hdp-cvd</a></p>
      
      <h2>13) Purchasing & Pilot Line Workflow</h2>
      <ol>
        <li>Define targets: CD/HAR, dielectric specs (σ, n/k, leakage);</li>
        <li>Facility check: Power, cooling, CDA, exhaust/abatement, gas cabinets;</li>
        <li>Configuration list: RF source/bias, temp, gas/precursors, handling;</li>
        <li>Test wafer plan: DOE design + metrology (SEM/FTIR/stress/electrical);</li>
        <li>Acceptance: Void-free fill, stress range, uniformity/repeatability, SPC;</li>
        <li>EHS/SOP: Hazard approval, operator/maintenance training, emergency response.</li>
      </ol>
      
      <h2>14) FAQ</h2>
      <p><strong>Q1: Will HDP-CVD damage devices due to plasma?</strong><br>
      A: Mitigate with lower bias, pulsed/segmented processes, soft-landing, grounding/shielding.</p>
      
      <p><strong>Q2: How does CoO compare to PECVD?</strong><br>
      A: Higher RF/chamber complexity, but better gap-fill and higher throughput make CoO competitive.</p>
      
      <p><strong>Q3: Is TEOS mandatory?</strong><br>
      A: No. SiH₄/O₂(/N₂O) gives higher rates but requires balance of H-content, stress, dielectric properties.</p>
      
      <p><strong>Q4: How to manage stress in multilayers?</strong><br>
      A: Alternate low/medium bias, gas ratio/temp tuning, plus anneal/plasma post-treatment.</p>
      
      <h2>15) Glossary</h2>
      <ul>
        <li><strong>HAR:</strong> High-Aspect-Ratio structure;</li>
        <li><strong>Gap-fill:</strong> Ability to fill voids/trenches;</li>
        <li><strong>ICP:</strong> Inductively Coupled Plasma;</li>
        <li><strong>Bias:</strong> Substrate bias power, controls ion energy;</li>
        <li><strong>TEOS:</strong> Tetraethyl Orthosilicate;</li>
        <li><strong>SPC:</strong> Statistical Process Control.</li>
      </ul>
      
      <h2>Call-to-Action</h2>
      <ul>
        <li>Need test recipes and DOE templates for your structures/materials? Contact our process team.</li>
        <li>Want configuration and budget recommendations? We provide facility checklist and tool selection guidance.</li>
      </ul>
      
      <p><strong>Contact:</strong><br>
      Product page: <a href="/products/hdp-cvd" style="color: #007bff; text-decoration: none;">https://www.ninescrolls.com/products/hdp-cvd</a> | Email: <a href="mailto:info@ninescrolls.com" style="color: #007bff; text-decoration: none;">info@ninescrolls.com</a> | Online technical consultation available</p>
    `,
    author: 'NineScrolls Team',
    publishDate: '2025-01-28',
    category: 'Materials Science',
    readTime: 15,
    imageUrl: '/assets/images/insights/hdp-cvd-guide-cover-optimized.webp',
    slug: 'hdp-cvd-in-depth-guide-practical-handbook',
    tags: ['HDP-CVD', 'High-Density Plasma', 'Chemical Vapor Deposition', 'Semiconductor Manufacturing', 'Thin Film Deposition', 'Gap-Fill Technology', 'Dielectric Films', 'Process Engineering', 'Equipment Selection', 'Cost of Ownership']
  },
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