import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function HY20LRF() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'front'>('main');
  const navigate = useNavigate();
  const { addItem } = useCart();

  useScrollToTop();

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleDownloadBrochure = () => {
    const a = document.createElement('a');
    a.href = '/docs/hy-20lrf-datasheet.pdf';
    a.download = 'NineScrolls-HY-20LRF-Datasheet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAddToCart = () => {
    addItem({
      id: 'hy-20lrf',
      name: 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner',
      price: 14499,
      quantity: 1,
      image: '/assets/images/products/ns-plasma-20r-i/main.jpg',
      sku: 'hy-20lrf',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 14499,
          items: [{
            item_id: 'hy-20lrf',
            item_name: 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 14499,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('hy-20lrf', 'HY-20LRF - RF (13.56 MHz) Batch Plasma Cleaner', 14499);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/hy-20lrf#product",
    "name": "HY-20LRF — Research-Grade Batch Plasma Cleaning",
    "description": "Research-grade 20L RF vacuum plasma cleaner for batch surface cleaning and activation. 13.56MHz up to 300W, PLC touchscreen control, 2 gas lines (O\u2082/N\u2082/Ar). US price $14,499.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-20r-i/main.jpg"],
    "sku": "hy-20lrf",
    "mpn": "HY-20LRF",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "14499",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/hy-20lrf",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "NineScrolls LLC",
        "url": "https://ninescrolls.com"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "USD"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "businessDays": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
          },
          "cutoffTime": "14:00",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 21,
            "maxValue": 28,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 7,
            "maxValue": 14,
            "unitCode": "DAY"
          }
        }
      }
    }
  };

  return (
    <>
      <SEO
        title="HY-20LRF | 20L RF Vacuum Plasma Cleaner | 13.56MHz 300W | $14,499"
        description="Research-grade 20L RF vacuum plasma cleaner for batch surface cleaning and activation. 13.56MHz up to 300W, PLC touchscreen control, 2 gas lines (O\u2082/N\u2082/Ar). US price $14,499."
        keywords="HY-20LRF, RF Plasma Cleaner, Vacuum Plasma, 20L Chamber, Surface Activation, Batch Processing, Research Lab, Integrated plasma system, 13.56MHz plasma, 300W RF"
        url="/products/hy-20lrf"
        image="/assets/images/products/ns-plasma-20r-i/main.jpg"
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Is the HY-20LRF suitable for delicate samples?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. Plasma is a dry process; users can tune gas, power, and time for gentle activation. The PLC control system allows precise parameter adjustment to minimize sample damage while achieving desired surface modification."
                }
              },
              {
                "@type": "Question",
                "name": "What gases can I use with the HY-20LRF?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Common choices include O\u2082, N\u2082, Ar, and mixed gases (with 2 gas lines). The system supports flexible gas configurations for various surface treatment applications."
                }
              },
              {
                "@type": "Question",
                "name": "Is the HY-20LRF repeatable for research data?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. PLC + touchscreen control supports stable, repeatable operation across runs. Process parameters can be saved and recalled, ensuring consistent results for research documentation and publication."
                }
              }
            ]
          })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src="/assets/images/products/product-detail-bg.jpg" alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'HY-20LRF', path: '/products/hy-20lrf' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">HY-20LRF</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Research-Grade Batch Plasma Cleaning (20 L)</p>
            <p className="text-base text-white/80 tracking-wide mb-1">
              Higher power + larger chamber + higher throughput for labs needing repeatable plasma surface treatment.
            </p>
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

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">inventory_2</span>
                <div>
                  <span className="block font-semibold text-white text-sm">20 L Stainless-Steel Batch Chamber</span>
                  <span className="block text-white/70 text-xs">higher throughput for batch processing</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold text-white text-sm">13.56 MHz RF Plasma, up to 300 W</span>
                  <span className="block text-white/70 text-xs">customizable power for research needs</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">monitor</span>
                <div>
                  <span className="block font-semibold text-white text-sm">PLC + Touchscreen Control</span>
                  <span className="block text-white/70 text-xs">Auto / Manual modes for reproducibility</span>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">air</span>
                <div>
                  <span className="block font-semibold text-white text-sm">2 Gas Inlets (O&#8322; / N&#8322; / Ar)</span>
                  <span className="block text-white/70 text-xs">mixed gases supported</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">science</span>
                <div>
                  <span className="block font-semibold text-white text-sm">Dry Cleaning & Surface Activation</span>
                  <span className="block text-white/70 text-xs">without wet chemistry</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-white/80 text-sm font-medium">US Price:</span>
                <span className="text-2xl font-bold text-white">$14,499 USD</span>
              </div>
              <p className="text-white/70 text-sm">Availability: In Stock &bull; Ships in 3-4 weeks</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
              <button
                className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors"
                onClick={() => openContactForm(true)}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* System Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="min-w-0 overflow-hidden">
              <div className="[&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-auto">
                {selectedImage === 'main' && (
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                    alt="HY-20LRF - 20L Batch Plasma Cleaning System"
                    width={800}
                    height={600}
                    className="w-full rounded-xl shadow-lg"
                  />
                )}
                {selectedImage === 'front' && (
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-20r-i/front-view.jpg"
                    alt="HY-20LRF - Front View"
                    width={800}
                    height={600}
                    className="w-full rounded-xl shadow-lg"
                  />
                )}
              </div>
              <div className="flex gap-3 mt-3 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'main' ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('main')}
                  type="button"
                  aria-label="Main view"
                >
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                    alt="Main View Thumbnail"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'front' ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('front')}
                  type="button"
                  aria-label="Front view"
                >
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-20r-i/front-view.jpg"
                    alt="Front View Thumbnail"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">System Overview</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                HY-20LRF is a compact, research-grade RF vacuum plasma system designed for batch plasma cleaning,
                surface activation, and adhesion improvement. With a 20-liter chamber and PLC-controlled operation,
                it delivers repeatable results for academic labs and R&D environments.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                The system features a stainless-steel batch chamber, 13.56 MHz RF plasma source with up to 300W power
                (customizable), and dual gas inlets supporting O&#8322;, N&#8322;, Ar, and mixed gases. PLC + touchscreen control
                with Auto / Manual modes ensures reproducible processes suitable for research documentation and scale-up studies.
              </p>

              <div className="p-4 bg-blue-50 rounded-lg border-l-[3px] border-primary">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <Link
                    to="/insights/plasma-cleaner-comparison-research-labs"
                    className="text-primary font-medium hover:underline no-underline"
                  >
                    Learn how research-grade batch plasma cleaners differ from desktop systems &rarr;
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Typical Applications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Cleaning</h3>
              <p className="text-sm text-primary font-medium mb-2">Organic removal and residue cleaning</p>
              <p className="text-on-surface-variant text-sm">Effective removal of organic contaminants, photoresist residues, and surface contaminants from substrates and components.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Activation</h3>
              <p className="text-sm text-primary font-medium mb-2">Adhesion improvement before coating/bonding</p>
              <p className="text-on-surface-variant text-sm">Enhance surface energy and improve adhesion characteristics prior to thin film deposition, coating, or bonding processes.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Polymer/Plastics Treatment</h3>
              <p className="text-sm text-primary font-medium mb-2">Pre-bond activation and surface modification</p>
              <p className="text-on-surface-variant text-sm">Surface treatment of polymers and plastics to improve wettability, adhesion, and bonding characteristics.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">assessment</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Sample Preparation</h3>
              <p className="text-sm text-primary font-medium mb-2">Prior to thin film deposition / coating</p>
              <p className="text-on-surface-variant text-sm">Prepare substrates and samples for subsequent processing steps, ensuring clean and activated surfaces for optimal results.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Specifications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">System Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr>
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">System Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Model</td>
                  <td className="px-6 py-3 text-on-surface-variant">HY-20LRF</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Supply</td>
                  <td className="px-6 py-3 text-on-surface-variant">110 V</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">300 W (customizable)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Frequency</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz RF</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">System Dimensions (L x W x H)</td>
                  <td className="px-6 py-3 text-on-surface-variant">630 x 580 x 810 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">250 x 250 x 320 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">20 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Sample Tray Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">242 x 250 x 45 mm (4 layers)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">PLC + Touchscreen, Auto / Manual switchable</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Lines</td>
                  <td className="px-6 py-3 text-on-surface-variant">2 lines</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Compatible Gases</td>
                  <td className="px-6 py-3 text-on-surface-variant">O&#8322;, N&#8322;, Ar (mixed gases supported)</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Pumping Speed</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical pump 4.4 L/s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">What's Included</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">HY-20LRF Main System</h3>
              <p className="text-on-surface-variant leading-relaxed">Integrated RF plasma source and vacuum chamber with stainless-steel construction.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">PLC Touchscreen Control Interface</h3>
              <p className="text-on-surface-variant leading-relaxed">User-friendly control system with Auto / Manual operation modes.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">4-Layer Sample Tray Set</h3>
              <p className="text-on-surface-variant leading-relaxed">Multi-level sample trays (242 x 250 x 45 mm) for efficient batch processing.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Standard Vacuum Pump</h3>
              <p className="text-on-surface-variant leading-relaxed">Mechanical pump with 4.4 L/s pumping speed for optimal process conditions.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">User Documentation</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive user manual and basic operation guidance for quick startup.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Options / Customization */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Options / Customization (Recommended)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Power Customization</h3>
              <p className="text-on-surface-variant leading-relaxed">Customize RF power output based on your specific process needs and material requirements.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Additional Gas Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">Upgrade to 3 gas lines if your processes require more complex gas mixing capabilities.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Recipe Templates</h3>
              <p className="text-on-surface-variant leading-relaxed">Pre-configured process recipes and training package for common applications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-3">
                Q: Is this system suitable for delicate samples?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: Plasma is a dry process; users can tune gas/power/time for gentle activation. The PLC control system allows precise parameter adjustment to minimize sample damage while achieving desired surface modification.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-3">
                Q: What gases can I use?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: Common choices include O&#8322;, N&#8322;, Ar, and mixed gases (with 2 gas lines). The system supports flexible gas configurations for various surface treatment applications.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-3">
                Q: Is it repeatable for research data?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLC + touchscreen control supports stable, repeatable operation across runs. Process parameters can be saved and recalled, ensuring consistent results for research documentation and publication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Distributor Notice */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-surface-container-low rounded-xl p-8 border-l-[5px] border-outline-variant">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-4">Distributor Notice</h3>
            <p className="text-on-surface-variant leading-relaxed">
              HY Series plasma systems are manufactured by Shenzhen Huiyi Zhikong Technology Co., Ltd. (&#24935;&#20202;&#26234;&#25511;), a leading plasma equipment manufacturer with 30+ years of industry experience and 1,000+ global installations. NineScrolls LLC is the authorized US distributor, providing local sales, technical support, system configuration, and warranty service.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Logos Section */}
      <TrustSection />

      {/* What You Can Expect */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">What You Can Expect When Working With Us</h2>
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">US-based sales & project coordination</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Installation & training support available</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Engineering-backed configuration (not off-the-shelf)</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">NDA & export compliance supported</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Responsive support before & after delivery</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Ready to order?</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">
            You don't need a finalized specification or PO to reach out.
            We often assist labs during early evaluation and proposal stages.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary/90 transition-colors"
              onClick={handleAddToCart}
            >
              Add to Cart
            </button>
            <button
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary hover:text-on-primary transition-colors"
              onClick={() => openContactForm(true)}
            >
              Request a Budgetary Quote
            </button>
          </div>
          <p className="text-sm text-on-surface-variant mt-6">
            <strong>Shipping:</strong> Free shipping included. Standard delivery: 3-4 weeks after order confirmation.
          </p>
        </div>
      </section>

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        onDownloadBrochure={handleDownloadBrochure}
        productName="HY-20LRF"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
