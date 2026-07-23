import type { InsightsPost } from "../src/types";

// Centralized insights posts data to avoid duplication
export const insightsPosts: InsightsPost[] = [
  {
    id: '20',
    title: 'Reactive Ion Etching (RIE) – Principles, Applications, and Equipment Guide',
    excerpt: 'A complete guide to reactive ion etching (RIE): working principles, plasma physics, process control, system types (CCP/ICP/DRIE), gas chemistry selection, applications across semiconductor, MEMS & photonics, troubleshooting, and equipment selection. Includes FAQs, starter recipes, and links to ICP/RIE products.',
    // NOTE: Article body content lives in scripts/articles/reactive-ion-etching-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-28',
    category: 'Nanotechnology',
    readTime: 15,
    imageUrl: 'https://cdn.ninescrolls.com/insights/rie-cover.png',
    slug: 'reactive-ion-etching-guide',
    tags: ['reactive ion etching','RIE','plasma etching','ICP-RIE','DRIE','CCP-RIE','gas chemistry','process parameters','equipment selection','MEMS','semiconductor etching'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'General-purpose reactive ion etching for Si, SiO₂, polymers' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma for deep etching and III-V processing' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Space-efficient RIE for rapid prototyping and failure analysis' }
    ],
    articleType: 'TechArticle',
    faqs: [
      {
        question: 'When should I choose ICP-RIE over standard CCP-RIE?',
        answer: 'Choose ICP-RIE when you need (a) independent control of ion energy and plasma density, (b) high aspect ratio (>5:1) features, (c) low-damage etching for sensitive materials such as III-V, 2D materials, or photonics, or (d) high etch rates with good uniformity. CCP-RIE is sufficient for general-purpose dielectric/polymer etching, photoresist stripping, and applications where simplicity and cost matter more than ultimate performance.'
      },
      {
        question: 'How do I minimize plasma-induced damage?',
        answer: 'Use ICP-RIE to decouple ion energy from plasma density (keep bias low while maintaining adequate radical supply); enable pulsed bias at 10-50% duty cycle to reduce average ion energy; implement soft-landing by reducing bias power during the final 10-20% of etch time as you approach the stop layer; and consider a post-etch anneal (e.g., 400 °C in N2/H2) to recover lattice damage.'
      },
      {
        question: 'What endpoint detection method should I use for RIE?',
        answer: 'OES (Optical Emission Spectroscopy) is the most versatile — monitor a characteristic emission line of an etch by-product or reactant that changes when you reach the stop layer (e.g., SiF* at 777 nm drops when Si etch is complete). Laser interferometry is best for transparent film thickness monitoring (SiO2, SiNx). For blanket etches without clear optical signals, use a timed etch with a 10-20% safety over-etch.'
      },
      {
        question: 'Can RIE etch high-aspect-ratio features?',
        answer: 'Standard CCP-RIE achieves roughly 3:1 to 5:1 aspect ratio. ICP-RIE extends this to ~20:1 through higher plasma density and independent bias control. For extreme AR (>20:1, up to 50:1+), DRIE with the Bosch process — alternating etch and passivation cycles — is required. The key limiting factors are ion angular distribution, radical transport into the feature, and by-product removal.'
      },
      {
        question: 'How do I estimate RIE equipment cost and cost of ownership?',
        answer: 'Equipment cost ranges from ~$100K-200K for a basic CCP-RIE system to ~$300K-800K+ for a fully-loaded ICP-RIE with DRIE capability. CoO includes process gases (~$2K-10K/year), pump maintenance (~$3K-5K/year), consumables such as O-rings, clamp parts, and liners (~$2K-5K/year), and utilities (power, cooling water, CDA). For R&D labs running under 20 hours/week, CoO is typically $15K-30K/year excluding the capital cost.'
      }
    ]
  },
  {
    id: '21',
    title: 'Deep Reactive Ion Etching (DRIE): Bosch Process Guide for MEMS & TSV',
    excerpt: 'DRIE Bosch process explained: etch-passivation cycle tuning, scallop control techniques, MEMS/TSV applications, defects fixes & ICP-DRIE equipment notes.',
    // NOTE: Article body content lives in scripts/articles/deep-reactive-ion-etching-bosch-process.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-29',
    category: 'Nanotechnology',
    readTime: 18,
    imageUrl: 'https://cdn.ninescrolls.com/insights/drie-cover-lg.webp',
    slug: 'deep-reactive-ion-etching-bosch-process',
    tags: ['DRIE','Bosch process','reactive ion etching','MEMS','TSV','silicon etching','high aspect ratio','ICP-RIE','scalloping','ARDE'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'DRIE Bosch and cryogenic etching for MEMS and TSV' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Standard RIE for shallow trench and dielectric etching' }
    ],
    articleType: 'TechArticle',
    faqs: [
      {
        question: 'What is the Bosch process in DRIE?',
        answer: 'The Bosch process is a time-multiplexed deep reactive ion etch that alternates short SF6 etch steps with C4F8 passivation steps. The fluorocarbon film deposited during passivation protects sidewalls from lateral attack so subsequent etch cycles drive vertically into silicon, enabling aspect ratios well beyond what continuous-mode RIE can deliver.'
      },
      {
        question: 'How do you control scalloping in DRIE?',
        answer: 'Scallop amplitude is set primarily by etch step duration and ion energy. Shorter etch cycles (1-3 s instead of 5-8 s), reduced platen bias during the etch step, and higher passivation gas flow shrink scallops to under 50 nm. For sub-20 nm sidewall roughness, pulsed-bias Bosch or cryogenic DRIE is usually a better fit than aggressive cycle-time tuning.'
      },
      {
        question: 'What is the typical etch rate of Bosch DRIE for silicon?',
        answer: 'Standard Bosch recipes achieve 3-10 µm/min for silicon, with high-throughput recipes reaching 15-20 µm/min at the cost of slightly larger scallops and reduced selectivity. Etch rate scales with ICP power, SF6 flow, and chamber pressure, but high-AR features run slower due to ARDE (aspect-ratio-dependent etching).'
      },
      {
        question: 'Bosch DRIE vs cryogenic DRIE — which should I choose?',
        answer: 'Choose Bosch when you need batch-friendly room-temperature operation, high throughput, and well-understood recipes for MEMS or TSV. Choose cryogenic DRIE (substrate at -100 to -120 °C) when sidewall smoothness is critical (photonics, optical MEMS) or when aspect ratios exceed 50:1 — cryo eliminates scallops by suppressing lateral etch chemically rather than by passivation cycles. Cryo systems require LN2 infrastructure and tighter temperature control.'
      },
      {
        question: 'What are the most common DRIE defects and how do you fix them?',
        answer: 'The four recurring defects are (1) grass / black silicon from micromasking — fix with longer over-etch and chamber clean; (2) notching at the buried oxide of SOI wafers — switch to pulsed-bias mode; (3) ARDE with narrower features etching slower — compensate via mask CD bias or ramp-up of bias mid-recipe; and (4) excessive sidewall roughness — reduce etch cycle time and increase passivation step.'
      }
    ]
  },
  {
    id: '22',
    title: 'ICP‑RIE Technology – High‑Density Plasma for Advanced Etching',
    excerpt: 'How ICP differs from conventional RIE, benefits for deep/high‑aspect‑ratio etching, and typical materials (SiC/GaN).',
    // NOTE: Article body content lives in scripts/articles/icp-rie-technology-advanced-etching.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale, shorter copy — do NOT restore it. The empty
    // string ensures seed/update scripts never overwrite the live DDB content with a duplicate.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-29',
    category: 'Nanotechnology',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/icp-rie-cover-lg.webp',
    slug: 'icp-rie-technology-advanced-etching',
    tags: ['ICP','ICP-RIE','inductively coupled plasma etching'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density ICP-RIE for deep etching and III-V materials' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Conventional CCP-RIE for general-purpose etching' }
    ]
  },
  {
    id: '23',
    title: 'Reactive Ion Etching vs Ion Milling (IBE): Complete Comparison Guide',
    excerpt: 'Compare RIE vs Ion Milling (IBE): mechanisms, etch rate by material, anisotropy, selectivity, and decision framework. Includes DRIE & RIBE hybrid notes.',
    // NOTE: Article body content lives in scripts/articles/reactive-ion-etching-vs-ion-milling.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-29',
    category: 'Nanotechnology',
    readTime: 15,
    imageUrl: 'https://cdn.ninescrolls.com/insights/rie-vs-milling-cover-lg.webp',
    slug: 'reactive-ion-etching-vs-ion-milling',
    tags: ['reactive ion etching','ion milling','RIE vs ion milling','ion beam etching','IBE vs RIE','dry etching comparison','semiconductor etching techniques','plasma etching vs ion milling','microfabrication etching methods','DRIE','RIBE','deep reactive ion etching'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Chemical-dominant reactive ion etching' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma for deep and high-AR etching' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Physical ion beam etching for metals and complex materials' }
    ],
    articleType: 'TechArticle',
    faqs: [
      {
        question: 'Is ion beam milling anisotropic?',
        answer: 'Yes — ion beam milling (IBE) is highly anisotropic because the ion beam is collimated and arrives at the wafer with a tightly controlled angle (typically near-vertical, but tunable from 0° to 70°+ via a tiltable stage). Material removal happens almost exclusively along the ion trajectory, producing near-vertical sidewalls regardless of the substrate crystallography or chemistry.'
      },
      {
        question: "What's the etch rate difference between sputter etching and reactive ion etching?",
        answer: 'Sputter etching (purely physical, no reactive gas) typically runs at 5-50 nm/min depending on material, while RIE rates range from 50 nm/min up to several µm/min because reactive radicals form volatile byproducts that are pumped away. The gap is largest on materials with good chemical etch paths (Si, SiO2) and smallest on inert materials like noble metals where RIE loses its chemical advantage.'
      },
      {
        question: 'When should I choose IBE over RIE?',
        answer: 'Choose IBE when (1) your material has no good reactive chemistry — magnetics (Co, NiFe, MTJ stacks), noble metals (Pt, Au), or compounds like permanent magnets; (2) you need angular control for facet engineering or undercut shaping; or (3) the substrate is damage-sensitive and you can tolerate slower rates. Stay with RIE/ICP-RIE for production-throughput etching of Si, SiO2, Si3N4, III-V semiconductors, and most photoresist-masked patterning.'
      },
      {
        question: 'Can RIE etch metals?',
        answer: 'Some metals — Al, Ti, W, Mo, Ta — etch well in chlorine-based RIE plasmas (Cl2/BCl3) because they form volatile chlorides. Other metals (Au, Pt, Cu, Ni, Co, Fe) lack volatile etch products under typical RIE conditions and are usually patterned by ion milling, lift-off, or wet etch instead. Cu can be etched by some emerging plasma chemistries but is rarely done in production.'
      },
      {
        question: 'Is ion milling end-pointed?',
        answer: 'IBE end-point detection is harder than RIE because there are no chemical reaction products to monitor via OES. The standard approaches are SIMS (mass spectrometry of sputtered species, very accurate but adds tool cost), interferometry on transparent stacks, and time-based recipes calibrated against a witness wafer. For MTJ etching, SIMS-based end-point is the production standard.'
      }
    ]
  },
  {
    id: '24',
    title: 'Semiconductor Etchers – How to Choose the Right System for Your Lab',
    excerpt: 'Overview of etcher categories (RIE/ICP/DRIE), research vs production considerations, and NineScrolls etcher comparison.',
    // NOTE: Article body content lives in scripts/articles/semiconductor-etchers-overview.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-29',
    category: 'Nanotechnology',
    readTime: 10,
    imageUrl: 'https://cdn.ninescrolls.com/insights/etchers-overview-cover-lg.webp',
    slug: 'semiconductor-etchers-overview',
    tags: ['semiconductor etcher','plasma etcher','RIE','ICP'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma etching for advanced applications' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'General-purpose reactive ion etching' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: '50% smaller footprint for space-constrained labs' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Ion beam etching for metals and magnetic materials' }
    ]
  },
  {
    id: '14',
    title: 'HDP-CVD Process: Void-Free Gap-Fill Guide with Recipes & Equipment',
    excerpt: 'Complete HDP-CVD handbook: starter recipes, equipment selection checklist, PECVD/ALD comparison, troubleshooting & cost analysis.',
    // NOTE: Article body content lives in scripts/articles/hdp-cvd-in-depth-guide-practical-handbook.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-01-28',
    category: 'Materials Science',
    readTime: 15,
    imageUrl: 'https://cdn.ninescrolls.com/insights/hdp-cvd-guide-cover-optimized.webp',
    slug: 'hdp-cvd-in-depth-guide-practical-handbook',
    tags: ['HDP-CVD', 'High-Density Plasma', 'Chemical Vapor Deposition', 'Semiconductor Manufacturing', 'Thin Film Deposition', 'Gap-Fill Technology', 'Dielectric Films', 'Process Engineering', 'Equipment Selection', 'Cost of Ownership'],
    relatedProducts: [
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'High-density plasma CVD for void-free gap fill' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Plasma-enhanced CVD for dielectric and passivation films' }
    ],
    articleType: 'TechArticle',
    faqs: [
      {
        question: 'Will HDP-CVD damage devices due to plasma?',
        answer: 'Mitigate plasma-induced device damage with lower bias power, pulsed or segmented processes, soft-landing recipes, and proper grounding/shielding of the wafer chuck.'
      },
      {
        question: 'How does HDP-CVD cost of ownership compare to PECVD?',
        answer: 'HDP-CVD has higher RF and chamber complexity (and therefore higher capital cost), but its superior gap-fill capability and higher throughput on critical layers make CoO competitive — especially for high-aspect-ratio dielectric fill where PECVD would require multiple deposition/etch cycles.'
      },
      {
        question: 'Is TEOS mandatory for HDP-CVD oxide deposition?',
        answer: 'No. SiH4/O2 (with optional N2O) chemistry gives higher deposition rates than TEOS-based recipes, but requires careful balance of hydrogen content, film stress, and dielectric properties. TEOS is preferred when conformality and lower H content are critical.'
      },
      {
        question: 'How do you manage stress in HDP-CVD multilayer films?',
        answer: 'Alternate low and medium bias steps, tune gas ratio and substrate temperature, and apply post-deposition anneal or plasma post-treatment. Stress engineering is typically done at the recipe level by trading sputter component vs deposition component within each cycle.'
      },
      {
        question: 'How does HDP-CVD differ from remote (downstream) plasma CVD?',
        answer: 'In HDP-CVD the wafer sits inside a dense plasma and receives both radicals and a bias-controlled ion flux — enabling bottom-up gap-fill and dense films, at the cost of plasma-damage risk. In remote/downstream systems the plasma is generated away from the wafer and mostly neutral radicals arrive, giving damage-free but slower, non-gap-filling deposition. Pseudo-remote designs sit in between, with a reduced, tunable ion flux. Choose by whether the film needs ion bombardment (gap-fill, densification) or must avoid it (damage-sensitive devices).'
      }
    ]
  },
  {
    id: '16',
    title: 'Why Plasma is Non-Uniform in Etch Chambers and How to Solve It',
    excerpt: 'Comprehensive guide to plasma uniformity issues in etch chambers. Learn the causes, effects, and solutions for non-uniform plasma distribution in semiconductor manufacturing.',
    // NOTE: Article body content lives in scripts/articles/plasma-non-uniform-etch-chamber-solutions.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-08-19',
    category: 'Materials Science',
    readTime: 17,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-uniformity-cover.webp',
    slug: 'plasma-non-uniform-etch-chamber-solutions',
    tags: ['Plasma Etching', 'Plasma Uniformity', 'Etch Chamber', 'Semiconductor Manufacturing', 'Process Control', 'Equipment Optimization', 'Gas Flow Distribution', 'Temperature Gradient', 'Etch Rate Diagnostics'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Optimized gas distribution for uniform high-density plasma' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Engineered electrode design for etch uniformity' }
    ]
  },
  {
    id: '12',
    title: 'Plasma Etching Explained: From Fundamentals to Applications',
    excerpt: 'A comprehensive guide to plasma etching fundamentals, covering ion etching, chemical plasma etching, and reactive ion etching (RIE) with applications in semiconductor manufacturing.',
    // NOTE: Article body content lives in scripts/articles/plasma-etching-explained-fundamentals-applications.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-01-26',
    category: 'Materials Science',
    readTime: 15,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-etching-fundamentals-cover-optimized.png',
    slug: 'plasma-etching-explained-fundamentals-applications',
    tags: ['Plasma Etching', 'Semiconductor Manufacturing', 'Materials Science', 'RIE', 'ICP-RIE', 'Microfabrication'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'General-purpose reactive ion etching' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma for advanced etching' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Space-efficient RIE for smaller labs' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Plasma stripping and resist removal' }
    ]
  },
  {
    id: '11',
    title: 'RIE vs ICP-RIE vs PE: Plasma Etching Comparison',
    excerpt: 'PE, RIE, and ICP-RIE compared with real process data — etch rates, gas chemistries, Bosch process, common etch defects, and endpoint detection. A practical guide for choosing the right plasma etching technology.',
    // NOTE: Article body content lives in scripts/articles/understanding-differences-pe-rie-icp-rie-plasma-etching.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-01-25',
    category: 'Materials Science',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/future-of-plasma-etching-cover-lg.webp',
    slug: 'understanding-differences-pe-rie-icp-rie-plasma-etching',
    faqs: [
      {
        question: 'What is the main difference between RIE and ICP-RIE?',
        answer: 'The fundamental difference is parameter coupling. In RIE (a capacitively coupled plasma system), plasma density and ion energy are controlled by a single RF source — increasing power raises both simultaneously. ICP-RIE uses two separate RF sources: an ICP coil for plasma generation and an independent RF bias for ion energy. This decoupled architecture allows you to achieve high etch rates (from high plasma density) with low damage (from low bias power) — a combination that is impossible in conventional RIE.'
      },
      {
        question: 'When should I use the Bosch process instead of continuous etching?',
        answer: 'The Bosch (time-multiplexed) process is preferred when you need deep, high-aspect-ratio features in silicon (typically &gt; 10 µm depth and &gt; 10:1 aspect ratio). Continuous etching with simultaneous etch/passivation gases (e.g., SF₆/C₄F₈ mixed) produces smoother sidewalls but is limited to lower aspect ratios. If sidewall scalloping is unacceptable (e.g., for optical applications), consider cryogenic etching as an alternative.'
      },
      {
        question: 'What gases are most commonly used in plasma etching?',
        answer: 'The choice depends on the target material: SF₆ and CF₄ for silicon; CHF₃ and C₄F₈ for SiO₂ and Si₃N₄; Cl₂/BCl₃ for metals (Al) and III-V semiconductors; O₂ for photoresist stripping and organic materials. Additives like Ar improve bombardment, while O₂ or H₂ tune selectivity by modifying the fluorocarbon polymer chemistry.'
      },
      {
        question: 'How do I reduce etch damage to sensitive devices?',
        answer: 'Use ICP-RIE with low RF bias power (or zero bias for purely chemical etching at high density). Pulsed plasma techniques — where RF power is modulated at 1–10 kHz — can further reduce ion energy spread and charge-induced damage. For the most damage-sensitive applications (quantum devices, photonic crystals), downstream PE may be appropriate. See our article on Atomic Layer Etching for the ultimate in damage-free processing.'
      },
      {
        question: 'Can I etch multiple materials in one chamber?',
        answer: 'Yes, with proper gas and process switching. ICP-RIE systems with multiple mass flow controllers (typically 4–8 gas lines) and automated recipe management can handle silicon, dielectrics, metals, and III-V materials. Cross-contamination can be managed with chamber conditioning steps between processes. NineScrolls systems support multiple process design kits for this purpose.'
      },
      {
        question: 'How does ICP source power affect ion density and etch rate?',
        answer: 'Source power heats plasma electrons through inductive coupling, so ion density scales roughly linearly with source power over most of the operating range &mdash; while ion energy stays nearly constant, since it is set independently by the bias supply. Two non-idealities matter in practice: at low power the discharge sits in capacitive E-mode and jumps abruptly in density when it transitions to inductive H-mode, and at high power density growth saturates as wall losses and neutral gas depletion take over. Etch rate follows the same pattern &mdash; near-linear, then plateau &mdash; so characterize an etch-rate-vs-power curve and operate on the linear portion, using bias power (not source power) to tune anisotropy and damage.'
      }
    ],
    tags: ['Plasma Etching', 'PE', 'RIE', 'ICP-RIE', 'Semiconductor Manufacturing', 'Etching Technology', 'Bosch Process', 'DRIE', 'ICP Etching'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'CCP-RIE for dielectric and polymer etching' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE for high-density plasma etching and DRIE' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective RIE for R&D and failure analysis' }
    ]
  },
  {
    id: '1',
    title: 'Advanced Materials Processing: From Nanotechnology to Energy Applications',
    excerpt: 'Practical guide to thin-film deposition, plasma etching, and surface engineering for advanced materials — covering energy storage coatings, catalytic surfaces, protective barriers, nanostructured devices, and flexible electronics with specific process recipes, equipment parameters, and material-by-material comparisons.',
    // NOTE: Article body content lives in scripts/articles/advanced-materials-processing-nanotechnology-energy.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2024-01-15',
    category: 'Materials Science',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/advanced-materials.jpg',
    slug: 'advanced-materials-processing-nanotechnology-energy',
    tags: ['Advanced Materials', 'Nanotechnology', 'Energy Storage', 'Thin Film Deposition', 'ALD', 'PECVD', 'Sputtering', 'Surface Engineering', 'Battery Materials', 'Catalysis'],
    relatedProducts: [
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Atomic-scale conformal coatings for batteries, catalysis, and nanostructures' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Functional coatings: SiNₓ ARC, DLC wear coatings, SiO₂ barriers' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Metal/alloy films, TCOs, reactive sputtering of compounds' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Nanostructure fabrication: nanopillars, nanopores, surface texturing' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Polymer etching, dielectric patterning, and general-purpose RIE' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective O₂/CF₄/Ar etching for materials research labs' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface activation, wettability control, and pre-deposition cleaning' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'Void-free gap fill for 3D structures and advanced packaging' }
    ]
  },
  {
    id: '2',
    title: 'Photonics Manufacturing: Precision Engineering for Optical Devices',
    excerpt: 'Process-focused guide to photonic device fabrication — silicon and SiN waveguide etching recipes, optical coating deposition parameters, grating and photonic crystal patterning, metasurface fabrication, and integrated photonic circuit process flows with specific equipment parameters and surface quality requirements.',
    // NOTE: Article body content lives in scripts/articles/photonics-manufacturing-precision-engineering.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2024-01-10',
    category: 'Photonics',
    readTime: 24,
    imageUrl: 'https://cdn.ninescrolls.com/insights/photonics-manufacturing.jpg',
    slug: 'photonics-manufacturing-precision-engineering',
    tags: ['Photonics', 'Silicon Photonics', 'Optical Coatings', 'Waveguides', 'ICP-RIE', 'Photonic Crystals', 'Metasurfaces', 'SiN', 'DBR', 'Integrated Photonics'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Low-bias ICP-RIE for waveguides, gratings, and photonic crystals' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Dielectric etch for via opening and cladding patterning' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'SiN waveguide cores, SiO₂ cladding, a-Si metasurface films' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Precision AR coatings, DBR mirrors, and optical filter stacks' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'Void-free SiO₂ gap fill around waveguide ridges' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Metal mirrors (Au, Ag, Al), electrodes, and TCO films' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'III-V and metal nanostructure etching for active photonic devices' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Low-LER resist processing for photonic lithography' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Clean resist removal after waveguide and grating etching' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Pre-deposition surface activation and post-etch cleaning' }
    ]
  },
  {
    id: '3',
    title: 'Nanofabrication Techniques: Building the Nanoscale Future',
    excerpt: 'Practical nanofabrication guide with specific process recipes: e-beam resist selection and dose optimization, RIE/ICP-RIE etch recipes for Si, SiO\u2082, and metals, liftoff metallization with bilayer resists, nanoimprint lithography parameters, and directed self-assembly for sub-20 nm features.',
    // NOTE: Article body content lives in scripts/articles/nanofabrication-techniques-nanoscale-future.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2024-01-08',
    category: 'Nanotechnology',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/nanofabrication.jpg',
    slug: 'nanofabrication-techniques-nanoscale-future',
    tags: ['nanofabrication', 'e-beam lithography', 'nanoimprint lithography', 'liftoff metallization', 'block copolymer DSA', 'plasma etching', 'ICP-RIE', 'HSQ resist', 'PMMA resist', 'pattern transfer', 'nanostructures', 'process recipes'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma for nanowires, photonic crystals, and deep nanostructure etching' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Hardmask opening, residual layer removal, and general nanoscale pattern transfer' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Quick-turnaround resist descum and thin-film prototyping etch' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Sub-nm conformal Al\u2082O\u2083 and HfO\u2082 hardmasks for deep nanoscale etching' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Cr, Ti, and metal adhesion/seed layers for liftoff and hardmask processes' },
      { href: '/products/coater-developer', label: 'Coater/Developer', subtitle: 'Programmable spin coating and development for e-beam and NIL resists' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Physical ion beam etching for noble metals (Au, Pt) and magnetic stacks' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaner', subtitle: 'O\u2082/Ar pre-clean for adhesion promotion and organic contamination removal' }
    ]
  },
  {
    id: '6',
    title: 'Fuel Cell Technology: Powering the Hydrogen Economy',
    excerpt: 'Practical guide to thin-film and plasma processing for fuel cell components: sputtered Pt and Pt-alloy catalyst layers with specific DC power, pressure, and thickness parameters; GDL plasma treatment recipes for water management; bipolar plate coatings (TiN, CrN, a-C) with corrosion and contact resistance data; SOFC electrolyte/electrode films by ALD and PECVD; and PEM electrolyzer catalyst deposition by reactive sputtering.',
    // NOTE: Article body content lives in scripts/articles/fuel-cell-technology-hydrogen-economy.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2024-01-20',
    category: 'Energy',
    readTime: 21,
    imageUrl: 'https://cdn.ninescrolls.com/insights/fuel-cells.jpg',
    slug: 'fuel-cell-technology-hydrogen-economy',
    tags: ['Fuel Cells', 'Hydrogen Economy', 'PEM Fuel Cell', 'SOFC', 'Sputter Deposition', 'Catalyst Layer', 'Bipolar Plate Coating', 'PEM Electrolyzer', 'Thin Film Processing'],
    relatedProducts: [
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Pt catalyst layers, bipolar plate coatings, and electrolyzer anode films' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Pinhole-free YSZ and GDC electrolytes for intermediate-temperature SOFCs' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Fluorocarbon GDL coatings and SOFC interlayer deposition' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'GDL wettability tuning and membrane surface activation' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Bipolar plate flow field patterning and GDL etch-back' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-aspect-ratio flow channel etching in metallic bipolar plates' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Microporous layer modification and surface treatment' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'Amorphous carbon coatings for bipolar plate corrosion protection' }
    ]
  },
  {
    id: '10',
    title: 'Solar Cell Manufacturing: Renewable Energy Solutions',
    excerpt: 'Complete solar cell fabrication guide covering c-Si surface texturing (KOH wet etch and ICP-RIE black silicon), PECVD SiNx anti-reflection coatings, ALD Al2O3 rear passivation, perovskite thin-film stack deposition, CIGS/CdTe sputter processes, and perovskite/Si tandem integration. Includes process parameter tables, equipment selection, troubleshooting, and FAQs.',
    // NOTE: Article body content lives in scripts/articles/solar-cell-manufacturing-renewable-energy.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2024-01-12',
    category: 'Energy',
    readTime: 21,
    imageUrl: 'https://cdn.ninescrolls.com/insights/solar-cells.jpg',
    slug: 'solar-cell-manufacturing-renewable-energy',
    tags: ['Solar Cells', 'PECVD', 'ALD', 'Sputtering', 'Photovoltaics', 'Perovskite', 'CIGS', 'CdTe', 'Tandem Solar Cell', 'Silicon Nitride', 'Anti-Reflection Coating', 'Surface Passivation', 'ICP-RIE', 'Black Silicon', 'Thin Film Deposition'],
    relatedProducts: [
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'SiNx anti-reflection coatings, a-Si:H passivation, poly-Si for TOPCon' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Al2O3 rear passivation, SnO2 ETL, tunnel oxide for TOPCon/tandem' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'ITO/AZO TCO electrodes, Mo back contact, CIGS/CdTe absorber precursors' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Black silicon nanostructuring, III-V mesa isolation' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Edge isolation, selective emitter patterning, contact layer removal' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Substrate cleaning, surface activation for wafer bonding' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective etching for solar R&D labs' },
      { href: '/products/coater-developer', label: 'Coater/Developer', subtitle: 'Perovskite spin coating, photoresist patterning' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Photoresist removal, post-etch surface cleaning' }
    ]
  },
  {
    id: '26',
    title: 'Future of Plasma Etching for Microelectronics \u2014 Key Trends and Roadmap',
    excerpt: 'A comprehensive look at the technologies shaping next-generation plasma etching \u2014 atomic layer etching (ALE), pulsed plasma techniques, high aspect ratio etch, low-damage processing for sensitive materials, cryogenic etching, and AI-assisted process control \u2014 with quantitative benchmarks and practical adoption guidance for sub-3 nm nodes and beyond.',
    // NOTE: Article body content lives in scripts/articles/future-of-plasma-etching-microelectronics.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-09-08',
    category: 'Nanotechnology',
    readTime: 18,
    imageUrl: 'https://cdn.ninescrolls.com/insights/future-of-plasma-etching-cover-lg.webp',
    slug: 'future-of-plasma-etching-microelectronics',
    tags: ['plasma etching','ALE','atomic layer etching','pulsed plasma','pulsed plasma etching','low-damage etch','EUV','HAR','high aspect ratio etch','cryogenic etching','AI process control','semiconductor etching','3D NAND etching','microelectronics','ICP-RIE'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Next-gen ICP-RIE for ALE, cryogenic, and HAR etching' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Versatile RIE for advanced process development' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Rapid prototyping for emerging etch processes' }
    ]
  },
  {
    id: '27',
    title: 'Advancing Dry Etching of Thermoelectric Films: Insights from CH₄/H₂/Ar Plasma Optimization for Bi₂Te₂.₇Se₀.₃ Microstructures',
    excerpt: 'A systematic investigation into dry etching behavior of n-type Bi₂Te₂.₇Se₀.₃ films using CH₄/H₂/Ar plasma. This study reveals the synergistic roles of each gas component and provides optimal process parameters for high-aspect-ratio thermoelectric device fabrication.',
    // NOTE: Article body content lives in scripts/articles/dry-etching-thermoelectric-films-ch4-h2-ar-plasma-optimization.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-11-13',
    category: 'Materials Science',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/thermoelectric-dry-etching-cover-lg.webp',
    slug: 'dry-etching-thermoelectric-films-ch4-h2-ar-plasma-optimization',
    tags: ['thermoelectric', 'dry etching', 'plasma etching', 'Bi2Te3', 'MEMS', 'CH4/H2/Ar', 'microfabrication', 'materials science'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'CH₄/H₂/Ar plasma etching for thermoelectric films' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma for advanced material etching' }
    ]
  },
  {
    id: 'plasma-cleaner-comparison',
    title: 'Plasma Cleaner Comparison for Research Laboratories',
    excerpt: 'How to choose the right plasma cleaner for academic & institutional labs. Compare quartz vs stainless steel chambers, RF vs mid-frequency, and batch plasma cleaner selection guide.',
    // NOTE: Article body content lives in scripts/articles/plasma-cleaner-comparison-research-labs.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-01-15',
    category: 'Materials Science',
    readTime: 8,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-cleaner-comparison-cover-lg.png',
    slug: 'plasma-cleaner-comparison-research-labs',
    tags: ['plasma cleaner comparison', 'plasma cleaner for research laboratories', 'RF plasma cleaner vs quartz plasma cleaner', 'batch plasma cleaner academic lab', 'research grade plasma cleaner', 'plasma cleaning', 'surface activation'],
    relatedProducts: [
      { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: '500W RF flagship plasma cleaner (~14.5L)' },
      { href: '/products/pluto-m', label: 'PLUTO-M', subtitle: '200W RF mid-range plasma cleaner (~8L)' },
      { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: '200W RF compact plasma cleaner (~4.3L)' },
      { href: '/products/hy-20lrf', label: 'HY-20LRF', subtitle: '300W RF research-grade batch cleaner (20L)' },
      { href: '/products/hy-20l', label: 'HY-20L', subtitle: 'RF/MF batch plasma cleaner (20L)' },
      { href: '/products/hy-4l', label: 'HY-4L', subtitle: 'Compact RF/MF plasma cleaner (~4L)' }
    ]
  },
  {
    id: '28',
    title: 'What Is a Plasma Cleaner? Principles, Types, and How It Works',
    excerpt: 'A comprehensive guide to plasma cleaning technology — how it works, the key cleaning mechanisms (chemical etching, sputtering, UV photodissociation), and a detailed comparison of RF, DC, and microwave plasma cleaners to help you understand which type fits your application.',
    // NOTE: Article body content lives in scripts/articles/what-is-plasma-cleaner-principles-types.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-10',
    category: 'Materials Science',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-cleaner-principles-cover.svg',
    slug: 'what-is-plasma-cleaner-principles-types',
    tags: ['plasma cleaner', 'plasma cleaning', 'RF plasma', 'DC plasma', 'microwave plasma', 'surface preparation', 'vacuum plasma', 'plasma cleaning principles'],
    relatedProducts: [
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners Overview', subtitle: 'Compare PLUTO and HY series plasma cleaners' },
      { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: '200W RF compact plasma cleaner' },
      { href: '/products/hy-4l', label: 'HY-4L', subtitle: 'Compact RF/MF plasma cleaner' }
    ]
  },
  {
    id: '29',
    title: 'Plasma Cleaner Applications: From Semiconductor Fabrication to Biomedical Devices',
    excerpt: 'Explore the major application areas of plasma cleaning technology — semiconductor and microelectronics, medical devices, optics and display manufacturing, automotive, aerospace, materials science research, and polymer treatment.',
    // NOTE: Article body content lives in scripts/articles/plasma-cleaner-applications-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-12',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-cleaner-applications-cover.svg',
    slug: 'plasma-cleaner-applications-guide',
    tags: ['plasma cleaner', 'plasma cleaning applications', 'semiconductor cleaning', 'medical device', 'surface treatment', 'wire bonding', 'microfluidics', 'PDMS bonding', 'TEM sample preparation'],
    relatedProducts: [
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners Overview', subtitle: 'PLUTO and HY series for all cleaning applications' },
      { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: '500W flagship for demanding applications' },
      { href: '/products/hy-20l', label: 'HY-20L', subtitle: 'Batch processing for multi-sample workflows' }
    ]
  },
  {
    id: '30',
    title: 'How to Choose the Right Plasma Cleaner: A Complete Buying Guide',
    excerpt: 'A step-by-step guide to selecting the right plasma cleaner for your lab or production line — covering cleaning requirements, plasma source types, chamber sizing, vacuum systems, process control, and total cost of ownership.',
    // NOTE: Article body content lives in scripts/articles/plasma-cleaner-buying-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-15',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-cleaner-buying-guide-cover.svg',
    slug: 'plasma-cleaner-buying-guide',
    tags: ['plasma cleaner', 'buying guide', 'plasma cleaner selection', 'vacuum system', 'RF plasma cleaner', 'chamber size', 'process control', 'total cost of ownership'],
    relatedProducts: [
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners Overview', subtitle: 'Compare all models side by side' },
      { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: '500W RF flagship (~14.5L), $15,999' },
      { href: '/products/pluto-m', label: 'PLUTO-M', subtitle: '200W RF mid-range (~8L), $12,999' },
      { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: '200W RF compact (~4.3L), $9,999' },
      { href: '/products/hy-20lrf', label: 'HY-20LRF', subtitle: '300W RF batch (20L), $14,499' },
      { href: '/products/hy-20l', label: 'HY-20L', subtitle: 'RF/MF batch (20L), from $11,999' },
      { href: '/products/hy-4l', label: 'HY-4L', subtitle: 'Compact RF/MF (~4L), from $6,499' }
    ]
  },
  {
    id: '31',
    title: 'RIE-150 Enables Nanoforest Fabrication for Environment-Powered Soft Actuators',
    excerpt: 'Published in ACS Applied Nano Materials (Feb 2026): RIE-150 oxygen plasma etching creates nanoforest structures enabling dual-mode soft actuators with record humidity response (23.06°/s) and 85% broadband absorption.',
    // NOTE: Article body content lives in scripts/articles/rie150-nanoforest-soft-actuator.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-28',
    category: 'Publication Spotlight',
    readTime: 6,
    imageUrl: 'https://cdn.ninescrolls.com/insights/rie150-soft-actuator-cover.png',
    slug: 'rie150-nanoforest-soft-actuator',
    tags: ['RIE-150', 'reactive ion etching', 'nanoforest', 'soft actuator', 'humidity sensor', 'photothermal', 'ACS Applied Nano Materials', 'publication spotlight'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'RIE-150 used in this research for O₂ plasma nanoforest fabrication' }
    ]
  },
  {
    id: '32',
    title: 'PECVD-150LL & ICP-100 Enable Record-Speed PtSe₂/Si Photodetector',
    excerpt: 'Published in Applied Surface Science (Feb 2026): PECVD-150LL and ICP-100 enable a CMOS-compatible PtSe₂/Si photodetector with record 260 kHz bandwidth, 80 dB dynamic range, and polarization-encoded optical communication.',
    // NOTE: Article body content lives in scripts/articles/pecvd-icp-ptse2-photodetector.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-28',
    category: 'Publication Spotlight',
    readTime: 7,
    imageUrl: 'https://cdn.ninescrolls.com/insights/pecvd-icp-photodetector-cover.png',
    slug: 'pecvd-icp-ptse2-photodetector',
    tags: ['PECVD-150LL', 'ICP-100', 'photodetector', 'PtSe2', 'broadband', 'polarization', 'Applied Surface Science', 'publication spotlight'],
    relatedProducts: [
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'PECVD-150LL used for PtSe₂ film growth in this research' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-100 used for device mesa etching' }
    ]
  },
  {
    id: '33',
    title: 'RIE-150A Enables On-Chip Metasurface Color Router',
    excerpt: 'Published in Light: Science & Applications (Nature portfolio, 2026): RIE-150A precision etching enables an on-chip q-BIC metasurface color router with near-unity energy utilization efficiency and ~20 nm narrowband extraction.',
    // NOTE: Article body content lives in scripts/articles/rie150a-metasurface-color-router.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-01-12',
    category: 'Publication Spotlight',
    readTime: 6,
    imageUrl: 'https://cdn.ninescrolls.com/insights/rie150a-color-router-cover.png',
    slug: 'rie150a-metasurface-color-router',
    tags: ['RIE-150A', 'reactive ion etching', 'metasurface', 'color router', 'q-BIC', 'photonics', 'Light Science Applications', 'publication spotlight'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'RIE-150A used for precision Si₃N₄ metasurface etching' }
    ]
  },
  {
    id: '34',
    title: 'ICP-200 Powers Metasurface Flow Visualization',
    excerpt: 'Published in Light: Science & Applications (Nature portfolio, 2025, 3 citations): ICP-200 fabricates silicon nanopillars enabling the first fully non-invasive 2D quantitative visualization of transparent flow fields.',
    // NOTE: Article body content lives in scripts/articles/icp200-metasurface-flow-visualization.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-03-05',
    category: 'Publication Spotlight',
    readTime: 6,
    imageUrl: 'https://cdn.ninescrolls.com/insights/icp200-flow-visualization-cover.png',
    slug: 'icp200-metasurface-flow-visualization',
    tags: ['ICP-200', 'ICP etching', 'metasurface', 'flow visualization', 'silicon nanopillars', 'photonics', 'Light Science Applications', 'publication spotlight'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-200 used for silicon nanopillar metasurface fabrication' }
    ]
  },
  {
    id: '35',
    title: 'Atomic Layer Etching (ALE): A Practical Guide for Research and Development',
    excerpt: 'A comprehensive guide to Atomic Layer Etching: self-limiting cyclic processes, ALE energy windows, core chemistries for Si/SiO\u2082/III-V/metals, ICP-RIE implementation, optimization challenges, and emerging frontiers including cryogenic and area-selective ALE.',
    // NOTE: Article body content lives in scripts/articles/atomic-layer-etching-practical-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-10-15',
    category: 'Nanotechnology',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/ale-guide-cover.png',
    slug: 'atomic-layer-etching-practical-guide',
    tags: ['ALE', 'atomic layer etching', 'ICP-RIE', 'self-limiting etch', 'plasma etching', 'nanotechnology', 'semiconductor', 'precision etching', 'cryogenic ALE', 'area-selective ALE'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE platform for ALE process implementation' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'CCP-RIE for thermal ALE and surface modification steps' }
    ]
  },
  {
    id: '36',
    title: 'Cryogenic Plasma Etching vs. Bosch Process: Choosing the Right Approach for High-Aspect-Ratio Structures',
    excerpt: 'An in-depth comparison of cryogenic plasma etching and the Bosch process for high-aspect-ratio silicon etching. Covers sidewall smoothness, aspect ratio capability, process gases, equipment requirements, retrofit options, and emerging hybrid approaches for MEMS, photonics, and quantum device fabrication.',
    // NOTE: Article body content lives in scripts/articles/cryogenic-etching-vs-bosch-process.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-11-05',
    category: 'Nanotechnology',
    readTime: 19,
    imageUrl: 'https://cdn.ninescrolls.com/insights/cryo-vs-bosch-cover.png',
    slug: 'cryogenic-etching-vs-bosch-process',
    tags: ['cryogenic etching', 'Bosch process', 'DRIE', 'ICP-RIE', 'high-aspect-ratio', 'MEMS', 'silicon etching', 'photonics', 'quantum devices', 'sidewall smoothness'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE with cryo-cooling for both Bosch and cryogenic DRIE' }
    ]
  },
  {
    id: '37',
    title: 'Machine Learning for Plasma Etch Optimization: How AI Is Transforming Process Development',
    excerpt: 'A practical guide to applying machine learning in plasma etch process development. Covers Bayesian optimization for recipe tuning, virtual metrology with OES data, ML-enhanced endpoint detection, digital twins, predictive maintenance, and a step-by-step workflow with Python code examples for research labs.',
    // NOTE: Article body content lives in scripts/articles/machine-learning-plasma-etch-optimization.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2025-12-10',
    category: 'Nanotechnology',
    readTime: 23,
    imageUrl: 'https://cdn.ninescrolls.com/insights/ml-plasma-etch-cover.png',
    slug: 'machine-learning-plasma-etch-optimization',
    tags: ['machine learning', 'AI', 'plasma etching', 'Bayesian optimization', 'virtual metrology', 'OES', 'ICP-RIE', 'process optimization', 'digital twin', 'predictive maintenance'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE with OES for ML-driven process optimization' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'RIE with process data logging for ML integration' }
    ]
  },
  {
    id: '38',
    title: 'Etching Beyond Silicon: Plasma Processing Challenges for Emerging Semiconductor Materials',
    excerpt: 'A comprehensive guide to plasma etching of emerging semiconductor materials including SiC, GaN, 2D materials (MoS\u2082), high-k dielectrics (HfO\u2082, ZrO\u2082), interconnect metals (Ru, Co, Mo), and ferroelectrics (HZO, PZT). Covers surface chemistry fundamentals, recommended etch chemistries, selectivity strategies, damage mitigation, and practical troubleshooting for researchers developing processes on ICP-RIE systems.',
    // NOTE: Article body content lives in scripts/articles/etching-beyond-silicon-new-materials.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-01-20',
    category: 'Materials Science',
    readTime: 24,
    imageUrl: 'https://cdn.ninescrolls.com/insights/etching-new-materials-cover.png',
    slug: 'etching-beyond-silicon-new-materials',
    tags: ['SiC', 'GaN', '2D materials', 'MoS2', 'HfO2', 'high-k dielectrics', 'ruthenium', 'ferroelectric', 'ICP-RIE', 'plasma etching'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE for SiC, GaN, 2D materials, and high-k dielectrics' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'RIE for polymer and dielectric patterning' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Ion beam etching for metals and non-volatile etch products' }
    ]
  },
  {
    id: '39',
    title: 'The Selectivity Challenge: Achieving Ultra-High Etch Selectivity in Modern Plasma Processes',
    excerpt: 'A comprehensive guide to etch selectivity in plasma processing \u2014 covering selectivity physics (chemical, ion-energy, passivation, temperature mechanisms), seven practical strategies for improving selectivity (gas chemistry, bias reduction, pressure tuning, pulsed plasma, ALE, temperature, multi-step), five detailed case studies (Si\u2083N\u2084/SiO\u2082 for 3D NAND, GaN/AlGaN for HEMTs, SiGe/Si for GAA, MEMS release, photonic waveguides), current limitations (ARDE, chamber aging, blanket vs. patterned gaps), and emerging trends (EUV, BPDN, area-selective deposition, atomic-precision processing).',
    // NOTE: Article body content lives in scripts/articles/ultra-high-etch-selectivity.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-02-25',
    category: 'Materials Science',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/etch-selectivity-cover.png',
    slug: 'ultra-high-etch-selectivity',
    tags: ['etch selectivity', 'ICP-RIE', 'ALE', 'pulsed plasma', '3D NAND', 'GAA', 'HEMT', 'MEMS', 'silicon photonics', 'fluorocarbon'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'ICP-RIE with pulsed plasma for ultra-high selectivity' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'CCP-RIE for selectivity-critical dielectric etching' }
    ]
  },
  {
    id: '40',
    title: 'Plasma Cleaner Maintenance Guide: Chamber Cleaning, Electrode Refurbishment & Preventive Schedules',
    excerpt: 'A practical guide to plasma cleaner maintenance covering daily through annual preventive schedules, step-by-step electrode refurbishment with chemical cleaning procedures, chamber cleaning best practices, vacuum system upkeep, and the three pillars of plasma system maintenance. Includes safety warnings, troubleshooting tips, and downloadable maintenance schedule diagrams.',
    // NOTE: Article body content lives in scripts/articles/plasma-cleaner-maintenance-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-26',
    category: 'Equipment Maintenance',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/plasma-maintenance-cover.png',
    slug: 'plasma-cleaner-maintenance-guide',
    tags: ['plasma cleaner', 'maintenance', 'electrode refurbishment', 'chamber cleaning', 'vacuum system', 'preventive maintenance', 'equipment care', 'plasma cleaning', 'O-ring replacement', 'RF power'],
    relatedProducts: [
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners Overview', subtitle: 'All PLUTO and HY series plasma cleaners' },
      { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: '500W RF flagship with aluminum alloy chamber' },
      { href: '/products/hy-20lrf', label: 'HY-20LRF', subtitle: '300W RF research-grade batch cleaner' }
    ]
  },
  {
    id: '44',
    title: 'Spin Coating & Development: A Complete Guide to Photoresist Processing',
    excerpt: 'A comprehensive guide to spin coating and development for photolithography: film thickness physics, the complete lithography process flow, key process parameters (spin speed, acceleration, bake temperatures, humidity), photoresist selection (positive vs negative, DNQ, SU-8, PMMA, AZ series), development optimization (puddle vs spray), troubleshooting common defects, and equipment selection. Includes FAQs and links to NineScrolls coater/developer products.',
    // NOTE: Article body content lives in scripts/articles/spin-coating-development-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-27',
    category: 'Nanotechnology',
    readTime: 16,
    imageUrl: 'https://cdn.ninescrolls.com/insights/coater-developer-guide-cover.png',
    slug: 'spin-coating-development-guide',
    tags: ['spin coating', 'photoresist', 'photolithography', 'development', 'coater developer', 'film thickness', 'HMDS', 'SU-8', 'edge bead removal', 'process optimization', 'wafer processing', 'semiconductor fabrication'],
    relatedProducts: [
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Automated spin coating and development track systems' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Photoresist removal after pattern transfer' }
    ]
  },
{
    id: '41',
    title: 'Atomic Layer Deposition (ALD) – Principles, Process Windows, Materials, and Equipment Guide',
    excerpt: 'A comprehensive guide to atomic layer deposition (ALD): self-limiting surface chemistry, thermal vs plasma-enhanced ALD, temperature windows, precursor selection, growth rates, key applications in semiconductors, MEMS, energy storage, and optics. Includes ALD vs CVD/PVD comparison, process optimization tips, troubleshooting, and equipment selection criteria with FAQs.',
    // NOTE: Article body content lives in scripts/articles/atomic-layer-deposition-ald-comprehensive-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-27',
    category: 'Materials Science',
    readTime: 18,
    imageUrl: 'https://cdn.ninescrolls.com/insights/ald-guide-cover.png',
    slug: 'atomic-layer-deposition-ald-comprehensive-guide',
    tags: ['ALD', 'atomic layer deposition', 'PEALD', 'thin film deposition', 'semiconductor', 'high-k dielectrics', 'MEMS passivation', 'precursor chemistry', 'conformal coating', 'ALD temperature window', 'HfO2', 'Al2O3']
  },
{
    id: '42',
    title: 'Magnetron Sputtering – Principles, Process Parameters, and Equipment Guide',
    excerpt: 'A comprehensive guide to magnetron sputtering: working principles, DC vs RF modes, reactive sputtering for oxides and nitrides, key process parameters, material selection, film quality optimization, and equipment selection for 4" to 12" wafer platforms. Includes comparison tables, FAQs, and links to NineScrolls sputter systems.',
    // NOTE: Article body content lives in scripts/articles/magnetron-sputtering-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-27',
    category: 'Materials Science',
    readTime: 18,
    imageUrl: 'https://cdn.ninescrolls.com/insights/sputter-guide-cover.png',
    slug: 'magnetron-sputtering-guide',
    tags: ['magnetron sputtering', 'PVD', 'thin film deposition', 'DC sputtering', 'RF sputtering', 'reactive sputtering', 'film uniformity', 'sputter target', 'vacuum deposition', 'semiconductor fabrication', 'materials science']
  },
{
    id: '43',
    title: 'PECVD Complete Guide — Plasma-Enhanced Chemical Vapor Deposition for Thin Film Engineering',
    excerpt: 'A comprehensive guide to PECVD technology covering plasma-assisted deposition principles, single- vs dual-frequency RF stress control, process recipes for SiO\u2082/SiN\u2093/\u03b1-Si:H/SiC/SiON/DLC films, comparison with thermal CVD/LPCVD/HDP-CVD/ALD/sputtering, applications from passivation to MEMS, and equipment selection criteria. Includes starter process windows, optimization strategies, and FAQs.',
    // NOTE: Article body content lives in scripts/articles/pecvd-complete-guide-plasma-enhanced-cvd.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-27',
    category: 'Materials Science',
    readTime: 18,
    imageUrl: 'https://cdn.ninescrolls.com/insights/pecvd-guide-cover.png',
    slug: 'pecvd-complete-guide-plasma-enhanced-cvd',
    tags: ['PECVD', 'thin film deposition', 'dual-frequency RF', 'silicon nitride', 'silicon oxide', 'amorphous silicon', 'DLC', 'film stress', 'CVD', 'MEMS', 'passivation', 'semiconductor processing']
  },
{
    id: '45',
    title: 'Plasma Stripping & Ashing – Principles, Gas Chemistry, and Equipment Guide',
    excerpt: 'A comprehensive guide to plasma stripping and ashing: O₂ plasma chemistry, dry vs. wet strip comparison, process types (PR strip, descum, post-etch residue removal, surface activation, 2D materials processing), gas chemistry selection, process optimization, and equipment selection. Includes FAQs and links to NineScrolls Striper products.',
    // NOTE: Article body content lives in scripts/articles/plasma-stripping-ashing-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-27',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/striper-guide-cover.png',
    slug: 'plasma-stripping-ashing-guide',
    tags: ['plasma stripping', 'plasma ashing', 'photoresist removal', 'O₂ plasma', 'descum', 'surface activation', '2D materials', 'post-etch residue', 'gas chemistry', 'endpoint detection', 'MoS₂', 'graphene']
  }
