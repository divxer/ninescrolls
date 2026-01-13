import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { ContactFormModal } from '../components/common/ContactFormModal';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { getProductComponent } from '../components/products';
import '../styles/ProductDetailPage.css';
import { analytics } from '../services/analytics';

// Product data for structured data and SEO
const PRODUCTS = {
  'hdp-cvd': {
    id: 'hdp-cvd',
    name: 'HDP-CVD System Series',
    description: 'Advanced High-Density Plasma CVD system with uni-body design for exceptional film quality and gap-fill capability.',
    features: [
      'Compact uni-body design with outstanding space efficiency',
      'Compatible with various deposition materials (Si, SiO₂, SiNx, SiON, SiC)',
      'Optional RF system (Source: 1000-3000W / Bias: 300-1000W)',
      'Excellent step coverage with tunable parameters'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF Power: Source 1000-3000W, Bias 300-1000W',
      'Process Temperature: 20°C to 200°C',
      'Film Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/hdp-cvd/main.jpg']
  },
  'pecvd': {
    id: 'pecvd',
    name: 'PECVD System Series',
    description: 'Plasma-Enhanced CVD system with compact uni-body design for versatile thin film deposition.',
    features: [
      'Uni-body compact design (footprint: ~1.0m x 1.0m)',
      'Variable plasma discharge gap for optimized performance',
      'Dual RF configuration (13.56 MHz and/or 400 KHz)',
      'Automated and modular process design'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF System: 13.56 MHz and/or 400 KHz, 500-2000W',
      'Temperature Range: 20°C to 400°C',
      'Film Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/pecvd/main.jpg']
  },
  'ald': {
    id: 'ald',
    name: 'ALD System Series',
    description: 'Atomic Layer Deposition system offering atomic-level precision with compact uni-body design.',
    features: [
      'Compact uni-body design (0.8m x 1.0m footprint)',
      'Box-in-box process chamber for enhanced stability',
      'Excellent high-aspect-ratio step coverage',
      'Optional remote plasma capability (300-1000W)'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or supersize',
      'Temperature Range: 20°C to 400°C',
      'Growth Rate: 0.5-2 Å per cycle',
      'Film Uniformity: < 1% (Al₂O₃, edge exclusion)'
    ],
    images: ['/assets/images/products/ald/main.jpg']
  },
  'sputter': {
    id: 'sputter',
    name: 'Sputter System Series',
    description: 'Advanced PVD sputtering system with innovative magnetron design for high-performance thin films.',
    features: [
      'Compact uni-body design (approx. 1.0m x 1.7m)',
      'Customizable magnetron target configuration',
      'Multiple magnetron sources (2-6 available)',
      'RF-biased substrate capability'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'Magnetron Sources: 2-6 independently configurable',
      'Substrate Temperature: Water-cooled to 1200°C',
      'Film Uniformity: < 1% typical, < 5% guaranteed'
    ],
    images: ['/assets/images/products/sputter/main.jpg']
  },
  'ibe-ribe': {
    id: 'ibe-ribe',
    name: 'IBE/RIBE System Series',
    description: 'Ion Beam Etching system combining IBE and RIBE capabilities for precision material processing.',
    features: [
      'Compact uni-body design (1.0m x 0.8m)',
      'Quick-swap ion source system (Kaufman/RF)',
      'Dual-mode operation: IBE and RIBE',
      'Variable incident angle (0-90°) with rotation'
    ],
    specifications: [
      'Wafer Size: Up to 12" or multi-wafer',
      'Tilt Angle: 0° to 90°, rotation 1-10 rpm',
      'Base Pressure: < 7×10⁻⁷ Torr',
      'Film Non-Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/ibe-ribe/main.jpg']
  },
  'striper': {
    id: 'striper',
    name: 'Stripping System Series',
    description: 'Advanced photoresist stripping and surface cleaning system with compact uni-body design.',
    features: [
      'Compact uni-body design (0.8m x 0.8m)',
      'Uniform chamber center pump-down design',
      'Adjustable plasma discharge gap',
      'Real-time process monitoring'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" or multi-wafer',
      'RF Power: 300W to 1000W (customizable)',
      'Stage Temperature: 5°C to 200°C',
      'Film Non-Uniformity: < 5% (edge exclusion)'
    ],
    images: ['/assets/images/products/striper/main.jpg']
  },
  'coater-developer': {
    id: 'coater-developer',
    name: 'Coater/Developer System Series',
    description: 'High-precision photoresist coating and developing system with modular configuration.',
    features: [
      'Compact uni-body design (1.0m x 0.8m)',
      'Flexible module configuration (Coater, Developer, Hotplate)',
      'High-speed spin modules with precise control',
      'Optional edge bead removal (EBR)'
    ],
    specifications: [
      'Wafer Size: 2" to 12" or square substrates',
      'Coater Speed: Up to 8000 rpm ±1 rpm',
      'Developer Speed: Up to 5000 rpm ±1 rpm',
      'Coating Uniformity: < 0.5% (3σ typical)'
    ],
    images: ['/assets/images/products/coater-developer/main.jpg']
  },
  'rie-etcher': {
    id: 'rie-etcher',
    name: 'RIE Etcher Series',
    description: 'Reactive Ion Etching system providing precise plasma etching for semiconductor manufacturing.',
    features: [
      'Precise control of etch parameters',
      'Advanced plasma generation system',
      'Real-time monitoring and control',
      'Automated recipe management'
    ],
    specifications: [
      'Process chamber size: 8" standard (12" available)',
      'Base pressure: < 1×10⁻⁶ Torr',
      'RF power: 600W standard (1000W optional)',
      'Process gases: Up to 4 MFCs standard'
    ],
    images: ['/assets/images/products/rie-etcher/main.jpg']
  },
  'compact-rie': {
    id: 'compact-rie',
    name: 'Compact RIE Etcher (SV-RIE)',
    description: 'Compact reactive ion etching system with ultra-small footprint, ideal for research labs, pilot-scale processes, and failure analysis applications.',
    features: [
      'Ultra-compact footprint: 630mm × 600mm (one-piece design)',
      'Touchscreen control with fully automated operation system',
      'Modular design for easy maintenance and convenient transport',
      'Stable performance with excellent cost-effectiveness',
      'Supports 4", 6", 8", 12" wafers (customizable for smaller sizes)'
    ],
    specifications: [
      'Wafer Size: 4", 6", 8", 12" (customizable for smaller sizes)',
      'RF Power: 300W / 500W / 1000W (customizable)',
      'Process Gases: Up to 5 gas lines simultaneously',
      'Flow Control: 0 ~ 1000 sccm range (selectable)',
      'Pump: Mechanical pump / optional turbo pump',
      'Optional: Removable contamination-resistant liner'
    ],
    images: ['/assets/images/products/compact-rie/main.jpg']
  },
  'icp-etcher': {
    id: 'icp-etcher',
    name: 'ICP Etcher Series',
    description: 'Inductively Coupled Plasma etching system for high-aspect-ratio and advanced etching applications.',
    features: [
      'High-density plasma generation',
      'Independent control of ion energy and density',
      'Advanced process control system',
      'Multi-step recipe capability'
    ],
    specifications: [
      'Process chamber size: 12" standard',
      'Base pressure: < 5×10⁻⁷ Torr',
      'ICP power: 2000W standard',
      'Bias power: 600W standard'
    ],
    images: ['/assets/images/products/icp-etcher/main.jpg']
  }
};

