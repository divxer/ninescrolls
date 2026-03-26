import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PECVDSystem() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Scroll to top when component mounts
  useScrollToTop();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pecvd#product",
    "name": "PECVD System Series",
    "description": "Plasma-Enhanced CVD system with compact uni-body design for versatile thin film deposition.",
    "image": ["https://ninescrolls.com/assets/images/products/pecvd/main.jpg"],
    "sku": "pecvd",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pecvd",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" }
    }
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What films can the PECVD system deposit?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The PECVD system deposits a range of dielectric and semiconductor films including amorphous silicon (a-Si:H), silicon dioxide (SiO2), silicon nitride (SiNx), silicon carbide (SiC), silicon oxynitride (SiON), and diamond-like carbon (DLC). The dual-frequency RF system (13.56 MHz and/or 400 kHz) enables fine-tuned film stress and composition control."
              }
            },
            {
              "@type": "Question",
              "name": "What is the advantage of PECVD over thermal CVD?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "PECVD uses plasma energy to enable film deposition at significantly lower substrate temperatures (20-400\u00b0C vs. 600-900\u00b0C for thermal CVD). This makes PECVD compatible with temperature-sensitive substrates, metals, and polymers while still achieving high-quality dielectric films suitable for passivation, anti-reflection coatings, and encapsulation."
              }
            },
            {
              "@type": "Question",
              "name": "What RF power configurations are available?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The PECVD system offers dual-frequency capability with 13.56 MHz and/or 400 kHz RF at 500-2000W. The dual-frequency option enables independent control of ion bombardment energy and plasma density, which is critical for tuning film stress from compressive to tensile \u2014 essential for applications like MEMS membranes and optical coatings."
              }
            }
          ]
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src="/assets/images/products/product-detail-bg.jpg" alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'PECVD System Series', path: '/products/pecvd' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">PECVD System Series</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Advanced Plasma-Enhanced Chemical Vapor Deposition System for Versatile Film Growth</p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>

            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                Cost-efficient, research-grade configurations
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                We specialize in cost-efficient configurations for research labs that need to balance performance and budget.
                We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={() => openContactForm(true)}
              >
                Request a Quote
              </button>
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors no-underline"
                onClick={(e) => { e.preventDefault(); setGateOpen(true); }}
              >
                Download Datasheet
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Product Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="min-w-0">
              <img
                src="/assets/images/products/pecvd/main.jpg"
                alt="PECVD System"
                className="w-full rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">The PECVD Series utilizes plasma-enhanced chemical vapor deposition (PECVD) technology within a compact uni-body design featuring a small footprint (approx. 1.0m x 1.0m). Engineered for versatile applications in research and production environments, it delivers excellent film quality, superior process flexibility, and precise control with configurable options to optimize performance or cost-efficiency.</p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Uni-body compact design (footprint: ~1.0m x 1.0m)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Variable plasma discharge gap for optimized process performance
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Electrode RF-driven configuration (13.56 MHz and/or 400 KHz) for low-stress films and precise tuning
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Chamber liner and electrode temperature control suitable for various deposition processes
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Integrated gas delivery system (standard: 6 lines, customizable)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Optional sample handling system (Open-load or Load-lock)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Automated and modular process design kits tailored to specific requirements
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Cost-performance customization options (RF system, pumps, valves, etc.)
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Target Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">computer</span>
                  Advanced semiconductor devices
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                  Optoelectronic components
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  Protective coatings
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  Research & development
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">biotech</span>
                  Novel materials synthesis
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                  Device optimization
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Technical Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr>
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">System Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Wafer Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">4", 6", 8", 12" wafers or multi-wafer configurations (optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">RF System</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz and/or 400 KHz, power range 500-2000 W (optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Temperature Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Roots pump & mechanical pump</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Distribution</td>
                  <td className="px-6 py-3 text-on-surface-variant">Up to 6 gas lines (standard), customizable</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Film Uniformity</td>
                  <td className="px-6 py-3 text-on-surface-variant">Less than 5% (edge exclusion)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Plasma Discharge Gap</td>
                  <td className="px-6 py-3 text-on-surface-variant">Variable, optimized per process</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">Approximately 1.0m x 1.0m</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Sample Loading</td>
                  <td className="px-6 py-3 text-on-surface-variant">Open-Load or Load-Lock (configurable)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Process Capabilities */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Process Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Performance Features</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Excellent step coverage (gap parameter adjustable)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> High deposition rates</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Superior film adhesion and density</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Precise thickness and stress control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Low particle contamination</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Low-temperature processing capability</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Process repeatability and multi-layer deposition capability</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Material Systems</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Amorphous Silicon (α-Si:H)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon Dioxide (SiO₂)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon Nitride (SiNx)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon Carbide (SiC)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon Oxynitride (SiON)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Diamond-like Carbon (DLC, optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our PECVD systems are used by researchers publishing in top-tier journals, enabling breakthroughs in thin film encapsulation, 2D materials, and semiconductor device fabrication."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Small',
            tier: 'high',
            title: 'In situ selenization engineered dual Schottky heterojunctions for high-speed broadband photonic communication detector arrays',
            authors: 'S Ke, M Ge, S Zu et al.',
            year: '2025',
            citations: 1,
          },
          {
            journal: 'Applied Physics Letters',
            tier: 'mid',
            title: 'A synaptic transistor with a stacked layer of SiNx and SiO2 deposited from hexamethyldisiloxane/O2',
            authors: 'C Peng, Y Liu, C Yu et al.',
            year: '2025',
            citations: 3,
          },
          {
            journal: 'Thin Solid Films',
            tier: 'mid',
            title: 'Low temperature plasma deposited SiO2/organosilicon stacked film for transparent gate dielectric of InGaZnO thin film transistor',
            authors: 'C Peng, H Qin, Y Liu et al.',
            year: '2024',
            citations: 1,
          },
        ]}
        journalNames={['Small', 'Applied Physics Letters', 'Thin Solid Films', 'Materials Today', 'ACS AMI']}
        onRequestQuote={() => openContactForm(true)}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related Equipment & Articles */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Related Equipment & Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/products/ald" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">biotech</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">ALD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Atomic layer precision for conformal films with sub-nanometer thickness control.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/products/hdp-cvd" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">settings</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">HDP-CVD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Gap-fill and dense dielectric films for advanced semiconductor manufacturing.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/plasma-etching-explained-fundamentals-applications" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Plasma Etching Explained</h3>
              <p className="text-sm text-on-surface-variant mb-3">Downstream steps and integration notes for etch/deposition workflows.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What films can the PECVD system deposit?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The PECVD system deposits a range of dielectric and semiconductor films including amorphous silicon (a-Si:H), silicon dioxide (SiO2), silicon nitride (SiNx), silicon carbide (SiC), silicon oxynitride (SiON), and diamond-like carbon (DLC). The dual-frequency RF system (13.56 MHz and/or 400 kHz) enables fine-tuned film stress and composition control.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What is the advantage of PECVD over thermal CVD?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PECVD uses plasma energy to enable film deposition at significantly lower substrate temperatures (20-400°C vs. 600-900°C for thermal CVD). This makes PECVD compatible with temperature-sensitive substrates, metals, and polymers while still achieving high-quality dielectric films suitable for passivation, anti-reflection coatings, and encapsulation.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What RF power configurations are available?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The PECVD system offers dual-frequency capability with 13.56 MHz and/or 400 kHz RF at 500-2000W. The dual-frequency option enables independent control of ion bombardment energy and plasma density, which is critical for tuning film stress from compressive to tensile — essential for applications like MEMS membranes and optical coatings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Request Information</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">Get detailed specs, pricing & customization options.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary/90 transition-colors"
              onClick={() => openContactForm(true)}
            >
              <span className="material-symbols-outlined text-[20px]">call</span>
              Contact Sales Team
            </button>
            <a
              href="#"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary hover:text-on-primary transition-colors no-underline"
              onClick={(e) => { e.preventDefault(); setGateOpen(true); }}
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      {/* Floating Contact Button */}
      {showFloatingContact && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideIn_0.3s_ease-out]">
          <button
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-full font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            onClick={() => openContactForm(true)}
          >
            <span className="material-symbols-outlined text-[20px]">call</span>
            Contact Sales Team
          </button>
        </div>
      )}

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="PECVD System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/pecvd-system-datasheet.pdf'; a.download='NineScrolls-PECVD-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/pecvd-system-datasheet.pdf'} fileName={'NineScrolls-PECVD-Datasheet.pdf'} title={'Download PECVD Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
}
