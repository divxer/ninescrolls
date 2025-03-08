import { useParams } from 'react-router-dom';
import { ContactForm } from '../components/ContactForm';
import '../styles/ProductDetailPage.css';

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

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const product = productId ? PRODUCTS[productId as keyof typeof PRODUCTS] : null;

  if (!product) {
    return <div className="container">Product not found</div>;
  }

  return (
    <>
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
              <div className="main-image">
                <img src={product.images[0]} alt={product.name} />
              </div>
              <div className="image-gallery">
                {product.images.slice(1).map((image, index) => (
                  <img key={index} src={image} alt={`${product.name} detail ${index + 1}`} />
                ))}
              </div>
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
                <p>Fill out the form below and our team will get back to you with more information.</p>
                <ContactForm 
                  product={product} 
                  className="product-inquiry-form" 
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 