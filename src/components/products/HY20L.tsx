import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { cdnUrl } from '../../config/imageConfig';

export function HY20L() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'front'>('main');
  const [selectedFrequency, setSelectedFrequency] = useState<'rf' | 'mf'>('rf'); // Default to RF
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

  const handleAddToCart = () => {
    const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
    const price = selectedFrequency === 'rf' ? 14999 : 11999;
    const sku = selectedFrequency === 'rf' ? 'hy-20l-rf' : 'hy-20l-mf';

    addItem({
      id: sku,
      name: `HY-20L - ${frequencyLabel} Plasma Processing System`,
      price: price,
      quantity: 1,
      image: cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg'),
      sku: sku,
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: price,
          items: [{
            item_id: sku,
            item_name: `HY-20L - ${frequencyLabel} Plasma Processing System`,
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: price,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart(sku, `HY-20L - ${frequencyLabel} Plasma Processing System`, price);
    }

    navigate('/cart');
  };

  const getProductDetails = () => {
    if (selectedFrequency === 'rf') {
      return { name: "HY-20L - RF (13.56 MHz) Plasma Processing System", sku: "hy-20l-rf", mpn: "HY-20L-RF", price: "14999", url: "https://ninescrolls.com/products/hy-20l" };
    } else {
      return { name: "HY-20L - Mid-Frequency (40 kHz) Plasma Processing System", sku: "hy-20l-mf", mpn: "HY-20L-MF", price: "11999", url: "https://ninescrolls.com/products/hy-20l" };
    }
  };

  const productDetails = getProductDetails();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": `https://ninescrolls.com/products/${productDetails.sku}#product`,
    "name": productDetails.name,
    "description": "Compact, research-grade plasma processing system with 20-liter chamber for batch plasma cleaning, photoresist ashing, and surface activation. Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations, PLC-controlled operation.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-20r/main.jpg"],
    "sku": productDetails.sku,
    "mpn": productDetails.mpn,
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": productDetails.price,
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": productDetails.url,
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
        title="HY-20L - Compact RF Plasma Processing System (20L) | NineScrolls"
        description="Compact, research-grade plasma processing system with 20-liter chamber. Ideal for batch plasma cleaning, photoresist ashing, and surface activation. Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations, up to 300W, PLC-controlled operation."
        keywords="HY-20L, plasma cleaning, photoresist ashing, surface activation, RF plasma, batch processing, research plasma system"
        url="/products/hy-20l"
        image={cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg')}
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/products/product-detail-bg.jpg')} alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'HY-20L', path: '/products/hy-20l' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">HY-20L</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Compact RF Plasma Processing System (20 L)</p>
            <p className="text-base text-white/80 tracking-wide mb-1">
              Designed for research laboratories requiring batch processing and process reproducibility
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
                  <span className="block font-semibold text-white text-sm">20 L Batch Chamber</span>
                  <span className="block text-white/70 text-xs">vs. desktop cleaners: 5-10x capacity</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold text-white text-sm">RF or Mid-Frequency, up to 300 W</span>
                  <span className="block text-white/70 text-xs">research-grade power & stability</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">monitor</span>
                <div>
                  <span className="block font-semibold text-white text-sm">PLC-Controlled Reproducibility</span>
                  <span className="block text-white/70 text-xs">documented processes for scale-up</span>
                </div>
              </div>
            </div>

            {/* Power Frequency Options */}
            <div className="mt-8 p-6 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white mb-4">Power Frequency Options</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedFrequency('mf')}
                  className={`p-4 rounded-lg text-left transition-all ${selectedFrequency === 'mf' ? 'bg-white border-2 border-green-500' : 'bg-white/5 border-2 border-white/20'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-semibold">BEST VALUE</span>
                  </div>
                  <h4 className={`text-base font-medium mb-2 ${selectedFrequency === 'mf' ? 'text-on-surface' : 'text-white'}`}>Mid-Frequency (40 kHz)</h4>
                  <p className={`text-sm leading-snug mb-2 ${selectedFrequency === 'mf' ? 'text-on-surface-variant' : 'text-white/70'}`}>
                    Cost-effective, robust for routine batch cleaning and surface activation
                  </p>
                  <p className={`text-sm font-bold ${selectedFrequency === 'mf' ? 'text-green-600' : 'text-green-400'}`}>$11,999 USD &bull; 300W</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFrequency('rf')}
                  className={`p-4 rounded-lg text-left transition-all ${selectedFrequency === 'rf' ? 'bg-white border-2 border-primary' : 'bg-white/5 border-2 border-white/20'}`}
                >
                  <h4 className={`text-base font-medium mb-2 ${selectedFrequency === 'rf' ? 'text-on-surface' : 'text-white'}`}>RF (13.56 MHz)</h4>
                  <p className={`text-sm leading-snug mb-2 ${selectedFrequency === 'rf' ? 'text-on-surface-variant' : 'text-white/70'}`}>
                    Finer process control, broader recipe window for advanced batch processing
                  </p>
                  <p className={`text-sm font-bold ${selectedFrequency === 'rf' ? 'text-primary' : 'text-blue-400'}`}>$14,999 USD &bull; 150W</p>
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-white/80 text-sm font-medium">price:</span>
                <span className="text-2xl font-bold text-white">
                  {selectedFrequency === 'rf' ? '14,999' : '11,999'} USD
                </span>
              </div>
              <p className="text-white/70 text-sm">availability: in stock</p>
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
                {selectedImage === 'main' ? (
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg')}
                    alt="HY-20L - Compact RF Plasma Processing System"
                    width={800}
                    height={600}
                    className="w-full rounded-xl shadow-lg"
                  />
                ) : (
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/ns-plasma-20r/front-view.jpg')}
                    alt="HY-20L - Front View"
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
                >
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg')}
                    alt="Main View"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'front' ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('front')}
                  type="button"
                >
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/ns-plasma-20r/front-view.jpg')}
                    alt="Front View"
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
                HY-20L is a compact, research-grade RF plasma processing system designed for batch plasma cleaning,
                photoresist ashing, and surface activation in academic laboratories and pilot-scale research environments.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                With a 20-liter stainless steel chamber, RF or Mid-Frequency power options, and PLC-controlled operation, HY-20L
                bridges the gap between entry-level plasma cleaners and full-scale industrial plasma systems—delivering
                repeatable process performance without unnecessary system complexity.
              </p>

              <div className="p-4 bg-blue-50 rounded-lg border-l-[3px] border-primary mb-6">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <Link
                    to="/insights/plasma-cleaner-comparison-research-labs"
                    className="text-primary font-medium hover:underline no-underline"
                  >
                    Learn how research-grade batch plasma cleaners differ from desktop systems &rarr;
                  </Link>
                </p>
              </div>

              <div className="bg-surface-container-low rounded-xl p-6">
                <h3 className="font-headline text-lg font-semibold text-on-surface mb-3">Compared to:</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="font-medium text-on-surface min-w-[180px]">Desktop plasma cleaners</span>
                    <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
                    <span>Larger batch, higher power</span>
                  </div>
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="font-medium text-on-surface min-w-[180px]">Industrial plasma tools</span>
                    <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
                    <span>Simpler operation, lower cost</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Who Uses This</h2>
          <p className="text-center mb-8 text-on-surface-variant">
            HY-20L is commonly installed in:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">school</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">University Cleanrooms</h3>
              <p className="text-sm text-on-surface-variant">Materials science and research facilities</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">science</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Materials Science Labs</h3>
              <p className="text-sm text-on-surface-variant">Batch processing and surface treatment</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">search</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Failure Analysis Labs</h3>
              <p className="text-sm text-on-surface-variant">Batch sample preparation workflows</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">biotech</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Pilot-Scale R&D Lines</h3>
              <p className="text-sm text-on-surface-variant">Process development and scale-up</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Key Features</h2>

          {/* Primary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-6 text-center">Core Capabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">20 L Batch Processing Chamber</h3>
              <p className="text-sm text-primary font-medium mb-2">5-10x larger capacity than desktop plasma cleaners</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Internal chamber: 250 x 250 x 320 mm with multi-level removable sample trays. Process multiple samples, components, or substrates simultaneously—essential for research labs requiring batch throughput.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">RF or Mid-Frequency, up to 300W (MF) / 150W (RF)</h3>
              <p className="text-sm text-primary font-medium mb-2">Research-grade power with industrial stability</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Available in RF (13.56 MHz, 150W) or Mid-Frequency (40 kHz, 300W) configurations, continuously adjustable. Stable plasma generation suitable for cleaning, ashing, and surface modification with reproducible results.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">monitor</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">PLC-Based Reproducibility</h3>
              <p className="text-sm text-primary font-medium mb-2">Documented processes ready for scale-up</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">PLC control system with touch screen interface. Automatic and manual operation modes with reproducible process parameters—critical for research documentation and transitioning to production.</p>
            </div>
          </div>

          {/* Secondary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-6 text-center">Additional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Process-Focused Vacuum Design</h3>
              <p className="text-on-surface-variant leading-relaxed">Mechanical vacuum pumping system matched to chamber volume. Optimized for plasma processing pressures with fast pump-down and stable operating conditions.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Flexible Gas Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">Dual gas inlets (standard) compatible with common process gases such as O&#8322;, N&#8322;, and Ar. Mixed-gas plasma processes supported.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-center text-on-surface-variant mb-8 max-w-3xl mx-auto">
            <strong>Commonly installed in:</strong> Materials science cleanrooms, failure analysis facilities, and pilot-scale processing environments requiring batch plasma treatment capabilities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Plasma Cleaning</h3>
              <p className="text-sm text-primary font-medium mb-2">Used for batch PR removal before lithography steps</p>
              <p className="text-on-surface-variant text-sm">Effective removal of organic contaminants from substrates, including photoresist (PR), PMMA, PDMS, and more. Typical batch: 10-20 substrates per run.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">local_fire_department</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Photoresist Ashing</h3>
              <p className="text-sm text-primary font-medium mb-2">Complete PR removal with uniform processing across batch samples</p>
              <p className="text-on-surface-variant text-sm">Precise control and uniform processing across batch samples. Essential for materials research labs processing multiple wafers simultaneously.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Activation</h3>
              <p className="text-sm text-primary font-medium mb-2">Preparation prior to bonding, coating, or deposition</p>
              <p className="text-on-surface-variant text-sm">Enhance adhesion and improve material performance. Commonly used in MEMS fabrication and advanced packaging workflows.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Energy Modification</h3>
              <p className="text-sm text-primary font-medium mb-2">Modify wettability for polymers, metals, and ceramics</p>
              <p className="text-on-surface-variant text-sm">Achieve desired wettability and adhesion characteristics. Typical users: polymer research labs and biomaterials facilities.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">assessment</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Batch Sample Preparation</h3>
              <p className="text-sm text-primary font-medium mb-2">Efficient processing of multiple substrates for materials research</p>
              <p className="text-on-surface-variant text-sm">Ideal for batch preparation workflows, enabling efficient processing of multiple substrates simultaneously—critical for research productivity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Positioning */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">System Positioning</h2>
            <p className="text-lg text-on-surface-variant leading-relaxed mb-4">
              HY-20L bridges the gap between desktop plasma cleaners and full industrial plasma platforms,
              offering controlled batch processing without excessive system complexity.
            </p>
            <p className="text-sm text-on-surface-variant italic">
              This is NineScrolls' strategic positioning statement for research-grade plasma processing.
            </p>
          </div>
        </div>
      </section>

      {/* Choose HY-20L if you */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Choose HY-20L if you:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Process multiple samples per run</h3>
              <p className="text-on-surface-variant text-sm">20-liter chamber enables efficient batch processing of 10-20 substrates simultaneously, essential for research productivity.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">sync</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Require repeatable plasma conditions</h3>
              <p className="text-on-surface-variant text-sm">Full PLC control with documented process parameters ensures consistent results across runs, critical for scale-up studies.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">trending_up</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Plan to scale from validation to routine use</h3>
              <p className="text-on-surface-variant text-sm">Automated operation and process reproducibility make HY-20L ideal for transitioning from exploratory research to routine processing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why HY-20L */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why HY-20L</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">assessment</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Larger Batch Capacity</h3>
              <p className="text-on-surface-variant leading-relaxed">20-liter chamber provides 5-10x larger batch capacity than desktop plasma cleaners, enabling efficient processing of multiple samples—essential for research workflows.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Higher Power & Control</h3>
              <p className="text-on-surface-variant leading-relaxed">Up to 300W RF power with better process control than entry-level systems, delivering research-grade performance suitable for scale-up studies.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Simpler Operation</h3>
              <p className="text-on-surface-variant leading-relaxed">Simpler installation and operation than industrial plasma tools, optimized for academic research labs and pilot-scale processing environments.</p>
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
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Plasma Type</td>
                  <td className="px-6 py-3 text-on-surface-variant">RF Plasma / Mid-Frequency Plasma</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Plasma Frequency</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz (RF) / 40 kHz (Mid-Frequency)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Output</td>
                  <td className="px-6 py-3 text-on-surface-variant">300W (Mid-Frequency) / 150W (RF), adjustable</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">20 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Material</td>
                  <td className="px-6 py-3 text-on-surface-variant">Stainless steel</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">250 x 250 x 320 mm (internal)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Sample Tray Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">242 x 250 x 45 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Channels</td>
                  <td className="px-6 py-3 text-on-surface-variant">2</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Pumping Speed</td>
                  <td className="px-6 py-3 text-on-surface-variant">~4.4 L/s (mechanical pump)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Control System</td>
                  <td className="px-6 py-3 text-on-surface-variant">PLC + Touch Screen</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Operation Modes</td>
                  <td className="px-6 py-3 text-on-surface-variant">Automatic / Manual</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Supply</td>
                  <td className="px-6 py-3 text-on-surface-variant">110 V</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">System Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">630 x 580 x 550 mm</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 p-4 bg-surface-container-low rounded-lg max-w-4xl mx-auto">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Frequency Selection Guide:</strong> Mid-Frequency (40 kHz) is ideal for cost-sensitive research labs and routine batch cleaning applications.
              RF (13.56 MHz) supports more advanced surface activation recipes and offers finer process control for demanding batch processing requirements.
            </p>
          </div>
        </div>
      </section>

      {/* Support & Integration */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Support & Integration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Application-Oriented Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">NineScrolls provides application-oriented system configuration tailored to your specific research needs and process requirements.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Consultation</h3>
              <p className="text-on-surface-variant leading-relaxed">Expert process consultation for research environments, helping you optimize parameters and achieve desired results.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Documentation & Support</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive documentation and long-term technical support to ensure your system operates at peak performance.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Custom Configurations</h3>
              <p className="text-on-surface-variant leading-relaxed">Custom configurations and scale-up options are available upon request to meet your specific research or production needs.</p>
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

      {/* Cost Advantage Block */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why Our Systems Are Cost-Efficient</h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-center mb-8 text-lg text-on-surface-variant leading-relaxed">
              We specialize in cost-efficient configurations for research labs that need to balance performance and budget. We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block text-on-surface mb-1">Modular design</strong>
                  <span className="text-sm text-on-surface-variant">Pay only for what you need</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block text-on-surface mb-1">Research-focused configuration</strong>
                  <span className="text-sm text-on-surface-variant">Not overbuilt for production</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block text-on-surface mb-1">Direct engineering collaboration</strong>
                  <span className="text-sm text-on-surface-variant">No unnecessary intermediaries</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block text-on-surface mb-1">Lean operational structure</strong>
                  <span className="text-sm text-on-surface-variant">Efficient cost structure</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">Typical use cases include:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">&bull;</span> New lab setup with limited initial funding</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">&bull;</span> Grant-based or proposal-stage projects</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">&bull;</span> Pilot or exploratory research</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">&bull;</span> Teaching and shared facilities</li>
              </ul>
            </div>
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

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/NineScrolls-Equipment-Guide.pdf'}
        fileName={'NineScrolls-Equipment-Guide.pdf'}
        title={'Download Equipment Guide'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName={`HY-20L - ${selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)'}`}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          closeContactForm();
          const link = document.createElement('a');
          link.href = '/NineScrolls-Equipment-Guide.pdf';
          link.download = 'NineScrolls-Equipment-Guide.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />
    </>
  );
}