interface ProductSEOData {
  [key: string]: {
    title: string;
    description: string;
    keywords: string;
  };
}

const productSEOData: ProductSEOData = {
  'hdp-cvd': {
    title: 'HDP-CVD System Series',
    description: 'High-Density Plasma CVD system for semiconductor manufacturing. Compact design with exceptional film quality and superior gap-fill capability.',
    keywords: 'HDP-CVD, chemical vapor deposition, semiconductor equipment, thin film deposition, plasma CVD',
  },
  'pecvd': {
    title: 'PECVD System Series',
    description: 'Plasma-Enhanced CVD system with compact design for versatile thin film deposition. Superior film quality and flexible process control.',
    keywords: 'PECVD, plasma enhanced CVD, semiconductor equipment, thin film deposition, chemical vapor deposition',
  },
  'ald': {
    title: 'ALD System Series',
    description: 'Atomic Layer Deposition system with atomic-level precision. Exceptional conformality and sub-nanometer thickness control for advanced applications.',
    keywords: 'ALD, atomic layer deposition, semiconductor equipment, thin film deposition, atomic-level precision',
  },
  'sputter': {
    title: 'Sputter System Series',
    description: 'Advanced PVD sputtering system with innovative magnetron design. Excellent film uniformity and precise thickness control.',
    keywords: 'sputter system, PVD, physical vapor deposition, semiconductor equipment, thin film deposition',
  },
  'ibe-ribe': {
    title: 'IBE/RIBE System Series',
    description: 'Ion Beam Etching system combining IBE and RIBE modes for precision material processing. Exceptional control and surface uniformity.',
    keywords: 'IBE, RIBE, ion beam etching, semiconductor equipment, surface treatment, reactive ion etching',
  },
  'striper': {
    title: 'Striper System Series',
    description: 'Advanced photoresist stripping and surface cleaning system. Complete organic material removal with precise process control.',
    keywords: 'photoresist stripper, surface cleaning, semiconductor equipment, resist removal, wafer cleaning',
  },
  'coater-developer': {
    title: 'Coater/Developer System Series',
    description: 'High-precision photoresist coating and developing system. Compact modular design with customizable configurations.',
    keywords: 'photoresist coating, wafer developing, semiconductor equipment, lithography system, spin coater',
  },
  'rie-etcher': {
    title: 'RIE Etcher Series',
    description: 'Reactive Ion Etching system with precise plasma etching capabilities. Excellent process control and uniformity for semiconductor fab.',
    keywords: 'RIE etcher, reactive ion etching, semiconductor equipment, plasma etching, etching system',
  },
  'icp-etcher': {
    title: 'ICP Etcher Series',
    description: 'Inductively Coupled Plasma etcher for high-aspect-ratio etching. High-density plasma with independent ion energy control.',
    keywords: 'ICP etcher, plasma etching, semiconductor equipment, inductively coupled plasma, etching system',
  },
  'compact-rie': {
    title: 'Compact RIE Etcher (SV-RIE) - Ultra-Compact Reactive Ion Etching | NineScrolls',
    description: 'Compact RIE etching system with 630mm×600mm footprint. Ideal for research labs, pilot-scale processes, and failure analysis. Touchscreen control, modular design.',
    keywords: 'compact RIE, SV-RIE, small footprint RIE, compact reactive ion etching, research RIE system, failure analysis equipment',
  },
};

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const ProductComponent = getProductComponent(productId || '');
  const seoData = productSEOData[productId || ''] || {
    title: 'Product Details',
    description: 'Advanced semiconductor manufacturing equipment from Nine Scrolls Technology.',
    keywords: 'semiconductor equipment, manufacturing equipment, semiconductor technology',
  };

  const product = PRODUCTS[productId as keyof typeof PRODUCTS];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    if (product) {
      // Track contact form submission
      analytics.trackContactFormSubmit(product.id, product.name);
    }
  };

  useEffect(() => {
    if (product) {
      // Track product view
      analytics.trackProductView(product.id, product.name);
    }
  }, [product]);

  // Scroll to top when component mounts or productId changes
  useScrollToTop([productId]);

  if (!ProductComponent) {
    return <div className="container">Product not found</div>;
  }

  if (!product) {
    return <div className="container">Product not found</div>;
  }

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": `https://ninescrolls.com/products/${productId}#product`,
    "name": product.name,
    "description": product.description,
    "image": product.images.map(img => `https://ninescrolls.com${img}`),
    "sku": productId,
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "Nine Scrolls Technology",
      "url": "https://ninescrolls.com"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "Nine Scrolls Technology",
        "url": "https://ninescrolls.com"
      },
      "url": `https://ninescrolls.com/products/${productId}`,
      "itemCondition": "https://schema.org/NewCondition"
    },
    "additionalProperty": [
      ...product.features.map(feature => ({
        "@type": "PropertyValue",
        "name": "Feature",
        "value": feature
      })),
      ...product.specifications.map(spec => ({
        "@type": "PropertyValue",
        "name": "Specification",
        "value": spec
      }))
    ]
  };

  // Breadcrumb structured data for SEO
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
        "item": `https://ninescrolls.com/products/${productId}`
      }
    ]
  };

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

  return (
    <>
      <SEO 
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        url={`/products/${productId}`}
        image={`/assets/images/products/${productId}/main.jpg`}
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
      <section className="product-hero">
        <div className="container">
          <h1>{product.name}</h1>
          <p className="product-description">{product.description}</p>
        </div>
      </section>

      <section className="product-details">
        <div className="container">
          <div className="product-grid">
            <div className="product-images">
              <OptimizedImage
                src={product.images[0]}
                alt={`${product.name} - Main View`}
                sizes={getImageSizes(product.images[0])}
                width={800}
                height={600}
                loading="eager"
                className="main-product-image"
              />
            </div>

            <div className="product-info">
              <div className="info-section">
                <h2>Key Features</h2>
                <ul>
                  {product.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="info-section">
                <h2>Specifications</h2>
                <ul>
                  {product.specifications.map((spec, index) => (
                    <li key={index}>{spec}</li>
                  ))}
                </ul>
              </div>

              <div className="product-inquiry">
                <h2>Interested in this product?</h2>
                <p>Contact our team for detailed specifications and pricing information.</p>
                <button className="btn btn-primary" onClick={openContactForm}>
                  Request Information
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName={product.name}
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 