,
  {
    id: '46',
    title: 'Ion Beam Etching (IBE) & RIBE: Principles, Applications, and Equipment Guide',
    excerpt: 'A comprehensive guide to ion beam etching (IBE) and reactive ion beam etching (RIBE): ion source physics, Kaufman vs RF source comparison, IBE vs RIBE operating modes, process parameter optimization, applications in magnetic devices, MRAM, photonics, and MEMS, troubleshooting, and equipment selection. Includes comparison with RIE/ICP-RIE, FAQs, and NineScrolls product specifications.',
    // NOTE: Article body content lives in scripts/articles/ion-beam-etching-ribe-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-22',
    category: 'Materials Science',
    readTime: 16,
    imageUrl: 'https://cdn.ninescrolls.com/insights/ibe-ribe-guide-cover.png',
    slug: 'ion-beam-etching-ribe-guide',
    tags: ['ion beam etching', 'IBE', 'RIBE', 'ion milling', 'reactive ion beam etching', 'magnetic etching', 'MRAM', 'MTJ', 'noble metals', 'spintronics', 'photonics', 'Kaufman ion source', 'RF ion source', 'physical sputtering', 'redeposition', 'equipment guide'],
    relatedProducts: [
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Ion beam etching for metals & complex materials' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' }
    ]
  }
