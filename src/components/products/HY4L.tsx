import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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

export function HY4L() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'image1' | 'image2'>('main');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addItem } = useCart();

  // Determine frequency from URL parameter or path
  // Support both: /products/hy-4l?config=rf and /products/hy-4l-rf
  const getFrequencyFromURL = (): 'rf' | 'mf' => {
    // Check path for dedicated routes first (most reliable)
    if (location.pathname.includes('-rf')) {
      return 'rf';
    }
    if (location.pathname.includes('-mf')) {
      return 'mf';
    }
    // Check URL parameter (use location.search to avoid dependency on searchParams)
    const urlParams = new URLSearchParams(location.search);
    const configParam = urlParams.get('config');
    if (configParam === 'rf' || configParam === 'mf') {
      return configParam;
    }
    // Default to RF
    return 'rf';
  };

  const [selectedFrequency, setSelectedFrequency] = useState<'rf' | 'mf'>(() => {
    // Initialize from URL on first render
    if (location.pathname.includes('-rf')) return 'rf';
    if (location.pathname.includes('-mf')) return 'mf';
    const configParam = new URLSearchParams(location.search).get('config');
    if (configParam === 'rf' || configParam === 'mf') return configParam;
    return 'rf';
  });

  // Update frequency when URL changes
  useEffect(() => {
    const frequency = getFrequencyFromURL();
    setSelectedFrequency(frequency);
  }, [location.pathname, location.search]);

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
    const price = selectedFrequency === 'rf' ? 7999 : 6499;
    const sku = selectedFrequency === 'rf' ? 'hy-4l-rf' : 'hy-4l-mf';

    // Add item to cart
    addItem({
      id: sku,
      name: `HY-4L - ${frequencyLabel} Plasma Cleaner`,
      price: price,
      quantity: 1,
      image: '/assets/images/products/ns-plasma-4r/main.jpg',
      sku: sku,
    });

    // Track add to cart event for Google Analytics and Google Merchants
    if (typeof window !== 'undefined') {
      // Google Analytics 4 e-commerce event
      if (window.gtag) {
        const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
        const price = selectedFrequency === 'rf' ? 7999 : 6499;
        const sku = selectedFrequency === 'rf' ? 'hy-4l-rf' : 'hy-4l-mf';

        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: price,
          items: [{
            item_id: sku,
            item_name: `HY-4L - ${frequencyLabel} Plasma Cleaner`,
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: price,
            quantity: 1
          }]
        });
      }

      // Analytics service tracking
      const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
      const price = selectedFrequency === 'rf' ? 7999 : 6499;
      const sku = selectedFrequency === 'rf' ? 'hy-4l-rf' : 'hy-4l-mf';
      analytics.trackAddToCart(sku, `HY-4L - ${frequencyLabel} Plasma Cleaner`, price);
    }

    // Navigate to cart page
    navigate('/cart');
  };

  // Get product details based on selected frequency
  const getProductDetails = () => {
    if (selectedFrequency === 'rf') {
      return {
        name: "HY-4L - RF (13.56 MHz) Plasma Cleaner",
        description: "Compact RF plasma system for research and sample preparation. 4L chamber volume, 13.56 MHz RF frequency, 150W power, ideal for teaching labs and low-volume processing.",
        sku: "hy-4l-rf",
        mpn: "HY-4L-RF",
        price: "7999",
        url: "https://ninescrolls.com/products/hy-4l-rf",
        seoTitle: "HY-4L - RF (13.56 MHz) Plasma Cleaner | $7,999 USD | NineScrolls",
        seoDescription: "HY-4L RF Plasma Cleaner. 13.56 MHz RF frequency, 150W power, 4L chamber. In stock. Free shipping. Ships in 3-4 weeks.",
        seoKeywords: "HY-4L RF, 13.56 MHz plasma cleaner, RF plasma system, research plasma equipment, $7999"
      };
    } else {
      return {
        name: "HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner",
        description: "Compact mid-frequency plasma system for research and sample preparation. 4L chamber volume, 40 kHz frequency, ideal for teaching labs and low-volume processing.",
        sku: "hy-4l-mf",
        mpn: "HY-4L-MF",
        price: "6499",
        url: "https://ninescrolls.com/products/hy-4l-mf",
        seoTitle: "HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner | $6,499 USD | NineScrolls",
        seoDescription: "HY-4L Mid-Frequency Plasma Cleaner. 40 kHz frequency, 4L chamber. In stock. Free shipping. Ships in 3-4 weeks.",
        seoKeywords: "HY-4L MF, 40 kHz plasma cleaner, mid-frequency plasma system, research plasma equipment, $6499"
      };
    }
  };

  const productDetails = getProductDetails();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": `https://ninescrolls.com/products/${productDetails.sku}#product`,
    "name": productDetails.name,
    "description": productDetails.description,
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-4r/main.jpg"],
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
        title={productDetails.seoTitle}
        description={productDetails.seoDescription}
        keywords={productDetails.seoKeywords}
        url={location.pathname}
        image="/assets/images/products/ns-plasma-4r/main.jpg"
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
          <img className="w-full h-full object-cover" src="/assets/images/products/product-detail-bg.jpg" alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'HY-4L', path: '/products/hy-4l' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">HY-4L</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Plasma Cleaner (RF or Mid-Frequency)</p>
            <p className="text-base text-white/80 tracking-wide mb-1">
              Compact plasma system for research and sample preparation applications
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
                  <span className="block font-semibold text-white text-sm">~4 L Processing Chamber</span>
                  <span className="block text-white/70 text-xs">optimized for single samples or small batches</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold text-white text-sm">RF or Mid-Frequency Plasma</span>
                  <span className="block text-white/70 text-xs">choose RF for process flexibility or MF for best value</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white/90 text-[24px] mt-0.5 shrink-0">science</span>
                <div>
                  <span className="block font-semibold text-white text-sm">Simplified Operation</span>
                  <span className="block text-white/70 text-xs">intuitive interface, easy setup for new users</span>
                </div>
              </div>
            </div>

            {/* Power Frequency Options */}
            <div className="mt-8 p-6 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white mb-4">Power Frequency Options</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFrequency('mf');
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.set('config', 'mf');
                    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
                  }}
                  className={`p-4 rounded-lg text-left transition-all ${selectedFrequency === 'mf' ? 'bg-white border-2 border-green-500' : 'bg-white/5 border-2 border-white/20'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-semibold">BEST VALUE</span>
                  </div>
                  <h4 className={`text-base font-medium mb-2 ${selectedFrequency === 'mf' ? 'text-on-surface' : 'text-white'}`}>Mid-Frequency (40 kHz)</h4>
                  <p className={`text-sm leading-snug mb-2 ${selectedFrequency === 'mf' ? 'text-on-surface-variant' : 'text-white/70'}`}>
                    Cost-effective, robust for routine lab cleaning and surface activation
                  </p>
                  <p className={`text-sm font-bold ${selectedFrequency === 'mf' ? 'text-green-600' : 'text-green-400'}`}>$6,499 USD &bull; 300W</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFrequency('rf');
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.set('config', 'rf');
                    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
                  }}
                  className={`p-4 rounded-lg text-left transition-all ${selectedFrequency === 'rf' ? 'bg-white border-2 border-primary' : 'bg-white/5 border-2 border-white/20'}`}
                >
                  <h4 className={`text-base font-medium mb-2 ${selectedFrequency === 'rf' ? 'text-on-surface' : 'text-white'}`}>RF (13.56 MHz)</h4>
                  <p className={`text-sm leading-snug mb-2 ${selectedFrequency === 'rf' ? 'text-on-surface-variant' : 'text-white/70'}`}>
                    Finer process control, broader recipe window for advanced surface activation
                  </p>
                  <p className={`text-sm font-bold ${selectedFrequency === 'rf' ? 'text-primary' : 'text-blue-400'}`}>$7,999 USD &bull; 150W</p>
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-white/80 text-sm font-medium">Price:</span>
                <span className="text-2xl font-bold text-white">
                  {selectedFrequency === 'rf' ? '$7,999' : '$6,499'} USD
                </span>
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
                    src="/assets/images/products/ns-plasma-4r/main.jpg"
                    alt="HY-4L - Compact RF Plasma System"
                    width={800}
                    height={600}
                    className="w-full rounded-xl shadow-lg"
                  />
                )}
                {selectedImage === 'image1' && (
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-4r/image-1.jpg"
                    alt="HY-4L - View 1"
                    width={800}
                    height={600}
                    className="w-full rounded-xl shadow-lg"
                  />
                )}
                {selectedImage === 'image2' && (
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-4r/image-2.jpg"
                    alt="HY-4L - View 2"
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
                    src="/assets/images/products/ns-plasma-4r/main.jpg"
                    alt="Main View"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'image1' ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('image1')}
                  type="button"
                  aria-label="View 1"
                >
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-4r/image-1.jpg"
                    alt="View 1"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'image2' ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('image2')}
                  type="button"
                  aria-label="View 2"
                >
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-4r/image-2.jpg"
                    alt="View 2"
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
                HY-4L is a compact plasma system designed for small-batch plasma cleaning, surface activation,
                and exploratory research applications where process flexibility and minimal footprint are preferred over high throughput.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                Positioned below full batch plasma platforms, HY-4L provides a practical entry point for laboratories
                that require RF or Mid-Frequency plasma capability without the complexity or space requirements of larger systems.
              </p>

              <div className="bg-surface-container-low rounded-xl p-6 mb-6">
                <h3 className="font-headline text-lg font-semibold text-on-surface mb-3">Compared to:</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="font-medium text-on-surface min-w-[180px]">Desktop plasma cleaners</span>
                    <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
                    <span>RF or Mid-Frequency plasma technology</span>
                  </div>
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="font-medium text-on-surface min-w-[180px]">Batch plasma platforms</span>
                    <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
                    <span>Lower entry cost, simpler operation</span>
                  </div>
                </div>
              </div>

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

      {/* Who Uses This */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Who Uses This</h2>
          <p className="text-center mb-8 text-on-surface-variant">
            HY-4L is commonly installed in:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">school</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">University Cleanrooms</h3>
              <p className="text-sm text-on-surface-variant">Teaching labs and research facilities</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">science</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Materials Science Labs</h3>
              <p className="text-sm text-on-surface-variant">Surface treatment and activation</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">search</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Failure Analysis Labs</h3>
              <p className="text-sm text-on-surface-variant">Sample preparation workflows</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-3 block">biotech</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Pilot-Scale R&D Lines</h3>
              <p className="text-sm text-on-surface-variant">Early-stage process development</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Characteristics */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Key Characteristics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">RF or Mid-Frequency Plasma Capability</h3>
              <p className="text-on-surface-variant leading-relaxed">Available in RF (13.56 MHz, 150W) or Mid-Frequency (40 kHz, 300W) configurations. Adjustable power suitable for gentle plasma processes and stable generation for research and educational use.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Small-Volume Processing Chamber</h3>
              <p className="text-on-surface-variant leading-relaxed">Approx. 4 L chamber volume, optimized for single samples or small batches. Suitable for wafers, coupons, and discrete components.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Simple Operation for Teaching & Research</h3>
              <p className="text-on-surface-variant leading-relaxed">Intuitive control interface with manual or semi-automated operation modes. Easy setup and low learning curve for new users.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Flexible Gas Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">Standard single or dual gas configuration, compatible with common process gases for versatile lab integration.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade Path */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-surface-container-low rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Need higher throughput or better process repeatability?</h3>
              <p className="text-on-surface-variant">
                For larger batch processing, automated process control, and improved reproducibility,
                consider upgrading to HY-20L.
              </p>
            </div>
            <Link to="/products/hy-20l" className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3 rounded-lg font-medium hover:bg-primary hover:text-on-primary transition-colors no-underline whitespace-nowrap">
              View HY-20L &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-center text-on-surface-variant mb-8 max-w-3xl mx-auto">
            <strong>Commonly used in:</strong> Research laboratories with limited space, teaching and instructional labs, and facilities requiring low-volume plasma processing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Plasma Cleaning</h3>
              <p className="text-sm text-primary font-medium mb-2">Removal of organic residues from substrates</p>
              <p className="text-on-surface-variant text-sm">Effective cleaning of organic residues from wafers, coupons, and discrete components. Ideal for sample preparation workflows.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Activation</h3>
              <p className="text-sm text-primary font-medium mb-2">Preparation prior to bonding or coating</p>
              <p className="text-on-surface-variant text-sm">Surface activation to enhance adhesion for bonding and coating applications. Commonly used in materials research and device fabrication.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Surface Energy Modification</h3>
              <p className="text-sm text-primary font-medium mb-2">Modification for polymers and metals</p>
              <p className="text-on-surface-variant text-sm">Modification of surface energy properties for polymers and metals. Suitable for exploratory research and process development.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Educational Demonstrations</h3>
              <p className="text-sm text-primary font-medium mb-2">Teaching plasma processes in instructional labs</p>
              <p className="text-on-surface-variant text-sm">Ideal for educational demonstrations of plasma processes. Low learning curve makes it suitable for teaching environments.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">search</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">Process Development</h3>
              <p className="text-sm text-primary font-medium mb-2">Early-stage feasibility studies</p>
              <p className="text-on-surface-variant text-sm">Early-stage process development and feasibility studies. Provides a practical platform for validating plasma processes before scaling up.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Positioning */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">System Positioning</h2>
          <div className="max-w-3xl mx-auto bg-white rounded-xl p-8 shadow-sm">
            <p className="text-on-surface-variant leading-relaxed mb-4">
              <strong className="text-on-surface">Designed for:</strong> Research laboratories with limited space, teaching and instructional labs, low-volume or exploratory plasma processing, and users transitioning from desktop plasma cleaners.
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Not intended for:</strong> High-throughput batch processing, industrial-scale plasma treatment, or anisotropic dry etching and RIE processes.
            </p>
          </div>
        </div>
      </section>

      {/* Why HY-4L */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why HY-4L</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">payments</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Lower Entry Cost</h3>
              <p className="text-on-surface-variant leading-relaxed">Lower entry cost compared to batch plasma platforms, making it accessible for teaching labs and research validation.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Standard RF Technology</h3>
              <p className="text-on-surface-variant leading-relaxed">Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations. RF option provides standard frequency for academic compatibility, matching larger research systems.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Simple Operation</h3>
              <p className="text-on-surface-variant leading-relaxed">Simple operation with minimal infrastructure requirements. Ideal companion system to larger plasma processing tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Specifications */}
      <section className="py-16 bg-surface-container-low">
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
                  <td className="px-6 py-3 text-on-surface-variant">150W (RF) / 300W (Mid-Frequency)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">~4 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">148mm diameter x 266mm depth</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Sample Tray Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">220 x 110 x 90 mm (L x W x H)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Configuration</td>
                  <td className="px-6 py-3 text-on-surface-variant">2 gas channels (O&#8322;, N&#8322;, Ar supported)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical vacuum pump, 2.2 L/s</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Operation Mode</td>
                  <td className="px-6 py-3 text-on-surface-variant">PLC + Touchscreen, Auto / Manual switchable</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Supply</td>
                  <td className="px-6 py-3 text-on-surface-variant">110 V</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Installation</td>
                  <td className="px-6 py-3 text-on-surface-variant">Bench-top</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">System Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">630 x 500 x 480 mm (L x W x H)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm max-w-4xl mx-auto">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Frequency Selection Guide:</strong> Mid-Frequency (40 kHz) is ideal for cost-sensitive research labs and routine cleaning applications.
              RF (13.56 MHz) supports more advanced surface activation recipes and offers finer process control.
            </p>
          </div>
        </div>
      </section>

      {/* Support & Integration */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Support & Integration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Application-Oriented Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">Application-oriented configuration guidance tailored to your specific research needs and teaching requirements.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Documentation & Support</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive documentation and basic process support to help you get started quickly and effectively.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Upgrade Consultation</h3>
              <p className="text-on-surface-variant leading-relaxed">Upgrade consultation toward larger plasma systems when your research needs grow beyond the 4R's capabilities.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Additional Options</h3>
              <p className="text-on-surface-variant leading-relaxed">Additional options and accessories are available to enhance system capabilities for specific research or teaching requirements.</p>
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
              We understand that many research projects operate under tight budgets. Our systems are designed to deliver essential performance without unnecessary industrial features, making them a practical and cost-efficient choice for university and research laboratories.
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
        productName={`HY-4L - ${selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)'}`}
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
