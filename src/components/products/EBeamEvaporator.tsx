import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { useProductPage } from '../../hooks/useProductPage';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { ProductQuoteModal } from './ProductQuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { SEO } from '../common/SEO';
import { cdnUrl } from '../../config/imageConfig';

export function EBeamEvaporator() {
  const { isModalOpen, isQuoteIntent, openContactForm, closeContactForm } = useProductPage();
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useScrollToTop();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/e-beam-evaporator#product",
    "name": "E-Beam Evaporation System (MEB-600)",
    "description": "Combined e-beam and thermal-resistance evaporator in a single chamber with 10 kW e-gun, 6×17 cc water-cooled crucibles, INFICON closed-loop quartz monitor, and ≤±5% uniformity over Φ6\" wafers. Cited in ACS Applied Materials & Interfaces (2024) for infrared image sensor fabrication.",
    "image": ["https://ninescrolls.com/assets/images/products/e-beam/main.jpg"],
    "sku": "meb-600",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "citation": [
      { "@type": "ScholarlyArticle", "name": "Dimension-Confined Growth of a Crack-Free PbS Microplate Array for Infrared Image Sensing", "datePublished": "2024-05-09", "isPartOf": { "@type": "Periodical", "name": "ACS Applied Materials & Interfaces" }, "sameAs": "https://doi.org/10.1021/acsami.4c01807" },
      { "@type": "ScholarlyArticle", "name": "Coronene Enhanced CMOS Image Sensor", "datePublished": "2023", "isPartOf": { "@type": "Periodical", "name": "Journal of Infrared and Millimeter Waves" }, "sameAs": "https://doi.org/10.11972/j.issn.1001-9014.2023.06.027" },
      { "@type": "ScholarlyArticle", "name": "Fabrication of Ge/ZnS Photonic Crystal and Its Infrared-Wave Transmitting Properties", "datePublished": "2025", "isPartOf": { "@type": "Periodical", "name": "Basic Sciences Journal of Textile Universities" } }
    ],
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/e-beam-evaporator",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "US" },
        "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "USD" },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "businessDays": { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
          "cutoffTime": "14:00",
          "handlingTime": { "@type": "QuantitativeValue", "minValue": 21, "maxValue": 28, "unitCode": "DAY" },
          "transitTime": { "@type": "QuantitativeValue", "minValue": 7, "maxValue": 14, "unitCode": "DAY" }
        }
      }
    }
  };

  return (
    <>
      <SEO
        title="E-Beam Evaporation System (MEB-600) — Multi-Source IR & Photonic Thin-Film Evaporator"
        description='MEB-600 combined e-beam (10 kW, 270°) + thermal evaporator with 6×17 cc water-cooled crucibles, INFICON closed-loop quartz monitor, ≤±5% uniformity over Φ6" wafers, Siemens PLC recipe control. Cited in ACS Appl. Mater. Interfaces (2024). For IR sensors, photonic crystals, and optoelectronic thin films.'
        keywords="e-beam evaporator, MEB-600, electron beam evaporation system, thermal evaporator, PVD evaporation, QCM thickness monitor, infrared coating, photonic crystal deposition, PbS evaporation, IR sensor fabrication, lift-off evaporation"
        url="/products/e-beam-evaporator"
        image={cdnUrl('/assets/images/products/e-beam/main.jpg')}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Hero */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/products/product-detail-bg.jpg')} alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'E-Beam Evaporation System', path: '/products/e-beam-evaporator' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">E-Beam Evaporation System (MEB-600)</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Multi-Source Evaporator for Infrared, Photonic &amp; Optoelectronic Thin Films</p>
            <p className="text-base text-white/80 tracking-wide">
              10 kW E-Beam + 3 kW Thermal · INFICON Closed-Loop QCM · 6×17 cc Crucible · Siemens PLC Recipe Control
            </p>

            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                Research-grade evaporator with verified academic track record
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                Cited in <em>ACS Applied Materials &amp; Interfaces</em> (2024) for crack-free PbS microplate
                growth, plus published work in IR sensors and photonic crystals. Configurable for metals,
                oxides, nitrides and fluorides; baseline single-wafer Φ6&quot; substrate, larger chambers and
                umbrella / dome holders available on request.
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
                src={cdnUrl('/assets/images/products/e-beam/main.jpg')}
                alt="MEB-600 multi-source e-beam and thermal evaporation system for infrared and photonic thin films"
                className="w-full rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                The MEB-600 is a multi-source physical vapor deposition system that combines an XY-scanned
                electron beam gun with thermal resistance boats inside a single high-vacuum chamber. A
                6-pocket E-gun crucible (17 cc per pocket) lets researchers deposit metals, oxides, nitrides,
                fluorides and compound semiconductors in sequence without breaking vacuum, while an in-situ
                quartz-crystal monitor (QCM) provides real-time thickness control and endpoint detection.
                Variable-speed planetary rotation and optional ion-source pre-clean make the system equally
                suited to optical multilayers, lift-off metallization, and infrared device fabrication.
              </p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Combined e-beam and thermal-resistance evaporation in a single SS304 vacuum chamber
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  10 kW E-type electron gun, 270° deflection, programmable X-Y scan (10–250 Hz)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  6 × 17 cc oxygen-free copper crucibles, water-cooled, automatic indexing &amp; shutter
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Dual-electrode 3 kW thermal-resistance source with auto-switching and shutters
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  INFICON closed-loop quartz-crystal monitor, 0.1 Å/s rate / 1 Å thickness resolution
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  ≤±5% film uniformity over Φ6&quot; wafer (baseline)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Substrate heating: planar RT–300 °C (quartz lamp) or umbrella RT–200 °C, PID ±1 °C
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  KYKY 1200 L/s composite turbo + ULVAC 12 L/s rotary pumping; ultimate 6.7×10⁻⁵ Pa
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Siemens PLC + Advantech IPC, Windows GUI; auto / manual modes, recipe logging
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Recirculating chiller and silent air compressor included; safety interlocks &amp; alarms
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">visibility</span>
                  Infrared image sensors (PbS / PbSe / MgO sacrificial layers)
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">grid_on</span>
                  IR-stealth &amp; radar-transparent photonic crystals (Ge/ZnS multilayers)
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">filter_b_and_w</span>
                  UV down-conversion films on CMOS image sensors
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                  Optical AR coatings, dielectric multilayers and protective films
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">developer_board</span>
                  Lift-off metallization for MEMS, optoelectronics and quantum devices
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  General PVD research and teaching applications
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
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">System Specifications (baseline configuration)</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Configuration</td>
                  <td className="px-6 py-3 text-on-surface-variant">Combined e-beam + thermal-resistance evaporation, single vacuum chamber</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber</td>
                  <td className="px-6 py-3 text-on-surface-variant">SS304, vertical cylindrical, front-opening, water-cooled walls; Φ600 × H600 mm baseline (larger / smaller available)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint &amp; Mass</td>
                  <td className="px-6 py-3 text-on-surface-variant">2200 × 1500 × 2000 mm (L × W × H); ~1100 kg</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Substrate Holder</td>
                  <td className="px-6 py-3 text-on-surface-variant">Rotating planar holder, max Φ6&quot; single wafer, 1–10 rpm continuously variable; umbrella / dome holder available</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Source-to-Substrate</td>
                  <td className="px-6 py-3 text-on-surface-variant">330–370 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">E-Beam Gun</td>
                  <td className="px-6 py-3 text-on-surface-variant">E-type, 270° deflection; max 10 kW; –8 / –10 kV anode (selectable); 0–1000 mA @ 10 kV</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">E-Beam Scan</td>
                  <td className="px-6 py-3 text-on-surface-variant">X-Y deflection ±2.0 A each, 10–250 Hz, programmable per recipe</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Crucibles</td>
                  <td className="px-6 py-3 text-on-surface-variant">6 × 17 cc oxygen-free copper, water-cooled, automatic indexing, automatic shutter</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Thermal Resistance</td>
                  <td className="px-6 py-3 text-on-surface-variant">Two evaporation electrode sets with auto-switching; 3 kW supply; compatible with boats and helical filaments; auto shutters</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Thickness Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">INFICON quartz-crystal monitor, closed-loop with source shutters; 0–9999.9 Å/s (0.1 Å/s resolution); 1 Å thickness resolution</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Film Uniformity</td>
                  <td className="px-6 py-3 text-on-surface-variant">≤±5% over Φ6&quot; (baseline)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Substrate Heating</td>
                  <td className="px-6 py-3 text-on-surface-variant">Planar: RT–300 °C (quartz lamp); Umbrella: RT–200 °C (sheathed); PID ±1 °C</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Ultimate Vacuum</td>
                  <td className="px-6 py-3 text-on-surface-variant">6.7 × 10⁻⁵ Pa (at ≤55% RH)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Pump-down Time</td>
                  <td className="px-6 py-3 text-on-surface-variant">Atm → 9.0 × 10⁻⁴ Pa in ≤35 min</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum Pumps</td>
                  <td className="px-6 py-3 text-on-surface-variant">KYKY 1200 L/s composite turbomolecular + ULVAC (Ningbo) 12 L/s rotary; gate-valve isolated</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum Gauging</td>
                  <td className="px-6 py-3 text-on-surface-variant">Digital combined gauge — Pirani (low vacuum) + cold cathode (high vacuum)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Control System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Siemens PLC + Advantech IPC, Windows-style GUI; auto / manual modes; recipe programming and run logging</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Safety &amp; Alarms</td>
                  <td className="px-6 py-3 text-on-surface-variant">Interlocks; auto power-loss recipe memory; recipe validation; alarms for water failure, TMP fault, communication fault</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Optional Modules</td>
                  <td className="px-6 py-3 text-on-surface-variant">Ion-source pre-clean · Optical monitor · Composite mask · Custom planetary / umbrella fixtures</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Included Utilities</td>
                  <td className="px-6 py-3 text-on-surface-variant">Recirculating chiller; silent air compressor</td>
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
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Dual e-beam and thermal sources in one chamber</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> ±3–5% film thickness uniformity across substrate</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> In-situ QCM endpoint control to sub-nanometer precision</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> 6-pocket crucible eliminates vacuum breaks between materials</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Multi-layer and stack-engineered film capability</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Compatible with lift-off, shadow-mask and full-area deposition</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Optional ion-source pre-clean for improved adhesion</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Recipe-driven semi/full-auto operation for repeatability</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Material Systems</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Pure Metals (Au, Al, Cr, Ti, Ni, Pt, Pd, Cu…)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Oxides (SiO₂, TiO₂, Al₂O₃, MgO, HfO₂…)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Fluorides for IR/UV optics (MgF₂, CaF₂, LiF, YF₃…)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> IR-active materials (Ge, ZnS, ZnSe, PbS, PbSe…)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Organic small molecules (e.g. coronene for down-conversion films)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Multi-layer photonic crystals and antireflection stacks</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compare PVD options (collapsed by default) */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-6">
          <details className="bg-white rounded-xl shadow-sm border border-outline-variant/30 group">
            <summary className="cursor-pointer px-6 py-5 font-headline text-xl font-semibold text-on-surface flex items-center justify-between gap-4 list-none">
              <span>Compare E-Beam vs Sputter vs Thermal — click to expand</span>
              <span className="material-symbols-outlined text-primary transition-transform group-open:rotate-180">expand_more</span>
            </summary>
            <div className="px-6 pb-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30">
                    <th className="text-left px-3 py-2 font-semibold text-on-surface">Aspect</th>
                    <th className="text-left px-3 py-2 font-semibold text-primary">E-Beam (MEB-600)</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface">Magnetron Sputter</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface">Thermal (Boat)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-outline-variant/20">
                    <td className="px-3 py-2 font-medium">Best for</td>
                    <td className="px-3 py-2 text-on-surface-variant">High-melting metals, oxides, IR/UV optics, lift-off</td>
                    <td className="px-3 py-2 text-on-surface-variant">Compound &amp; magnetic films, large-area uniformity</td>
                    <td className="px-3 py-2 text-on-surface-variant">Low-melting metals, organics, simple Au/Al lift-off</td>
                  </tr>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
                    <td className="px-3 py-2 font-medium">Step coverage</td>
                    <td className="px-3 py-2 text-on-surface-variant">Directional (good for lift-off)</td>
                    <td className="px-3 py-2 text-on-surface-variant">More conformal</td>
                    <td className="px-3 py-2 text-on-surface-variant">Directional</td>
                  </tr>
                  <tr className="border-b border-outline-variant/20">
                    <td className="px-3 py-2 font-medium">Film purity</td>
                    <td className="px-3 py-2 text-on-surface-variant">Very high (line-of-sight)</td>
                    <td className="px-3 py-2 text-on-surface-variant">Depends on target purity</td>
                    <td className="px-3 py-2 text-on-surface-variant">Very high</td>
                  </tr>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
                    <td className="px-3 py-2 font-medium">Multi-material runs</td>
                    <td className="px-3 py-2 text-on-surface-variant">6-pocket crucible — no vacuum break</td>
                    <td className="px-3 py-2 text-on-surface-variant">2–6 targets; requires shutter switching</td>
                    <td className="px-3 py-2 text-on-surface-variant">Limited — manual boat swap</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Typical applications</td>
                    <td className="px-3 py-2 text-on-surface-variant">IR sensors, photonic crystals, optical multilayers</td>
                    <td className="px-3 py-2 text-on-surface-variant">Magnetic media, transparent conductors, alloys</td>
                    <td className="px-3 py-2 text-on-surface-variant">Contact metallization, organic device electrodes</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-4 text-sm text-on-surface-variant">
                Need sputtering instead? See the <a href="/products/sputter" className="text-primary underline hover:opacity-80">Sputter System Series</a>.
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              {
                q: 'When should I choose e-beam evaporation over thermal evaporation?',
                a: 'E-beam evaporation handles high-melting-point materials (refractory metals, oxides, fluorides) and gives very high film purity through localized heating. Thermal resistance evaporation is simpler and well-suited to low-melting metals like Au, Al and Ag, and to organic small molecules. Because the MEB-600 includes both source types in one chamber, you can pick whichever is right for each layer without changing systems.',
              },
              {
                q: 'Does swapping source materials require breaking vacuum?',
                a: 'The 6-pocket E-gun crucible holds up to six different materials simultaneously, so multilayer stacks (e.g. Ge/ZnS photonic crystals or metal/oxide stacks) can be deposited in a single pump-down. You only need to break vacuum when refilling pockets or switching thermal boat materials.',
              },
              {
                q: 'How accurate is the in-situ QCM thickness control?',
                a: 'The quartz-crystal monitor measures sub-nanometer thickness changes in real time and supports endpoint-driven recipes. Day-to-day repeatability depends on tooling-factor calibration, but published work using the MEB-600 reports thickness control sufficient for 80 nm sacrificial layers and IR photonic crystals with 0.0059 emissivity targets.',
              },
              {
                q: 'What substrate sizes and fixtures does the MEB-600 support?',
                a: 'The baseline configuration accepts a single Φ6" wafer on a rotating planar holder (1–10 rpm). Larger chambers, multi-wafer planetary fixtures, and umbrella / dome holders are available on request — useful for non-standard substrates such as polyimide flexible substrates, curved IR optics, or small chip carriers. The chamber is Φ600 × H600 mm in the baseline build, also customisable.',
              },
              {
                q: 'Can the system support lift-off metallization?',
                a: 'Yes. E-beam and thermal evaporation are both directional (line-of-sight), which is ideal for lift-off processes used in MEMS, optoelectronic and quantum-device fabrication. Pair with the optional ion-source pre-clean for improved adhesion on patterned resist surfaces.',
              },
              {
                q: 'What is typical maintenance and consumables cost?',
                a: 'Routine maintenance covers crucible-pocket liners, e-gun filaments, QCM crystals and pump service. Service intervals depend on duty cycle and process chemistry — most research labs run quarterly preventive maintenance with annual major service. We provide a maintenance plan and recommended consumables list with each system; contact us for a written quote tailored to your projected use.',
              },
              {
                q: 'Is the system suitable for organic / small-molecule films?',
                a: 'Yes — the thermal resistance source is well-suited to organic small molecules. Published work using the MEB-600 includes coronene films thermally evaporated onto quartz and CMOS sensor surfaces for UV down-conversion. The chamber design allows low source temperatures and gentle deposition without electron-beam damage to the organic film.',
              },
              {
                q: 'How is the MEB-600 backed by published research?',
                a: 'The system has been used in peer-reviewed work in ACS Applied Materials & Interfaces (PbS microplate IR sensor, 2024), Journal of Infrared and Millimeter Waves (UV-enhanced CMOS, 2023) and Basic Sciences Journal of Textile Universities (Ge/ZnS photonic crystals, 2025). See the citations section below for details.',
              },
            ].map((item, i) => (
              <details key={i} className="bg-surface-container-low rounded-xl border border-outline-variant/30 group">
                <summary className="cursor-pointer px-6 py-4 font-medium text-on-surface flex items-center justify-between gap-4 list-none">
                  <span>{item.q}</span>
                  <span className="material-symbols-outlined text-primary transition-transform group-open:rotate-180 shrink-0">expand_more</span>
                </summary>
                <div className="px-6 pb-5 text-on-surface-variant leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Verified in Peer-Reviewed Research"
        subtitle="The MEB-600 has been used in published work on infrared image sensors, photonic crystals, and CMOS down-conversion films across multiple research institutions."
        stats={[
          { value: '3', label: 'Verified Publications' },
          { value: '6', suffix: '+', label: 'Total Citations' },
          { value: '3', label: 'Research Institutions' },
          { value: '2023', suffix: '–25', label: 'Publication Years' },
        ]}
        publications={[
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'top',
            title: 'Dimension-Confined Growth of a Crack-Free PbS Microplate Array for Infrared Image Sensing',
            authors: 'Wan Y, Wang Y, Yuan S, Wan Z, Lu Y, Wang L, Wang Q · Nanchang University',
            year: '2024',
            citations: 4,
          },
          {
            journal: 'Journal of Infrared and Millimeter Waves',
            tier: 'high',
            title: 'Coronene Enhanced CMOS Image Sensor (UV down-conversion film via thermal evaporation)',
            authors: 'Luo L, Song L-Y, Tang L-B et al. · Yunnan University & Kunming Institute of Physics',
            year: '2023',
            citations: 2,
          },
          {
            journal: 'Basic Sciences Journal of Textile Universities',
            tier: 'mid',
            title: 'Fabrication of Ge/ZnS Photonic Crystal and Its Infrared-Wave Transmitting Properties',
            authors: 'Su X, Wang X, Liu Y, Lu L · Xi\u2019an Polytechnic University',
            year: '2025',
            citations: 0,
          },
        ]}
        journalNames={['ACS AMI', 'J. Infrared Millim. Waves', 'BSJ Textile Univ.']}
        onRequestQuote={() => openContactForm(true)}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related Equipment & Articles */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Related Equipment &amp; Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <a href="/products/sputter" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">grid_view</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Sputter System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">PVD alternative for compound, magnetic, and large-area uniform films.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/products/pecvd" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">settings</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">PECVD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Plasma-enhanced CVD for dielectric films and conformal deposition.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/products/ald" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">biotech</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">ALD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Atomic-layer-precise conformal films for complex topographies.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/e-beam-vs-thermal-vs-sputter-pvd-system-selection" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">E-Beam vs Thermal vs Sputter</h3>
              <p className="text-sm text-on-surface-variant mb-3">Decision guide: which PVD technique fits your lab&apos;s materials, substrates, and budget.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Request Information</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">Get detailed e-beam evaporator specs, pricing &amp; customization options.</p>
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

      <ProductQuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="E-Beam Evaporation System (MEB-600)"
        brochureHref="/docs/e-beam-evaporator-datasheet.pdf"
        brochureFilename="NineScrolls-MEB-600-Spec-Sheet.pdf"
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/e-beam-evaporator-datasheet.pdf'}
        fileName={'NineScrolls-MEB-600-Spec-Sheet.pdf'}
        title={'Download MEB-600 Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
