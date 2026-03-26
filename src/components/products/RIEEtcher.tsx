import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function RIEEtcher() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // no-op placeholders removed: using QuoteModal

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
    "@id": "https://ninescrolls.com/products/rie-etcher#product",
    "name": "RIE Etcher Series",
    "description": "Reactive Ion Etching system providing precise plasma etching for semiconductor manufacturing and research applications.",
    "image": ["https://ninescrolls.com/assets/images/products/rie-etcher/main.jpg"],
    "sku": "rie-etcher",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/rie-etcher",
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
              "name": "What materials can the RIE etcher process?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The RIE etcher processes a wide range of materials including silicon (Si), silicon dioxide (SiO2), silicon nitride (SiNx), metals, and polymers. Common applications include dielectric patterning, metal etching, polymer removal, and photoresist stripping for semiconductor and MEMS fabrication."
              }
            },
            {
              "@type": "Question",
              "name": "When should I choose RIE over ICP-RIE?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "RIE is the right choice for standard-depth etching with moderate aspect ratios, general-purpose dielectric and polymer processing, and applications where cost-effectiveness is a priority. Choose ICP-RIE when you need high-aspect-ratio features, higher etch rates, or independent control of plasma density and ion energy for advanced materials like SiC or GaN."
              }
            },
            {
              "@type": "Question",
              "name": "What process control features does the RIE etcher include?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The RIE etcher includes automated process control with endpoint detection, 4 process gas lines with mass flow controllers (MFCs), temperature control from 20°C to 80°C, and RF power up to 600W at 13.56 MHz. The system supports both open-load and load-lock configurations."
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
            { name: 'RIE Etcher Series', path: '/products/rie-etcher' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">RIE Etcher Series</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">High-precision Reactive Ion Etching System with Compact Design</p>
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
                src="/assets/images/products/rie-etcher/main.jpg"
                alt="RIE Etcher System"
                className="w-full rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">The RIE Etcher Series delivers high-precision reactive ion etching in a compact 1.0m × 1.0m footprint. Designed for research and development environments, it offers exceptional process control and monitoring capabilities.</p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Compact footprint design (1.0m × 1.0m)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Advanced plasma control system
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Real-time process monitoring
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Multiple gas line configuration
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Precise temperature control
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Flexible RF power options
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  User-friendly interface
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Comprehensive safety features
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
                  Silicon Processing
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">category</span>
                  Dielectric Etching
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                  Metal Etching
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  Polymer Processing
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">precision_manufacturing</span>
                  MEMS Fabrication
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">biotech</span>
                  Research & Development
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
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Wafer Size Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">4" to 12" compatibility</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz, up to 600W</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas System</td>
                  <td className="px-6 py-3 text-on-surface-variant">4 process gas lines with MFCs</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Temperature Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">20°C to 80°C</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Base Pressure</td>
                  <td className="px-6 py-3 text-on-surface-variant">≤ 5×10⁻⁶ Torr</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Process Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">Automated with endpoint detection</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">1.0m x 1.0m</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Pump System</td>
                  <td className="px-6 py-3 text-on-surface-variant">TMP & mechanical pump</td>
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
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> High etch rate control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Excellent process uniformity</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Advanced endpoint detection (OES/IV/impedance ready)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Stable plasma generation</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Precise pressure control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Multiple process recipes storage</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Real-time parameter monitoring</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Automated pressure control</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon dioxide etching</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Silicon nitride processing</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Polysilicon etching</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Metal pattern definition</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Polymer removal</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Surface treatment</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our RIE etching systems are cited in 60+ peer-reviewed publications across top-tier journals including Science, Nature Communications, and Advanced Materials, powering breakthroughs in nanofabrication, 2D materials, and flexible electronics."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Nature Communications',
            tier: 'top',
            title: 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions',
            authors: 'X Zhang, B Liu, L Gao et al.',
            year: '2021',
            citations: 218,
          },
          {
            journal: 'Science',
            tier: 'top',
            title: 'Multifunctional tendon-mimetic hydrogels',
            authors: 'M Sun, H Li, Y Hou et al.',
            year: '2023',
            citations: 135,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Hidden vacancy benefit in monolayer 2D semiconductors',
            authors: 'X Zhang, Q Liao, Z Kang et al.',
            year: '2021',
            citations: 115,
          },
          {
            journal: 'Advanced Functional Materials',
            tier: 'high',
            title: 'Breathable and skin-conformal electronics with hybrid integration of microfabricated multifunctional sensors',
            authors: 'H Li, Z Wang, M Sun et al.',
            year: '2022',
            citations: 68,
          },
          {
            journal: 'Nano Research',
            tier: 'high',
            title: 'Record-high saturation current in end-bond contacted monolayer MoS2 transistors',
            authors: 'J Xiao, Z Kang, B Liu et al.',
            year: '2022',
            citations: 48,
          },
          {
            journal: 'InfoMat',
            tier: 'high',
            title: 'Synergistic-engineered van der Waals photodiodes with high efficiency',
            authors: 'B Liu, X Zhang, J Du et al.',
            year: '2022',
            citations: 38,
          },
        ]}
        journalNames={['Nature Communications', 'Science', 'Adv. Materials', 'Adv. Functional Materials', 'Nano Research', 'Nano Letters']}
        onRequestQuote={() => openContactForm(true)}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related Equipment & Articles */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Related Equipment & Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/products/icp-etcher" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">settings</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">ICP Etcher Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">High-density plasma etching alternative for advanced applications.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/plasma-etching" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Plasma Etching Fundamentals</h3>
              <p className="text-sm text-on-surface-variant mb-3">Key concepts, terms, and control knobs for plasma etch processes.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
            <a href="/insights/plasma-etching-explained-fundamentals-applications" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Plasma Etching Explained</h3>
              <p className="text-sm text-on-surface-variant mb-3">Practical guidance and applications for plasma etching technology.</p>
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
                Q: What materials can the RIE etcher process?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The RIE etcher processes a wide range of materials including silicon (Si), silicon dioxide (SiO2), silicon nitride (SiNx), metals, and polymers. Common applications include dielectric patterning, metal etching, polymer removal, and photoresist stripping for semiconductor and MEMS fabrication.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: When should I choose RIE over ICP-RIE?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: RIE is the right choice for standard-depth etching with moderate aspect ratios, general-purpose dielectric and polymer processing, and applications where cost-effectiveness is a priority. Choose ICP-RIE when you need high-aspect-ratio features, higher etch rates, or independent control of plasma density and ion energy for advanced materials like SiC or GaN.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What process control features does the RIE etcher include?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The RIE etcher includes automated process control with endpoint detection, 4 process gas lines with mass flow controllers (MFCs), temperature control from 20°C to 80°C, and RF power up to 600W at 13.56 MHz. The system supports both open-load and load-lock configurations.
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
        productName="RIE Etcher Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{
          const a=document.createElement('a'); a.href='/docs/rie-etcher-datasheet.pdf'; a.download='NineScrolls-RIE-Etcher-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/rie-etcher-datasheet.pdf'}
        fileName={'NineScrolls-RIE-Etcher-Datasheet.pdf'}
        title={'Download RIE Etcher Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
