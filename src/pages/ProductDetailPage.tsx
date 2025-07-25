import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { ContactFormModal } from '../components/common/ContactFormModal';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { getProductComponent } from '../components/products';
import '../styles/ProductDetailPage.css';
import { analytics } from '../services/analytics';

// This would typically come from an API or database
const PRODUCTS = {
  'rie-etcher': {
    id: 'rie-etcher',
    name: 'RIE Etcher Series',
    description: 'High-precision etching with advanced plasma etching capabilities for semiconductor processing.',
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
    images: [
      '/assets/images/products/rie-etcher/main.jpg',
      '/assets/images/products/rie-etcher/detail-1.jpg',
      '/assets/images/products/rie-etcher/detail-2.jpg',
      '/assets/images/products/rie-etcher/detail-3.jpg'
    ]
  },
  'icp-etcher': {
    id: 'icp-etcher',
    name: 'ICP Etcher Series',
    description: 'Advanced inductively coupled plasma etching system for high-aspect-ratio etching.',
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
    images: [
      '/assets/images/products/icp-etcher/main.jpg',
      '/assets/images/products/icp-etcher/detail-1.jpg',
      '/assets/images/products/icp-etcher/detail-2.jpg',
      '/assets/images/products/icp-etcher/detail-3.jpg'
    ]
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
    description: 'Advanced High-Density Plasma Chemical Vapor Deposition system for semiconductor manufacturing. Features compact design, exceptional film quality, and precise process control.',
    keywords: 'HDP-CVD, chemical vapor deposition, semiconductor equipment, thin film deposition, plasma CVD',
  },
  'pecvd': {
    title: 'PECVD System Series',
    description: 'Plasma-Enhanced Chemical Vapor Deposition system offering superior film quality and process control. Compact design with advanced plasma technology for semiconductor manufacturing.',
    keywords: 'PECVD, plasma enhanced CVD, semiconductor equipment, thin film deposition, chemical vapor deposition',
  },
  'ald': {
    title: 'ALD System Series',
    description: 'Advanced Atomic Layer Deposition system delivering precise atomic-level control for thin film deposition. Features exceptional conformality and thickness control for semiconductor applications.',
    keywords: 'ALD, atomic layer deposition, semiconductor equipment, thin film deposition, atomic-level precision',
  },
  'sputter': {
    title: 'Sputter System Series',
    description: 'High-performance Physical Vapor Deposition system featuring advanced sputtering technology. Delivers excellent film uniformity and precise thickness control for semiconductor applications.',
    keywords: 'sputter system, PVD, physical vapor deposition, semiconductor equipment, thin film deposition',
  },
  'ibe-ribe': {
    title: 'IBE/RIBE System Series',
    description: 'Advanced Ion Beam Etching and Reactive Ion Beam Etching system providing precise material processing capabilities. Features exceptional control and uniformity for semiconductor manufacturing.',
    keywords: 'IBE, RIBE, ion beam etching, semiconductor equipment, surface treatment, reactive ion etching',
  },
  'striper': {
    title: 'Striper System Series',
    description: 'Advanced photoresist removal and surface cleaning system featuring efficient processing capabilities. Ensures complete removal of organic materials with precise process control.',
    keywords: 'photoresist stripper, surface cleaning, semiconductor equipment, resist removal, wafer cleaning',
  },
  'coater-developer': {
    title: 'Coater/Developer System Series',
    description: 'Advanced photoresist coating and developing system with high-precision capabilities. Features compact design and customizable configurations for semiconductor manufacturing.',
    keywords: 'photoresist coating, wafer developing, semiconductor equipment, lithography system, spin coater',
  },
  'rie-etcher': {
    title: 'RIE Etcher Series',
    description: 'Advanced Reactive Ion Etching system providing precise plasma etching capabilities. Features excellent process control and uniformity for semiconductor manufacturing.',
    keywords: 'RIE etcher, reactive ion etching, semiconductor equipment, plasma etching, etching system',
  },
  'icp-etcher': {
    title: 'ICP Etcher Series',
    description: 'Advanced Inductively Coupled Plasma etching system delivering high-performance plasma processing. Features precise control and excellent uniformity for semiconductor manufacturing.',
    keywords: 'ICP etcher, plasma etching, semiconductor equipment, inductively coupled plasma, etching system',
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

  if (!ProductComponent) {
    return <div className="container">Product not found</div>;
  }

  if (!product) {
    return <div className="container">Product not found</div>;
  }

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.images.map(img => `https://ninescrolls.us${img}`),
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "Nine Scrolls Technology",
      "url": "https://ninescrolls.us"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "Nine Scrolls Technology",
        "url": "https://ninescrolls.us"
      }
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
        image={`/assets/images/products/${productId}/large.jpg`}
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
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