import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useMemo } from 'react';
import { cdnUrl } from '../config/imageConfig';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

export function ProductsPage() {
  // Scroll to top when component mounts
  useScrollToTop();
  const [selected, setSelected] = useState<'All' | 'Etching' | 'Deposition' | 'Coating/Developing' | 'Cleaning/Stripping'>('All');
  const [gateOpen, setGateOpen] = useState(false);
  const [etchingOpen, setEtchingOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const tabs = ['All','Etching','Deposition','Coating/Developing','Cleaning/Stripping'] as const;

  const schema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Plasma Etching & Thin-Film Systems",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "ICP‑RIE Etcher", "url": "https://ninescrolls.com/products/icp-etcher" },
      { "@type": "ListItem", "position": 2, "name": "RIE Etcher", "url": "https://ninescrolls.com/products/rie-etcher" },
      { "@type": "ListItem", "position": 3, "name": "Compact RIE Etcher (SV-RIE)", "url": "https://ninescrolls.com/products/compact-rie" },
      { "@type": "ListItem", "position": 4, "name": "HDP‑CVD System", "url": "https://ninescrolls.com/products/hdp-cvd" },
      { "@type": "ListItem", "position": 5, "name": "PECVD System", "url": "https://ninescrolls.com/products/pecvd" },
      { "@type": "ListItem", "position": 6, "name": "ALD System", "url": "https://ninescrolls.com/products/ald" },
      { "@type": "ListItem", "position": 7, "name": "Sputter System", "url": "https://ninescrolls.com/products/sputter" },
      { "@type": "ListItem", "position": 8, "name": "IBE/RIBE System", "url": "https://ninescrolls.com/products/ibe-ribe" },
      { "@type": "ListItem", "position": 9, "name": "Striper System", "url": "https://ninescrolls.com/products/striper" },
      { "@type": "ListItem", "position": 10, "name": "HY-20L", "url": "https://ninescrolls.com/products/hy-20l" },
      { "@type": "ListItem", "position": 11, "name": "HY-4L", "url": "https://ninescrolls.com/products/hy-4l" },
      { "@type": "ListItem", "position": 12, "name": "HY-20LRF", "url": "https://ninescrolls.com/products/hy-20lrf" },
      { "@type": "ListItem", "position": 13, "name": "PLUTO-T", "url": "https://ninescrolls.com/products/pluto-t" },
      { "@type": "ListItem", "position": 14, "name": "PLUTO-M", "url": "https://ninescrolls.com/products/pluto-m" },
      { "@type": "ListItem", "position": 15, "name": "PLUTO-F", "url": "https://ninescrolls.com/products/pluto-f" },
      { "@type": "ListItem", "position": 16, "name": "Coater/Developer System", "url": "https://ninescrolls.com/products/coater-developer" }
    ]
  }), []);

  return (
    <>
      <SEO
        title="Plasma Etching & Thin-Film Systems | ICP‑RIE, RIE, PECVD & ALD | NineScrolls"
        description="Advanced plasma etching and low‑temperature thin‑film tools for labs: ICP‑RIE, RIE, PECVD, ALD. ±3% uniformity, low‑damage processes, 150–200 mm wafers."
        keywords="plasma etching systems, ICP-RIE equipment, RIE vs DRIE comparison, semiconductor plasma etching tools, RIE etcher, DRIE Bosch"
        url="/products/"
      />

      {/* Hero */}
      <section className="pt-12 pb-16 max-w-screen-2xl mx-auto px-8">
        <Breadcrumbs items={[
          { name: 'Products', path: '/products' }
        ]} />
        <header className="mb-10 mt-6">
          <span className="text-tertiary font-headline font-bold uppercase tracking-[0.2em] text-xs mb-4 block">Precision Instrumentation</span>
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-on-surface tracking-tighter leading-[0.95] mb-6">Plasma Etching & Thin-Film Systems</h1>
          <p className="text-on-surface-variant font-body text-lg max-w-3xl leading-relaxed">
            <strong className="text-on-surface">NineScrolls provides ICP‑RIE, RIE, PECVD and ALD systems</strong> for research labs, delivering low‑damage processing, ±3% uniformity, and wide temperature control for 150–200 mm wafers.
          </p>
        </header>
        <div className="flex flex-wrap gap-4">
          <Link to="/request-quote" className="bg-primary text-on-primary px-6 py-3 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity">Request a Quote</Link>
          <button type="button" className="border border-outline-variant text-on-surface px-6 py-3 rounded-sm font-bold text-sm hover:bg-surface-container transition-colors" onClick={() => setGateOpen(true)}>Download Brochure</button>
          <Link to="/contact?topic=expert" className="border border-outline-variant text-on-surface px-6 py-3 rounded-sm font-bold text-sm hover:bg-surface-container transition-colors">Talk to an Expert</Link>
        </div>
      </section>

      {/* Manufacturer Partner */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-8">Our Trusted Manufacturer Partner</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <p className="text-on-surface-variant font-body leading-relaxed mb-6">
                We are proud to partner with <a href="http://en.beijingtailong.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">Beijing Tailong Electronic Technology</a> (Tyloong), a leading manufacturer
                of plasma etching equipment and semiconductor processing systems with over 30 years
                of experience in the industry. Their expertise in plasma etching processes,
                reactive ion etching technology, and plasma treatment solutions aligns perfectly with our mission to
                provide cutting-edge plasma etching equipment for research and manufacturing applications.
              </p>
              <ul className="space-y-2 text-on-surface-variant font-body">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">check_circle</span>Industry-leading R&D capabilities</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">check_circle</span>Global technical support network</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">check_circle</span>Proven track record in semiconductor manufacturing</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">check_circle</span>Comprehensive training and documentation</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">check_circle</span>Customizable solutions for specific research needs</li>
              </ul>
            </div>
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container rounded-xl p-6 text-center">
                <span className="text-4xl font-headline font-bold text-primary block">30+</span>
                <span className="text-sm text-on-surface-variant font-body">Years of Experience</span>
              </div>
              <div className="bg-surface-container rounded-xl p-6 text-center">
                <span className="text-4xl font-headline font-bold text-primary block">1000+</span>
                <span className="text-sm text-on-surface-variant font-body">Global Installations</span>
              </div>
              <div className="bg-surface-container rounded-xl p-6 text-center">
                <span className="text-4xl font-headline font-bold text-primary block">300+</span>
                <span className="text-sm text-on-surface-variant font-body">Research Institutions Served</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Catalog */}
      <section className="py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {tabs.map((t) => (
              <button
                key={t}
                className={`px-5 py-2.5 rounded-sm font-bold text-sm transition-colors ${selected === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-low'}`}
                onClick={() => setSelected(t as typeof selected)}
              >{t}</button>
            ))}
          </div>
          <p className="text-on-surface-variant font-body leading-relaxed max-w-4xl mb-12">
            Our comprehensive range of plasma etching equipment and semiconductor processing systems is designed to meet the diverse needs of research institutions and manufacturers. From reactive ion etching (RIE) to inductively coupled plasma etching, our plasma etching processes deliver optimized etch rates and superior plasma treatment capabilities. Each system is built with precision, reliability, and innovation in mind.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(selected === 'All' || selected === 'Etching') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/icp-etcher" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/icp-etcher/main.jpg')} alt="ICP‑RIE plasma etching system in cleanroom" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Etching</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">ICP Etcher Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Advanced inductively coupled plasma etching system with superior process control and optimized etch rates for high-aspect-ratio etching applications.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>High-density plasma source</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multi-gas capability</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Advanced temperature control</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Etching') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/rie-etcher" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/rie-etcher/main.jpg')} alt="Reactive Ion Etching system (RIE) for anisotropic etch" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Etching</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">RIE Etcher Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Versatile reactive ion etching system for precise material processing with excellent plasma treatment capabilities and controlled etch rates.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Flexible process control</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple gas options</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Compact design</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Etching') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/compact-rie" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/compact-rie/main.jpg')} alt="Compact RIE Etcher (SV-RIE) - compact reactive ion etching system" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Etching</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">Compact RIE Etcher (SV-RIE)</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Compact reactive ion etching system with ultra-small footprint (630mm x 600mm), ideal for research labs and pilot-scale processes.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Ultra-compact footprint: 630mm x 600mm</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Touchscreen control with fully automated operation</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Modular design for easy maintenance and transport</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Deposition') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/hdp-cvd" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/hdp-cvd/main.jpg')} alt="HDP‑CVD system for high‑density plasma chemical vapor deposition" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Deposition</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">HDP-CVD System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">High-density plasma CVD for superior film quality and gap-fill performance.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Excellent gap-fill capability</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>High deposition rates</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multi-zone heating</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Deposition') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/pecvd" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/pecvd/main.jpg')} alt="PECVD thin film deposition system" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Deposition</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">PECVD System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Plasma-enhanced CVD system for high-quality thin film deposition.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Low temperature processing</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple material options</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Precise control</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Deposition') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/ald" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/ald/main.jpg')} alt="Atomic Layer Deposition (ALD) system" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Deposition</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">ALD System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Atomic layer deposition system for precise thin film growth.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Atomic-level precision</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Excellent conformality</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple precursor lines</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Deposition') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/sputter" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/sputter/main.jpg')} alt="Sputter deposition system for high‑quality PVD coatings" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Deposition</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">Sputter System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Advanced PVD system for high-quality thin film coating.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple target positions</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>DC/RF capability</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Co-sputtering option</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Etching') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/ibe-ribe" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/ibe-ribe/main.jpg')} alt="Ion Beam Etching (IBE/RIBE) system for directional etch" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Etching</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">IBE/RIBE System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Ion beam etching system for precise material processing.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Dual mode operation</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Precise angle control</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple gas options</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/striper" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/striper/main.jpg')} alt="Plasma photoresist stripping system" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">Stripping System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Advanced photoresist stripping and surface cleaning system.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Multiple process modes</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>High throughput</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Process monitoring</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/hy-20l" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg')} alt="HY-20L - Compact RF Plasma Processing System" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">HY-20L</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Compact, research-grade RF plasma processing system with 20-liter chamber for batch plasma cleaning, photoresist ashing, and surface activation.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>20-liter batch processing chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>13.56 MHz RF power up to 300W</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>PLC-controlled with touch screen interface</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/hy-4l" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/ns-plasma-4r/main.jpg')} alt="HY-4L - Compact RF Plasma System" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">HY-4L</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Compact RF plasma system for research and sample preparation. 4L chamber volume, ideal for teaching labs and low-volume processing.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>~4 L processing chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>13.56 MHz RF plasma capability</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Simplified operation for new users</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/hy-20lrf" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/ns-plasma-20r-i/main.jpg')} alt="HY-20LRF - Research-Grade Batch Plasma Cleaning" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">HY-20LRF</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Integrated 20L RF vacuum plasma cleaner for batch surface cleaning and activation. Higher power + larger chamber + higher throughput for labs needing repeatable plasma surface treatment.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>20 L batch processing chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>300 W RF (13.56 MHz)</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>PLC + Touchscreen control</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/pluto-t" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/pluto-t/main.jpg')} alt="PLUTO-T - Compact RF Plasma Cleaner" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">PLUTO-T</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">200W RF plasma cleaner with ~4.3L stainless steel chamber. Touchscreen control, 13.56 MHz. $9,999 USD.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>200W RF (13.56 MHz)</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>~4.3L stainless steel chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Touchscreen control</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/pluto-m" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/pluto-m/main.jpg')} alt="PLUTO-M - Mid-Size RF Plasma Cleaner" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">PLUTO-M</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">200W RF plasma cleaner with ~8L stainless steel chamber. Batch processing capable, touchscreen control. $12,999 USD.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>200W RF (13.56 MHz)</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>~8L stainless steel chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Batch processing</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Cleaning/Stripping') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/pluto-f" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/pluto-f/main.jpg')} alt="PLUTO-F - Flagship RF Plasma Cleaner" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Cleaning/Stripping</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">PLUTO-F</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">500W RF plasma cleaner with ~14.5L aluminum alloy chamber. Advanced recipe management, touchscreen control. $15,999 USD.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>500W RF (13.56 MHz)</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>~14.5L aluminum alloy chamber</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Advanced recipe management</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}

            {(selected === 'All' || selected === 'Coating/Developing') && (
            <article className="bg-surface-container-low hover:bg-surface-container-lowest transition-all p-2 rounded-xl group">
              <Link to="/products/coater-developer" className="block">
                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-6">
                  <img src={cdnUrl('/assets/images/products/coater-developer/main.jpg')} alt="Coater/Developer system for photolithography" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-4 pb-6">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Coating/Developing</span>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 mt-2">Coater/Developer System Series</h3>
                  <p className="text-sm text-on-surface-variant font-body mb-3">Precision coating and developing system for photolithography.</p>
                  <ul className="text-xs text-on-surface-variant font-body space-y-1 mb-4">
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Dual module design</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Advanced dispensing</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-tertiary text-sm">bolt</span>Environmental control</li>
                  </ul>
                  <span className="w-full bg-primary text-white py-3 rounded-sm font-bold text-sm block text-center">View Specification</span>
                </div>
              </Link>
            </article>
            )}
          </div>
        </div>
      </section>

      {/* Etching Processes */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <button
            type="button"
            className="w-full flex items-center justify-between py-4 text-left"
            onClick={() => setEtchingOpen(!etchingOpen)}
            aria-expanded={etchingOpen}
          >
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight">Etching Processes</h2>
            <span className={`material-symbols-outlined text-on-surface-variant text-3xl transition-transform duration-300 ${etchingOpen ? 'rotate-180' : ''}`}>expand_more</span>
          </button>

          <div className={`overflow-hidden transition-all duration-500 ${etchingOpen ? 'max-h-[5000px] opacity-100 mt-8' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ICP-RIE */}
              <div className="bg-surface rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">plasma_circle</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">ICP-RIE -- High-Density Plasma for Advanced Etching</h3>
                </div>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed mb-4">
                  ICP-RIE systems provide high-density plasma with independent ion energy control, enabling vertical profiles and high
                  aspect-ratio features. Ideal for compound semiconductors and hard dielectrics that require fast etch rates with excellent selectivity.
                </p>
                <ul className="text-sm text-on-surface-variant font-body space-y-2 mb-6">
                  <li><strong className="text-on-surface">Independent control</strong> of ion density and ion energy</li>
                  <li><strong className="text-on-surface">High aspect-ratio</strong> pattern transfer</li>
                  <li><strong className="text-on-surface">Excellent uniformity</strong> on 4-8 inch wafers</li>
                </ul>
                <Link className="inline-block bg-primary text-on-primary px-5 py-2.5 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity" to="/products/icp-etcher">Explore ICP-RIE Systems</Link>
                <div className="mt-4">
                  <Link className="text-sm text-primary font-body hover:underline" to="/insights/icp-rie-technology-advanced-etching">Read: ICP-RIE Technology</Link>
                </div>
              </div>

              {/* RIE */}
              <div className="bg-surface rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">memory</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">RIE -- Directional Plasma Etching for Research</h3>
                </div>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed mb-4">
                  RIE plasma etching offers anisotropic, directional profiles by combining chemical reactions with physical ion bombardment --
                  a versatile choice for materials research and general microfabrication.
                </p>
                <ul className="text-sm text-on-surface-variant font-body space-y-2 mb-6">
                  <li><strong className="text-on-surface">Ideal for development</strong> and materials exploration</li>
                  <li><strong className="text-on-surface">Diverse chemistries</strong> and multi-gas recipes</li>
                  <li><strong className="text-on-surface">Compact footprint</strong> with robust control</li>
                </ul>
                <Link className="inline-block bg-primary text-on-primary px-5 py-2.5 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity" to="/products/rie-etcher">Explore RIE Systems</Link>
                <div className="mt-4 flex flex-col gap-1">
                  <Link className="text-sm text-primary font-body hover:underline" to="/insights/reactive-ion-etching-guide">Read: RIE Principles & Guide</Link>
                  <Link className="text-sm text-primary font-body hover:underline" to="/insights/reactive-ion-etching-vs-ion-milling">RIE vs Ion Milling</Link>
                </div>
              </div>

              {/* DRIE */}
              <div className="bg-surface rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">layers</span>
                  <h3 className="text-lg font-headline font-bold text-on-surface">DRIE (Bosch Process) -- Deep Silicon Etching for MEMS & TSV</h3>
                </div>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed mb-4">
                  DRIE Bosch process systems enable deep silicon etching by alternating passivation and etch steps, producing vertical trenches for MEMS,
                  TSV, and microfluidics with excellent sidewall control.
                </p>
                <ul className="text-sm text-on-surface-variant font-body space-y-2 mb-6">
                  <li><strong className="text-on-surface">High aspect-ratio</strong> deep silicon etching</li>
                  <li><strong className="text-on-surface">Optimized scalloping</strong> and sidewall quality</li>
                  <li><strong className="text-on-surface">Stable long cycles</strong> for extended processes</li>
                </ul>
                <Link className="inline-block bg-primary text-on-primary px-5 py-2.5 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity" to="/products/rie-etcher#drie">See DRIE Configurations</Link>
                <div className="mt-4">
                  <Link className="text-sm text-primary font-body hover:underline" to="/insights/deep-reactive-ion-etching-bosch-process">Read: DRIE -- Bosch Process</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-10">Applications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-4 block">precision_manufacturing</span>
              <h3 className="text-lg font-headline font-bold text-on-surface mb-2">MEMS Deep Silicon</h3>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">Accelerometers, pressure sensors, micro-mirrors. DRIE enables high aspect-ratio silicon structures.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-4 block">stacks</span>
              <h3 className="text-lg font-headline font-bold text-on-surface mb-2">3D IC / TSV</h3>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">Through-silicon vias and wafer-level packaging where vertical vias with high selectivity are required.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-4 block">sensors</span>
              <h3 className="text-lg font-headline font-bold text-on-surface mb-2">Photonics</h3>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">Waveguides and gratings on Si/SiN/III-V materials using ICP-RIE for smooth sidewalls and uniformity.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-4 block">science</span>
              <h3 className="text-lg font-headline font-bold text-on-surface mb-2">Materials Research</h3>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">Flexible RIE platforms for etching dielectrics, polymers, and novel materials in academic labs.</p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link to="/contact?topic=application" className="bg-primary text-on-primary px-8 py-3 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity inline-block">Discuss Your Application</Link>
          </div>
        </div>
      </section>

      {/* Equipment Solutions */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-6">Plasma Etching Equipment Solutions</h2>
          <p className="text-on-surface-variant font-body leading-relaxed max-w-4xl mb-8">
            Our plasma etching equipment solutions are tailored to meet the specific needs of research institutions and manufacturers. From reactive ion etching to inductively coupled plasma etching, we provide a wide range of plasma processing capabilities with optimized etch rates and superior plasma treatment technology.
          </p>
          <ul className="space-y-3 text-on-surface-variant font-body max-w-3xl">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">settings_suggest</span>
              <span>Customizable plasma etching system configurations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">integration_instructions</span>
              <span>Integration with existing semiconductor manufacturing facilities</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">school</span>
              <span>Comprehensive training and support for plasma etching processes</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">build</span>
              <span>Ongoing maintenance and upgrades for plasma processing equipment</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Related Technical Articles */}
      <section className="py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Related Technical Articles</h2>
          <p className="text-on-surface-variant font-body mb-8">Further reading on plasma etching processes and best practices.</p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-tertiary text-lg mt-0.5">article</span>
              <div>
                <Link to="/insights/plasma-etching" className="text-primary font-body font-semibold hover:underline">Plasma Etching Fundamentals</Link>
                <span className="text-on-surface-variant font-body text-sm"> -- overview of processes, terminology, and etch rate control.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-tertiary text-lg mt-0.5">article</span>
              <div>
                <Link to="/insights/plasma-cleaning-precision-surface-preparation" className="text-primary font-body font-semibold hover:underline">Plasma Cleaning for Precision Surface Preparation</Link>
                <span className="text-on-surface-variant font-body text-sm"> -- how plasma cleaning improves adhesion and device performance.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-tertiary text-lg mt-0.5">article</span>
              <div>
                <Link to="/insights/plasma-etching-explained-fundamentals-applications" className="text-primary font-body font-semibold hover:underline">Plasma Etching Explained: Fundamentals & Applications</Link>
                <span className="text-on-surface-variant font-body text-sm"> -- practical tips applicable to RIE and ICP processes.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Warranty & Service */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Warranty & Service</h2>
          <p className="text-on-surface-variant font-body mb-10">Comprehensive service solutions designed to maximize your equipment performance and minimize downtime.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface rounded-xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
                <h3 className="text-lg font-headline font-bold text-on-surface" id="hdr-warranty">Standard Warranty</h3>
              </div>
              <h4 className="font-headline font-bold text-on-surface text-sm mb-2">Standard Warranty Included</h4>
              <p className="text-xs text-on-surface-variant font-body italic mb-4">(Most major manufacturers only provide 1-year coverage. NineScrolls includes 2 years standard warranty with equipment purchase.)</p>
              <ul className="text-sm text-on-surface-variant font-body space-y-2">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Parts & labor coverage</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Manufacturing defects</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Component failures</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Technical support included</li>
              </ul>
            </div>

            <div className="bg-surface rounded-xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">build_circle</span>
                <h3 className="text-lg font-headline font-bold text-on-surface" id="hdr-pm">Preventive Maintenance</h3>
              </div>
              <h4 className="font-headline font-bold text-on-surface text-sm mb-2">One free PM service included</h4>
              <ul className="text-sm text-on-surface-variant font-body space-y-2">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>System optimization</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Performance calibration</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Preventive recommendations</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Expert technician service</li>
              </ul>
            </div>

            <div className="bg-surface rounded-xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">description</span>
                <h3 className="text-lg font-headline font-bold text-on-surface" id="hdr-ext">Extended Options</h3>
              </div>
              <h4 className="font-headline font-bold text-on-surface text-sm mb-2">Optional Service Contracts</h4>
              <ul className="text-sm text-on-surface-variant font-body space-y-2">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Optional service contracts (billed annually)</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Annual Maintenance Contracts (AMC) - billed annually</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Custom service agreements</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-sm">check</span>Priority support access</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-on-surface-variant font-body mb-4">Want full details? Contact us for warranty terms and AMC pricing.</p>
            <Link to="/contact" className="bg-primary text-on-primary px-8 py-3 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity inline-block">Contact Service Team</Link>
          </div>
        </div>
      </section>

      {/* Equipment Consultation CTA */}
      <section className="py-16">
        <div className="max-w-screen-2xl mx-auto px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Need Equipment Consultation?</h2>
          <p className="text-on-surface-variant font-body mb-8 max-w-2xl mx-auto">Our technical team is ready to help you choose the right equipment for your application.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/request-quote" className="bg-primary text-on-primary px-8 py-3 rounded-sm font-bold text-sm hover:opacity-90 transition-opacity">Contact Our Team</Link>
            <button type="button" className="border border-outline-variant text-on-surface px-8 py-3 rounded-sm font-bold text-sm hover:bg-surface-container transition-colors" onClick={() => setGateOpen(true)}>Download Equipment Guide</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-screen-2xl mx-auto px-8">
          <button
            type="button"
            className="w-full flex items-center justify-between py-4 text-left"
            onClick={() => setFaqOpen(!faqOpen)}
            aria-expanded={faqOpen}
          >
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-on-surface tracking-tight">Frequently Asked Questions About Plasma Etching Equipment</h2>
            <span className={`material-symbols-outlined text-on-surface-variant text-3xl transition-transform duration-300 flex-shrink-0 ml-4 ${faqOpen ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          <div className={`overflow-hidden transition-all duration-500 ${faqOpen ? 'max-h-[3000px] opacity-100 mt-8' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface rounded-xl p-8">
                <h3 className="text-lg font-headline font-bold text-on-surface mb-3">What is plasma etching equipment?</h3>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed">Plasma etching equipment uses ionized gas (plasma) to remove material from substrates with precise control. Our plasma etching systems include reactive ion etching (RIE) and inductively coupled plasma etching technologies for semiconductor manufacturing and research applications.</p>
              </div>
              <div className="bg-surface rounded-xl p-8">
                <h3 className="text-lg font-headline font-bold text-on-surface mb-3">How do plasma etching processes work?</h3>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed">Plasma etching processes work by creating a plasma from process gases using RF power. The plasma contains reactive species that chemically react with the substrate material, while ions provide physical bombardment for directional etching, achieving optimized etch rates and superior material selectivity.</p>
              </div>
              <div className="bg-surface rounded-xl p-8">
                <h3 className="text-lg font-headline font-bold text-on-surface mb-3">What are the advantages of plasma etching over wet etching?</h3>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed">Plasma etching offers superior anisotropy (directional control), better etch rate control, reduced chemical waste, and compatibility with photoresist masks. Our plasma treatment solutions provide both wet etching and dry etching capabilities for maximum process flexibility.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JSON-LD Schema */}
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is plasma etching equipment?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Plasma etching equipment uses ionized gas (plasma) to remove material from substrates with precise control. Our plasma etching systems include reactive ion etching (RIE) and inductively coupled plasma etching technologies for semiconductor manufacturing and research applications."
              }
            },
            {
              "@type": "Question",
              "name": "How do plasma etching processes work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Plasma etching processes work by creating a plasma from process gases using RF power. The plasma contains reactive species that chemically react with the substrate material, while ions provide physical bombardment for directional etching, achieving optimized etch rates and superior material selectivity."
              }
            },
            {
              "@type": "Question",
              "name": "What are the advantages of plasma etching over wet etching?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Plasma etching offers superior anisotropy (directional control), better etch rate control, reduced chemical waste, and compatibility with photoresist masks. Our plasma treatment solutions provide both wet etching and dry etching capabilities for maximum process flexibility."
              }
            }
          ]
        })}</script>
      </Helmet>

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/NineScrolls-Equipment-Guide.pdf'}
        fileName={'NineScrolls-Equipment-Guide.pdf'}
        title={'Download Equipment Guide'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />

    </>
  );
}
