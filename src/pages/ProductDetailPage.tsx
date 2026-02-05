import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { QuoteModal } from '../components/common/QuoteModal';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import { useCart } from '../contexts/useCart';
import { analytics } from '../services/analytics';
import { getProductBySlug, listManufacturers } from '../services/catalogService';
import type { ProductRecord, ProductVariant, ManufacturerRecord, DownloadItem } from '../types';
import '../styles/ProductDetailPage.css';

const ResultIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const HighlightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UseCaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ApplicationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const getImageSizes = (imagePath: string) => {
  const parts = imagePath.split('.');
  const ext = parts.pop();
  const base = parts.join('.');
  return {
    sm: `${base}-sm.${ext}`,
    md: `${base}-md.${ext}`,
    lg: `${base}-lg.${ext}`,
    xl: `${base}-xl.${ext}`,
    webp: {
      sm: `${base}-sm.webp`,
      md: `${base}-md.webp`,
      lg: `${base}-lg.webp`,
      xl: `${base}-xl.webp`
    }
  };
};

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [manufacturer, setManufacturer] = useState<ManufacturerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [selectedDownload, setSelectedDownload] = useState<DownloadItem | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useScrollToTop([slug]);

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setProduct(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const found = await getProductBySlug(slug);
      setProduct(found);
      if (found?.manufacturerId) {
        const manufacturers = await listManufacturers();
        const match = manufacturers.find((item) => item.id === found.manufacturerId) || null;
        setManufacturer(match);
      } else {
        setManufacturer(null);
      }
      setSelectedVariantId(found?.variants?.find((variant) => variant.isDefault)?.id || found?.variants?.[0]?.id || null);
      setLoading(false);
    };
    load();
  }, [slug]);

  useEffect(() => {
    if (product) {
      analytics.trackProductView(product.id, product.name);
    }
  }, [product]);

  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!product?.variants || !selectedVariantId) return null;
    return product.variants.find((variant) => variant.id === selectedVariantId) || null;
  }, [product, selectedVariantId]);

  const heroSubtitle = product?.heroSubtitle || product?.shortDesc;
  const heroBullets = product?.bullets || [];
  const heroImage = product?.images?.[0] || product?.thumbnail;
  const keyHighlights = (product?.features || []).slice(0, 4);
  const quickSpecs = [
    ...(product?.specifications || []).slice(0, 2),
    ...(product?.features || []).slice(0, 2),
  ].slice(0, 4);

  if (loading) {
    return (
      <section className="product-overview">
        <div className="container">
          <p>Loading product...</p>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="product-overview">
        <div className="container">
          <p>Product not found.</p>
        </div>
      </section>
    );
  }

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": `https://ninescrolls.com/products/${product.slug}#product`,
    "name": product.name,
    "description": product.shortDesc || product.name,
    "image": (product.images || []).map((img) => `https://ninescrolls.com${img}`),
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "NineScrolls"
    },
    "category": product.category,
    "offers": selectedVariant ? {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": `${selectedVariant.price}`,
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "NineScrolls",
        "url": "https://ninescrolls.com"
      },
      "url": `https://ninescrolls.com/products/${product.slug}`,
      "itemCondition": "https://schema.org/NewCondition"
    } : undefined,
    "additionalProperty": [
      ...(product.features || []).map((feature) => ({
        "@type": "PropertyValue",
        "name": "Feature",
        "value": feature
      })),
      ...(product.specifications || []).map((spec) => ({
        "@type": "PropertyValue",
        "name": "Specification",
        "value": spec
      }))
    ]
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://ninescrolls.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Products",
        "item": "https://ninescrolls.com/products"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": product.name,
        "item": `https://ninescrolls.com/products/${product.slug}`
      }
    ]
  };

  const downloads = product.downloads || [];
  const primaryDownload = downloads[0] || null;
  const activeDownload = selectedDownload || primaryDownload;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const displayName = selectedVariant.name || `${product.name}${selectedVariant.label ? ` - ${selectedVariant.label}` : ''}`;

    addItem({
      id: selectedVariant.id,
      name: displayName,
      price: selectedVariant.price,
      quantity: 1,
      image: product.thumbnail || product.images?.[0],
      sku: selectedVariant.id,
    });

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'USD',
        value: selectedVariant.price,
        items: [{
          item_id: selectedVariant.id,
          item_name: displayName,
          item_category: product.category,
          price: selectedVariant.price,
          quantity: 1
        }]
      });
    }

    analytics.trackAddToCart(selectedVariant.id, displayName, selectedVariant.price);
  };

  return (
    <>
      <SEO
        title={`${product.name} | NineScrolls`}
        description={product.shortDesc || product.name}
        keywords={[product.name, product.category, product.typeTag].filter(Boolean).join(', ')}
        url={`/products/${product.slug}`}
        image={heroImage}
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbData)}
        </script>
      </Helmet>

      <section className="product-detail-hero product-hero-enhanced hero-texture">
        <div className="container">
          <div className="product-header-enhanced">
            <h1>{product.name}</h1>
            {heroSubtitle && <p className="product-subtitle">{heroSubtitle}</p>}
            <div className="hero-positioning">
              <p className="hero-tagline">
                US-based scientific equipment provider - Custom-configured systems for research labs and cleanrooms
              </p>
            </div>
            {heroBullets.length > 0 && (
              <div className="hero-bullets">
                {heroBullets.map((bullet) => (
                  <div className="hero-bullet-item" key={bullet}>
                    <span className="hero-bullet-icon">
                      <HighlightIcon />
                    </span>
                    <div className="hero-bullet-text">{bullet}</div>
                  </div>
                ))}
              </div>
            )}
            {keyHighlights.length > 0 && (
              <div className="hero-info-cards">
                {keyHighlights.map((item) => (
                  <div className="hero-info-card" key={item}>
                    <div className="hero-info-icon">
                      <ResultIcon />
                    </div>
                    <div className="hero-info-text">{item}</div>
                  </div>
                ))}
              </div>
            )}
            {quickSpecs.length > 0 && (
              <div className="hero-chips">
                {quickSpecs.map((item) => (
                  <span className="hero-chip" key={item}>{item}</span>
                ))}
              </div>
            )}
            {keyHighlights.length > 0 && (
              <div className="key-highlights">
                {keyHighlights.map((item) => (
                  <div className="highlight-item" key={item}>
                    <span className="highlight-icon">+</span>
                    <span className="highlight-text">{item}</span>
                  </div>
                ))}
              </div>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="hero-config hero-panel">
                <h3>Configuration Options</h3>
                <div className="hero-config-grid">
                  {product.variants.map((variant) => {
                    const isActive = variant.id === selectedVariantId;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        className={`hero-config-card ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedVariantId(variant.id)}
                      >
                        <div className="config-card-header">
                          <span className="config-title">{variant.label || variant.name}</span>
                          {variant.price ? (
                            <span className="config-price">{variant.price.toLocaleString()} USD</span>
                          ) : (
                            <span className="config-price">Contact</span>
                          )}
                        </div>
                        {variant.description && (
                          <p className="config-note">{variant.description}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="hero-pricing">
                  <div className="pricing-main">
                    <span className="pricing-label">price:</span>
                    <span className="pricing-amount">
                      {selectedVariant ? `${selectedVariant.price.toLocaleString()} USD` : 'Contact for pricing'}
                    </span>
                  </div>
                  <p className="pricing-note">availability: in stock</p>
                </div>
                <div className="hero-badges">
                  <span className="hero-badge">In Stock</span>
                  <span className="hero-badge">Ships in 3-4 weeks</span>
                  <span className="hero-badge">US-based configuration</span>
                </div>
                {product.variants.length > 1 && (
                  <div className="hero-mini-table">
                    <div className="mini-header">
                      <span>Configuration</span>
                      <span>Price (USD)</span>
                    </div>
                    {product.variants.map((variant) => (
                      <div className="mini-row" key={variant.id}>
                        <span>{variant.label || variant.name}</span>
                        <span>{variant.price ? variant.price.toLocaleString() : 'Contact'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={() => setQuoteOpen(true)}>
                Request Configuration
              </button>
              <a className="btn btn-secondary btn-large" href="/contact?topic=expert">
                Talk to an Expert
              </a>
              {selectedVariant && (
                <button className="btn btn-secondary btn-large" onClick={handleAddToCart}>
                  Add to Cart
                </button>
              )}
              {primaryDownload && (
                <button
                  className="btn btn-secondary btn-large"
                  onClick={() => {
                    setSelectedDownload(primaryDownload);
                    setDownloadOpen(true);
                  }}
                >
                  Download Brochure
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="product-overview product-overview-hero">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-content">
              <h2>Why This System</h2>
              <p className="lead-text">{product.shortDesc || product.name}</p>
              <p>
                We focus on research-grade performance with configurations optimized for lab workflows,
                predictable outcomes, and future upgrades. Our team helps you scope the right chamber,
                power, and control options without overbuilding for industrial-only features.
              </p>
              <div className="positioning-block">
                <h3>System Positioning</h3>
                <p>
                  {product.positioningNote ||
                    'This platform bridges early-stage research and pilot-scale processing. It is designed to deliver repeatable results while keeping footprint, complexity, and cost aligned with academic and institutional labs.'}
                </p>
                {heroBullets.length > 0 && (
                  <ul>
                    {heroBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              {product.whoUsesStats && product.whoUsesStats.length > 0 && (
                <div className="who-uses">
                  <h3>Who Uses This</h3>
                  <div className="who-uses-grid">
                    {product.whoUsesStats.map((stat) => (
                      <div className="who-uses-card" key={`${stat.label}-${stat.value}`}>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                        {stat.detail && <div className="stat-detail">{stat.detail}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {product.applications && product.applications.length > 0 && (
                <>
                  <h3>Where It Fits Best</h3>
                  <ul>
                    {product.applications.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="product-hero-image product-image-single">
              {heroImage && (
                <div className="product-image-main-wrapper">
                  <OptimizedImage
                    src={heroImage}
                    alt={`${product.name} - Main view`}
                    sizes={getImageSizes(heroImage)}
                    width={800}
                    height={600}
                    loading="eager"
                    className="main-product-image"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="product-overview product-overview-narrative">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-image product-image-single">
              {heroImage && (
                <div className="product-image-main-wrapper">
                  <OptimizedImage
                    src={heroImage}
                    alt={`${product.name} - Main view`}
                    sizes={getImageSizes(heroImage)}
                    width={800}
                    height={600}
                    loading="eager"
                    className="main-product-image"
                  />
                </div>
              )}
              {product.images && product.images.length > 1 && (
                <div className="image-gallery">
                  {product.images.slice(1).map((image) => (
                    <img key={image} src={image} alt={product.name} loading="lazy" decoding="async" />
                  ))}
                </div>
              )}
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="lead-text">{product.shortDesc || product.name}</p>
              <p>
                Each system is configured based on your substrates, throughput, and process goals.
                We align chamber design, gas delivery, and control software to ensure reproducibility
                and fast ramp-up for your lab team.
              </p>
              {product.variants && product.variants.length > 0 && (
                <div className="comparison-block">
                  <h3>Configuration Comparison</h3>
                  <div className="comparison-items">
                    {product.variants.map((variant) => (
                      <div className="comparison-item" key={variant.id}>
                        <div className="comparison-label">{variant.label || variant.name}</div>
                        <div className="comparison-arrow">{'->'}</div>
                        <div className="comparison-value">
                          {variant.price ? `${variant.price.toLocaleString()} USD` : 'Contact for pricing'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-info">
              {product.features && product.features.length > 0 && (
                <div className="info-section">
                  <h2>Key Features</h2>
                  <ul>
                    {product.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {product.specifications && product.specifications.length > 0 && (
                <div className="info-section">
                  <h2>Specifications</h2>
                  <div className="specs-table">
                    {product.specifications.map((spec) => {
                      const parts = spec.split(':');
                      const label = parts[0] || spec;
                      const value = parts.slice(1).join(':').trim() || '-';
                      return (
                        <div className="spec-row" key={spec}>
                          <span className="spec-label">{label.trim()}</span>
                          <span className="spec-value">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="product-info">
              {product.processResults && product.processResults.length > 0 && (
                <div className="info-section">
                  <h2>Process Results</h2>
                  <div className="results-grid">
                    {product.processResults.map((item) => (
                      <div className="result-card" key={item}>
                        <div className="result-icon">
                          <ResultIcon />
                        </div>
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.resultsHighlights && product.resultsHighlights.length > 0 && (
                <div className="info-section">
                  <h2>Results Highlights</h2>
                  <div className="highlights-grid">
                    {product.resultsHighlights.map((item) => (
                      <div className="highlight-card" key={item}>
                        <span className="highlight-icon">
                          <HighlightIcon />
                        </span>
                        <span className="highlight-text">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.options && product.options.length > 0 && (
                <div className="info-section">
                  <h2>Configuration Options</h2>
                  <ul>
                    {product.options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </div>
              )}

              {product.deliveryAndService && (
                <div className="info-section">
                  <h2>Delivery & Service</h2>
                  <p>{product.deliveryAndService}</p>
                </div>
              )}

              {product.partnerNote && (
                <div className="info-section">
                  <h2>Partner Note</h2>
                  <p>{product.partnerNote}</p>
                </div>
              )}

              {downloads.length > 0 && (
                <div className="info-section">
                  <h2>Downloads</h2>
                  <ul>
                    {downloads.map((item) => (
                      <li key={item.url}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setSelectedDownload(item);
                            setDownloadOpen(true);
                          }}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {(product.schematicImage || product.schematicCaption) && (
        <section className="product-overview">
          <div className="container">
            <div className="technical-diagram diagram-layout">
              <div className="diagram-text">
                <h3>System Schematic</h3>
                <p>
                  Explore the system architecture and key subsystems that shape process stability
                  and repeatability in your lab.
                </p>
                {product.schematicCaption && (
                  <p className="diagram-caption">{product.schematicCaption}</p>
                )}
              </div>
              {product.schematicImage && (
                <div className="diagram-media">
                  <img
                    src={product.schematicImage}
                    alt={`${product.name} schematic`}
                    className="schematic-image"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {product.useCases && product.useCases.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <h2>Use Cases</h2>
            <div className="applications-grid">
              {product.useCases.map((item) => (
                <div className="app-card" key={item}>
                  <div className="use-case-header">
                    <span className="use-case-icon">
                      <UseCaseIcon />
                    </span>
                    <h3>{item}</h3>
                  </div>
                  <p>Talk to our team about configuring this system for your workflow.</p>
                </div>
              ))}
            </div>
            <div className="applications-cta">
              <button className="btn btn-primary" onClick={() => setQuoteOpen(true)}>
                Get a Configuration Plan
              </button>
            </div>
          </div>
        </section>
      )}

      {product.applications && product.applications.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <h2>Typical Applications</h2>
            <div className="applications-grid">
              {product.applications.map((item) => (
                <div className="app-card" key={item}>
                  <div className="use-case-header">
                    <span className="use-case-icon">
                      <ApplicationIcon />
                    </span>
                    <h3>{item}</h3>
                  </div>
                  <p>We help map application requirements to optimal configurations.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {product.keyCharacteristics && product.keyCharacteristics.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <h2>Key Characteristics</h2>
            <div className="applications-grid">
              {product.keyCharacteristics.map((item) => (
                <div className="app-card" key={item}>
                  <div className="use-case-header">
                    <span className="use-case-icon">
                      <HighlightIcon />
                    </span>
                    <h3>{item}</h3>
                  </div>
                  <p>Configured for repeatable results and research workflows.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {product.supportIntegration && product.supportIntegration.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <h2>Support & Integration</h2>
            <div className="applications-grid">
              {product.supportIntegration.map((item) => (
                <div className="app-card" key={item}>
                  <div className="use-case-header">
                    <span className="use-case-icon">
                      <ResultIcon />
                    </span>
                    <h3>{item}</h3>
                  </div>
                  <p>We help coordinate delivery, onboarding, and service requests.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {product.costEffectivePoints && product.costEffectivePoints.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <div className="cost-effective-block">
              <h2>Why Our Systems Are Cost-Effective</h2>
              <ul>
                {product.costEffectivePoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {product.expectations && product.expectations.length > 0 && (
        <section className="applications-section">
          <div className="container">
            <h2>What You Can Expect</h2>
            <div className="applications-grid">
              {product.expectations.map((item) => (
                <div className="app-card" key={item}>
                  <div className="use-case-header">
                    <span className="use-case-icon">
                      <ResultIcon />
                    </span>
                    <h3>{item}</h3>
                  </div>
                  <p>We keep communication clear and timelines predictable.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {manufacturer && (
        <section className="manufacturer-intro">
          <div className="container">
            <div className="manufacturer-content">
              <h2>Manufacturing Partner</h2>
              <div className="manufacturer-info">
                <div className="manufacturer-text">
                  <p>{manufacturer.description || manufacturer.name}</p>
                  {manufacturer.highlights && manufacturer.highlights.length > 0 && (
                    <ul className="manufacturer-strengths">
                      {manufacturer.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="manufacturer-stats">
                  <div className="stat-item">
                    <span className="stat-number">30+</span>
                    <span className="stat-label">Years of<br />Experience</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">1000+</span>
                    <span className="stat-label">Global<br />Installations</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">300+</span>
                    <span className="stat-label">Research<br />Institutions Served</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <QuoteModal
        isOpen={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        onDownloadBrochure={() => {
          setSelectedDownload(primaryDownload);
          setDownloadOpen(true);
        }}
        productName={product.name}
      />

      {activeDownload && (
        <DownloadGateModal
          isOpen={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          fileUrl={activeDownload.url}
          fileName={activeDownload.name}
          title={`Download ${product.name} Brochure`}
        />
      )}
    </>
  );
}

export default ProductDetailPage;