,
  {
    id: '47',
    title: 'Coater/Developer Systems: Equipment Selection & Process Optimization Guide',
    excerpt: 'A comprehensive guide to coater/developer track systems for photolithography: equipment architecture vs manual spin coaters, modular coat/develop/bake configurations, spin coating physics, developer module design (puddle vs spray), hotplate integration, recipe programming, uniformity optimization (<0.5% 3\u03c3), defect troubleshooting, and equipment selection criteria. Includes NineScrolls product specs, comparison tables, and FAQs.',
    // NOTE: Article body content lives in scripts/articles/coater-developer-systems-equipment-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-13',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/coater-developer-equipment-guide-cover.png',
    slug: 'coater-developer-systems-equipment-guide',
    tags: ['coater developer', 'spin coating', 'photolithography', 'track system', 'photoresist', 'developer', 'hotplate', 'film uniformity', 'edge bead removal', 'process optimization', 'wafer processing', 'semiconductor equipment', 'cleanroom', 'recipe programming'],
    relatedProducts: [
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Photolithography track equipment' },
      { href: '/products/striper', label: 'Striper Systems' }
    ]
  }
,
  {
  id: '48',
  title: 'PLUTO vs HY Series Plasma Cleaners: Design, Performance & Selection Guide',
  excerpt: 'A head-to-head comparison of the PLUTO and HY series plasma cleaners — covering RF vs mid-frequency excitation, chamber architecture, power density, electrode design, application matching, cost-of-ownership, and a decision flowchart to help you choose the right system for your lab.',
  // NOTE: Article body content lives in scripts/articles/pluto-vs-hy-plasma-cleaner-comparison.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
  author: 'NineScrolls Engineering',
  publishDate: '2026-03-04',
  category: 'Equipment Maintenance',
  readTime: 12,
  imageUrl: 'https://cdn.ninescrolls.com/insights/pluto-vs-hy-comparison-cover.png',
  slug: 'pluto-vs-hy-plasma-cleaner-comparison',
  tags: ['plasma cleaner', 'plasma cleaner comparison', 'PLUTO series', 'HY series', 'RF plasma cleaner', 'mid-frequency plasma cleaner', 'surface activation', 'plasma cleaning', 'equipment selection', 'benchtop plasma cleaner', 'gas-shower electrode', 'recipe management'],
  relatedProducts: [
    { href: '/products/pluto-f', label: 'PLUTO-F', subtitle: '500W RF flagship' },
    { href: '/products/pluto-m', label: 'PLUTO-M', subtitle: '200W RF mid-range' },
    { href: '/products/pluto-t', label: 'PLUTO-T', subtitle: '200W RF compact' },
    { href: '/products/hy-20lrf', label: 'HY-20LRF', subtitle: '300W RF 20L' },
    { href: '/products/hy-20l', label: 'HY-20L', subtitle: 'RF/MF 20L' },
    { href: '/products/hy-4l', label: 'HY-4L', subtitle: 'RF/MF compact' }
  ]
  }
,
  {
    id: '49',
    title: 'Plasma Stripping & Ashing Equipment: Selection Guide for Research Labs',
    excerpt: 'How to choose the right plasma stripping/ashing equipment for your lab: barrel vs downstream vs RIE-mode architectures, gas chemistry selection (O₂, O₂/CF₄, H₂/N₂, forming gas), temperature effects, endpoint detection (OES, interferometry), batch vs single-wafer tradeoffs, damage-sensitive stripping, and when to use a striper vs plasma cleaner. Includes comparison tables, decision flowchart, product callout, and FAQ.',
    // NOTE: Article body content lives in scripts/articles/plasma-stripping-equipment-selection-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-07',
    category: 'Materials Science',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/striper-equipment-selection-cover.png',
    slug: 'plasma-stripping-equipment-selection-guide',
    tags: ['plasma stripping', 'plasma ashing', 'equipment selection', 'barrel asher', 'downstream plasma', 'RIE-mode', 'endpoint detection', 'OES', 'photoresist removal', 'gas chemistry', 'O₂ plasma', 'damage-sensitive stripping'],
    relatedProducts: [
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Plasma stripping & ashing' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners' }
    ]
  },
  {
    id: '50',
    title: 'HDP-CVD Applications: Gap Fill, STI, and Advanced Dielectric Deposition',
    excerpt: 'Comprehensive guide to HDP-CVD applications: gap-fill mechanism (simultaneous deposition and sputtering), STI fill process, IMD/PMD dielectric layers, comparison with PECVD and SACVD, step coverage optimization, void-free fill strategies, advanced packaging, and process parameter optimization. Includes comparison tables, process windows, product callout, and FAQ.',
    // NOTE: Article body content lives in scripts/articles/hdp-cvd-applications-gap-fill-dielectrics.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-10',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/hdp-cvd-applications-cover.png',
    slug: 'hdp-cvd-applications-gap-fill-dielectrics',
    tags: ['HDP-CVD', 'gap fill', 'STI', 'shallow trench isolation', 'IMD', 'PMD', 'dielectric deposition', 'void-free fill', 'PECVD comparison', 'SACVD', 'advanced packaging', 'D/S ratio', 'SiO₂', 'doped oxide'],
    relatedProducts: [
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'High-density plasma CVD' },
      { href: '/products/pecvd', label: 'PECVD Systems' }
    ]
  }
,
  {
    id: '51',
    title: 'Lithography Process Integration: From Substrate Preparation to Pattern Transfer',
    excerpt: 'A comprehensive guide to lithography process integration covering the full patterning flow: substrate cleaning, HMDS priming, spin coating, soft bake, alignment & exposure (contact, proximity, projection, e-beam), post-exposure bake, development, hard bake, pattern transfer (etch), and resist strip. Covers critical interfaces between steps, overlay/alignment considerations, CD control, and process integration challenges. Includes FAQs and links to NineScrolls coater/developer, etcher, and striper products.',
    // NOTE: Article body content lives in scripts/articles/lithography-process-integration-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-16',
    category: 'Nanotechnology',
    readTime: 15,
    imageUrl: 'https://cdn.ninescrolls.com/insights/lithography-integration-cover.png',
    slug: 'lithography-process-integration-guide',
    tags: ['lithography', 'process integration', 'spin coating', 'HMDS', 'photoresist', 'exposure', 'alignment', 'overlay', 'CD control', 'pattern transfer', 'hard bake', 'development', 'RIE', 'etch'],
    relatedProducts: [
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Photolithography track equipment' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' },
      { href: '/products/striper', label: 'Striper Systems' }
    ]
  },
  {
    id: '52',
    title: 'Post-Etch Cleaning & Residue Removal: Strategies for Damage-Free Processing',
    excerpt: 'A comprehensive guide to post-etch cleaning and residue removal: types of etch residues (polymer sidewall, metal halide, organic, inorganic), residue formation mechanisms, dry cleaning methods (O\u2082 plasma, downstream ashing, forming gas), wet cleaning comparison, damage-free strategies for low-k/Cu/III-V substrates, in-situ vs ex-situ cleaning integration, and contamination monitoring. Includes FAQs and links to NineScrolls striper, plasma cleaner, and etcher products.',
    // NOTE: Article body content lives in scripts/articles/post-etch-cleaning-residue-removal.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-19',
    category: 'Materials Science',
    readTime: 13,
    imageUrl: 'https://cdn.ninescrolls.com/insights/post-etch-cleaning-cover.png',
    slug: 'post-etch-cleaning-residue-removal',
    tags: ['post-etch cleaning', 'residue removal', 'plasma cleaning', 'O\u2082 plasma', 'forming gas', 'low-k dielectric', 'copper', 'III-V', 'downstream ashing', 'contamination', 'sidewall polymer', 'metal halide', 'damage-free'],
    relatedProducts: [
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Plasma stripping & ashing' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' }
    ]
  },
  {
    id: '53',
    title: 'Vacuum System Fundamentals for Semiconductor Processing Equipment',
    excerpt: 'A comprehensive guide to vacuum technology for semiconductor fabrication: vacuum regimes (rough, high, UHV), pump technologies (rotary vane, scroll, turbo, cryo, ion), pressure measurement gauges, gas flow regimes, conductance calculations, leak detection, outgassing, load-lock design, vacuum materials, and maintenance best practices. Includes comparison tables, FAQs, and equipment selection guidance.',
    // NOTE: Article body content lives in scripts/articles/vacuum-system-fundamentals-semiconductor.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-28',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/vacuum-fundamentals-cover.png',
    slug: 'vacuum-system-fundamentals-semiconductor',
    tags: ['vacuum systems', 'semiconductor equipment', 'turbo pump', 'cryopump', 'leak detection', 'pressure measurement', 'outgassing', 'load-lock', 'vacuum materials', 'equipment maintenance', 'gas flow', 'conductance'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' },
      { href: '/products/pecvd', label: 'PECVD Systems' },
      { href: '/products/ald', label: 'ALD Systems' }
    ]
  },
  {
    id: '54',
    title: 'Process Chamber Materials & Contamination Control in Semiconductor Equipment',
    excerpt: 'A comprehensive guide to process chamber materials and contamination control for semiconductor fabrication equipment: chamber body materials (aluminum, stainless steel, ceramics), surface treatments (anodization, Y₂O₃ coating), electrode and liner design, seal materials, gas delivery components, contamination sources, chamber conditioning, cleaning protocols, and qualification criteria. Includes comparison tables, maintenance schedules, FAQs, and equipment selection guidance.',
    // NOTE: Article body content lives in scripts/articles/process-chamber-materials-contamination-control.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-03-25',
    category: 'Materials Science',
    readTime: 13,
    imageUrl: 'https://cdn.ninescrolls.com/insights/chamber-materials-contamination-cover.png',
    slug: 'process-chamber-materials-contamination-control',
    tags: ['chamber materials', 'contamination control', 'anodization', 'yttria coating', 'electropolishing', 'chamber cleaning', 'chamber seasoning', 'particle control', 'O-ring materials', 'preventive maintenance', 'semiconductor equipment', 'process qualification'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' },
      { href: '/products/pecvd', label: 'PECVD Systems' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems' }
    ]
  },
  {
    id: '55',
    title: 'Wafer Loading Effect in Plasma Etching: Causes, Types, and Mitigation Strategies',
    excerpt: 'A comprehensive guide to wafer loading effects in plasma etching: macro loading, micro loading, and aspect ratio dependent etching (ARDE). Covers the physical mechanisms behind reactant depletion and byproduct redeposition, quantitative models, impact on CD uniformity, and practical mitigation strategies across RIE, ICP-RIE, and DRIE processes. Includes diagnostic procedures, process parameter guidelines, and FAQs.',
    // NOTE: Article body content lives in scripts/articles/wafer-loading-effect-plasma-etching.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-03',
    category: 'Materials Science',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/wafer-loading-effect-plasma-etching/cover-lg.webp',
    slug: 'wafer-loading-effect-plasma-etching',
    tags: ['wafer loading', 'loading effect', 'macro loading', 'micro loading', 'ARDE', 'aspect ratio dependent etching', 'RIE lag', 'etch uniformity', 'CD uniformity', 'pattern dependent etching', 'plasma etching', 'RIE', 'ICP-RIE', 'DRIE', 'etch rate'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' }
    ]
  },
  {
    id: '56',
    title: 'RIE & ICP‑RIE System Maintenance and Troubleshooting Handbook',
    excerpt: 'A practical handbook for maintaining and troubleshooting RIE and ICP‑RIE plasma etching systems: preventive maintenance schedules (daily to annual), vacuum system care, RF power supply diagnostics, gas delivery inspection, temperature control calibration, common fault symptoms with root‑cause analysis, troubleshooting decision trees, post‑maintenance qualification procedures, spare parts management, and safety protocols. Includes checklists, comparison tables, and FAQs.',
    // NOTE: Article body content lives in scripts/articles/rie-icp-system-maintenance-troubleshooting.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-03',
    category: 'Nanotechnology',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/rie-icp-system-maintenance-troubleshooting/cover-lg.webp',
    slug: 'rie-icp-system-maintenance-troubleshooting',
    tags: ['RIE maintenance', 'ICP-RIE maintenance', 'plasma etcher troubleshooting', 'preventive maintenance', 'vacuum system', 'RF power diagnostics', 'matching network', 'etch rate drift', 'particle control', 'chamber cleaning', 'equipment qualification', 'semiconductor equipment maintenance'],
    relatedProducts: [
      { href: '/products/rie-etcher', label: 'RIE Etcher Series' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series' }
    ]
  },
  {
    id: '57',
    title: 'Quantum Device Micro‑ & Nanofabrication – Processes, Challenges, and Equipment Guide',
    excerpt: 'A comprehensive guide to micro‑ and nanofabrication for quantum devices: superconducting qubits, spin qubits, photonic circuits, and topological structures. Covers lithography, thin‑film deposition, dry etching, and process integration with practical recipes and equipment considerations.',
    // NOTE: Article body content lives in scripts/articles/quantum-device-micro-nanofabrication-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-04',
    category: 'Nanotechnology',
    readTime: 20,
    imageUrl: 'https://cdn.ninescrolls.com/insights/quantum-device-micro-nanofabrication-guide/quantum-nanofab-cover-lg.webp',
    slug: 'quantum-device-micro-nanofabrication-guide',
    tags: ['quantum computing', 'nanofabrication', 'superconducting qubits', 'Josephson junction', 'spin qubits', 'photonic quantum circuits', 'quantum fabrication', 'transmon', 'SNSPD', 'cryogenic devices', 'Nb sputtering', 'EBL'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'High-density plasma etching for superconducting films' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Pattern transfer and surface cleaning' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Ion beam etching for photonic materials' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Dielectric films for waveguides and passivation' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Ultra-thin gate dielectrics for spin qubits' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Precision resist processing for EBL' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Low-damage resist removal' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface preparation and descum' }
    ]
  },
  {
    id: '58',
    title: 'MEMS Fabrication Process Guide – From Design to Device',
    excerpt: 'A comprehensive guide to MEMS (Micro-Electro-Mechanical Systems) fabrication: bulk and surface micromachining, DRIE Bosch process, thin-film deposition, wafer bonding, release etching, and packaging. Covers process integration for accelerometers, pressure sensors, microfluidics, RF MEMS, and optical MEMS with practical recipes and equipment selection.',
    // NOTE: Article body content lives in scripts/articles/mems-fabrication-process-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-15',
    category: 'Nanotechnology',
    readTime: 22,
    imageUrl: 'https://cdn.ninescrolls.com/insights/mems-fabrication-process-guide/mems-cover-lg.webp',
    slug: 'mems-fabrication-process-guide',
    tags: ['MEMS', 'microfabrication', 'DRIE', 'Bosch process', 'surface micromachining', 'bulk micromachining', 'accelerometer', 'pressure sensor', 'microfluidics', 'RF MEMS', 'wafer bonding', 'stiction'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'DRIE Bosch and cryogenic etching for MEMS structures' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Structural film patterning and oxide/nitride etching' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Sacrificial oxide, passivation nitride, stress-tuned films' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Metal films, piezoelectric AlN, multi-layer stacks' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Conformal anti-stiction coatings and etch stop layers' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Metal and piezoelectric film patterning' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Thick resist processing for DRIE' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Thick resist strip and post-DRIE polymer removal' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'Void-free gap fill for trench isolation' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface activation for wafer bonding' }
    ]
  },
  {
    id: '59',
    title: 'III‑V Compound Semiconductor Etching – Gas Chemistry, Process Windows, and Equipment Guide',
    excerpt: 'A comprehensive guide to plasma etching of III-V compound semiconductors: GaAs, InP, GaN, AlGaN, InGaAs, and GaSb. Covers ICP-RIE and RIE gas chemistries (Cl₂, BCl₃, SiCl₄, CH₄/H₂), etch mechanisms, selectivity strategies, damage mitigation, and equipment selection for photonics, RF/power electronics, and quantum device applications.',
    // NOTE: Article body content lives in scripts/articles/iii-v-compound-semiconductor-etching-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-15',
    category: 'Materials Science',
    readTime: 24,
    imageUrl: 'https://cdn.ninescrolls.com/insights/iii-v-compound-semiconductor-etching-guide/iii-v-cover-lg.webp',
    slug: 'iii-v-compound-semiconductor-etching-guide',
    tags: ['III-V semiconductors', 'GaAs etching', 'InP etching', 'GaN etching', 'AlGaN', 'compound semiconductor', 'ICP-RIE', 'plasma etching', 'HEMT', 'photonic integrated circuits', 'VCSEL', 'RF MEMS'],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Primary platform for all III-V compound semiconductor etching' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Hard mask patterning and O₂ clean cycles' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Metal contact patterning and physical etch applications' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'Hard mask deposition, passivation, and waveguide cladding' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Gate dielectrics and conformal sidewall passivation' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Hard mask metals and contact metallization stacks' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Photoresist processing for III-V lithography' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Low-damage resist removal for III-V surfaces' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface preparation and chamber conditioning' }
    ]
  },
  {
    id: '60',
    title: 'Wide Bandgap Semiconductor Device Fabrication – GaN & SiC Dry Etching, Deposition, and Process Integration Guide',
    excerpt: 'A comprehensive guide to wide bandgap semiconductor (GaN, SiC) device fabrication: ICP-RIE etching of SiC and GaN power devices, gate recess and mesa isolation processes, passivation and gate dielectric deposition (PECVD, ALD), ohmic contact formation, damage mitigation strategies, and complete process integration flows for SiC MOSFETs, GaN HEMTs, and vertical power devices.',
    // NOTE: Article body content lives in scripts/articles/wide-bandgap-semiconductor-gan-sic-fabrication-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    slug: 'wide-bandgap-semiconductor-gan-sic-fabrication-guide',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-19',
    category: 'Materials Science',
    readTime: 26,
    imageUrl: 'https://cdn.ninescrolls.com/insights/wide-bandgap-semiconductor-gan-sic-fabrication-guide/cover-lg.webp',
    tags: [
      'Wide Bandgap',
      'GaN',
      'SiC',
      'Power Devices',
      'ICP-RIE',
      'HEMT',
      'MOSFET',
      'Plasma Etching',
      'PECVD',
      'ALD',
      'Gate Recess',
      'Power Electronics'
    ],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Primary etch platform for both SiC (SF₆) and GaN (Cl₂/BCl₃) processing' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Hard mask patterning, polysilicon gate etch, and via opening' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'SiNx passivation, SiO₂ ILD, and stress-tuned dielectric films' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Al₂O₃ and HfO₂ gate dielectrics for GaN MIS-HEMTs' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Multi-layer ohmic contact stacks and metallization' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective RIE for WBG process development' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Resist strip and post-etch polymer removal' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Photoresist processing for WBG device lithography' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Physical etch for metal contact patterning' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface preparation and chamber conditioning' }
    ]
  },
  {
    id: '61',
    title: 'Bio-MEMS & Microfluidic Chip Fabrication – Materials, Processes, and Equipment Guide',
    excerpt: 'Complete fabrication guide for Bio-MEMS and microfluidic devices: substrate and material selection (silicon, glass, PDMS, thermoplastics), microchannel etching (DRIE, wet etch, laser ablation), soft lithography and PDMS molding, surface functionalization, biocompatible thin-film coatings (parylene, ALD, PECVD), sensor integration, bonding and packaging, organ-on-chip process flows, and equipment selection for biomedical microsystem labs.',
    // NOTE: Article body content lives in scripts/articles/bio-mems-microfluidic-chip-fabrication-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    slug: 'bio-mems-microfluidic-chip-fabrication-guide',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-19',
    category: 'Process Integration',
    readTime: 28,
    imageUrl: 'https://cdn.ninescrolls.com/insights/bio-mems-microfluidic-chip-fabrication-guide/cover-lg.webp',
    tags: [
      'Bio-MEMS',
      'Microfluidics',
      'Lab-on-Chip',
      'Organ-on-Chip',
      'PDMS',
      'Soft Lithography',
      'Surface Functionalization',
      'Biocompatibility',
      'Plasma Bonding',
      'Point-of-Care Diagnostics',
      'Neural Probes',
      'Droplet Microfluidics'
    ],
    relatedProducts: [
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'PDMS bonding, surface activation, sterilization, and hydrophilic treatment' },
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'DRIE for silicon microchannels and glass etching' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'Parylene patterning, hard mask etching, and polymer processing' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective O₂/Ar/CF₄ etching for polymer Bio-MEMS labs' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'SiO₂/SiNₓ passivation, DLC biocompatible coatings, a-Si hard masks' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Ultra-thin Al₂O₃/TiO₂ biocompatible barriers for implantable devices' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Au/Pt/ITO electrodes, Ti adhesion layers, and Cr/Au hard masks' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'SU-8 master mold fabrication and precision photoresist processing' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Photoresist removal and post-etch polymer cleaning' },
      { href: '/products/hdp-cvd', label: 'HDP-CVD Systems', subtitle: 'Conformal gap-fill for multi-level microfluidic structures' }
    ]
  },

  // ───────────────────────────────────────────────────────────
  // 62. 2D Materials Device Fabrication Guide
  // ───────────────────────────────────────────────────────────
  {
    id: '62',
    title: '2D Materials Device Fabrication: From Graphene and TMDs to Functional Devices',
    excerpt: 'A comprehensive fabrication guide for 2D material devices — graphene FETs, MoS₂ photodetectors, h-BN tunnel junctions, and van der Waals heterostructures. Covers substrate preparation, CVD growth, deterministic transfer, low-damage patterning (ICP-RIE, ALE), contact metallization, dielectric encapsulation, and complete process integration flows with equipment recommendations.',
    // NOTE: Article body content lives in scripts/articles/2d-materials-device-fabrication-guide.html
    // (the single source of truth) and is synced to DynamoDB via update-insight-from-html.ts.
    // The previous inline blob here was a stale copy of the live DDB article — do NOT restore it.
    // The empty string ensures seed/update scripts never overwrite the live DDB content.
    // Metadata below is still consumed (seed-insights.ts RELATED_PRODUCTS_MAP / HERO_IMAGES_MAP).
    content: '',
    slug: '2d-materials-device-fabrication-guide',
    author: 'NineScrolls Engineering',
    publishDate: '2026-04-19',
    category: 'Process Integration',
    readTime: 35,
    imageUrl: 'https://cdn.ninescrolls.com/insights/2d-materials-device-fabrication-guide/cover-lg.webp',
    tags: [
      '2D Materials',
      'Graphene',
      'MoS2',
      'WS2',
      'WSe2',
      'h-BN',
      'TMD',
      'Van der Waals Heterostructures',
      'Low-Damage Etching',
      'ALD',
      'Contact Metallization',
      'ICP-RIE',
      'Device Fabrication'
    ],
    relatedProducts: [
      { href: '/products/icp-etcher', label: 'ICP Etcher Series', subtitle: 'Low-damage ICP-RIE for TMD patterning, h-BN etching, and heterostructure mesa isolation' },
      { href: '/products/rie-etcher', label: 'RIE Etcher Series', subtitle: 'O₂ plasma graphene patterning, dielectric etching, and contact window opening' },
      { href: '/products/compact-rie', label: 'Compact RIE', subtitle: 'Cost-effective O₂/Ar/CF₄ etching for graphene and basic 2D material patterning' },
      { href: '/products/ald', label: 'ALD Systems', subtitle: 'Al₂O₃/HfO₂ gate dielectrics and encapsulation layers for 2D material FETs' },
      { href: '/products/pecvd', label: 'PECVD Systems', subtitle: 'SiO₂/SiNₓ passivation, low-temperature TMD growth, environmental encapsulation' },
      { href: '/products/sputter', label: 'Sputter Systems', subtitle: 'Contact metallization (Ti, Cr, Au, Pt, Bi) and gate metal deposition' },
      { href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Substrate activation, PMMA residue removal, and surface functionalization' },
      { href: '/products/coater-developer', label: 'Coater/Developer Systems', subtitle: 'Gentle resist application with programmable spin profiles for delicate 2D materials' },
      { href: '/products/striper', label: 'Striper Systems', subtitle: 'Low-damage photoresist stripping and post-etch polymer removal' },
      { href: '/products/ibe-ribe', label: 'IBE/RIBE Systems', subtitle: 'Angle-controlled ion beam etching for h-BN taper engineering and metal patterning' }
    ]
  },
];
