import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { OptimizedImage } from '../components/common/OptimizedImage';
import '../styles/HomePage.css';

export function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "url": "https://ninescrolls.us",
    "name": "Nine Scrolls Technology",
    "description": "Leading provider of advanced semiconductor manufacturing equipment. Specializing in thin film deposition, etching, and surface treatment solutions.",
    "logo": "https://ninescrolls.us/assets/images/logo.png",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "12546 Cabezon Pl",
      "addressLocality": "San Diego",
      "addressRegion": "CA",
      "postalCode": "92129",
      "addressCountry": "US"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-858-537-7743",
      "contactType": "sales",
      "email": "sales@ninescrolls.com",
      "availableLanguage": ["English", "Chinese"]
    },
    "sameAs": [
      "https://www.linkedin.com/company/nine-scrolls-technology"
    ]
  };

  return (
    <>
      <SEO 
        title="Home"
        description="Nine Scrolls Technology - Leading provider of advanced semiconductor manufacturing equipment. Specializing in thin film deposition, etching, and surface treatment solutions."
        keywords="semiconductor equipment, thin film deposition, etching system, coating system, semiconductor manufacturing, RIE etcher, ICP etcher"
        url="/"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <section className="hero">
        <div className="container">
          <h1>Innovating the Future of Scientific Research</h1>
          <p>Advanced scientific equipment for the next generation of discovery</p>
          <div className="hero-buttons">
            <Link to="/products" className="btn btn-primary">Explore Our Products</Link>
            <Link to="/about" className="btn btn-secondary">Learn More About Us</Link>
          </div>
        </div>
      </section>

      <section className="products">
        <div className="container">
          <h2>Our Products</h2>
          <p className="section-subtitle">Precision Instruments for Every Research Need</p>
          
          <div className="product-showcase">
            <Link to="/products/rie-etcher" className="product-card">
              <OptimizedImage
                src="/assets/images/products/rie-etcher/main.jpg"
                alt="RIE Etcher Series"
                width={400}
                height={300}
              />
              <div className="product-card-content">
                <h3>RIE Etcher Series</h3>
                <p>High-precision etching with advanced plasma etching capabilities for semiconductor processing</p>
                <span className="learn-more">Learn More →</span>
              </div>
            </Link>
            
            <Link to="/products/icp-etcher" className="product-card">
              <OptimizedImage
                src="/assets/images/products/icp-etcher/main.jpg"
                alt="ICP Etcher Series"
                width={400}
                height={300}
              />
              <div className="product-card-content">
                <h3>ICP Etcher Series</h3>
                <p>Advanced inductively coupled plasma etching system for high-aspect-ratio etching</p>
                <span className="learn-more">Learn More →</span>
              </div>
            </Link>
          </div>
          
          <div className="text-center">
            <Link to="/products" className="btn btn-primary">View All Products</Link>
          </div>
        </div>
      </section>

      <section className="technologies">
        <div className="container">
          <h2>Cutting-Edge Technologies</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <span className="tech-icon">⚙️</span>
              <h3>Precision Engineering</h3>
              <p>Advanced manufacturing techniques ensuring nanometer-scale accuracy</p>
            </div>
            
            <div className="tech-card">
              <span className="tech-icon">🔧</span>
              <h3>Automation Systems</h3>
              <p>Intelligent control systems for reproducible results</p>
            </div>
            
            <div className="tech-card">
              <span className="tech-icon">⚡</span>
              <h3>Plasma Technology</h3>
              <p>State-of-the-art plasma processing solutions</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rd-section">
        <div className="container">
          <h2>Driving Innovation Through R&D</h2>
          <p>Our commitment to research and development drives continuous improvements in our equipment solutions. We work closely with leading research labs to push the boundaries of what's possible in semiconductor processing.</p>
          <Link to="/about" className="btn btn-primary">Discover Our R&D</Link>
        </div>
      </section>

      <section className="partners">
        <div className="container">
          <h2>Trusted by Leading Institutions</h2>
          <div className="partner-grid">
            <div className="partner-category">
              <span className="partner-icon">🏛️</span>
              <h3>Research Universities</h3>
            </div>
            <div className="partner-category">
              <span className="partner-icon">🔬</span>
              <h3>Research Institutes</h3>
            </div>
            <div className="partner-category">
              <span className="partner-icon">🏢</span>
              <h3>Corporate R&D</h3>
            </div>
          </div>
          <div className="testimonial">
            <p>"NineScrolls' cutting-edge systems have significantly advanced our research capabilities in semiconductor device fabrication."</p>
            <p className="testimonial-author">Dr. Sarah Chen</p>
            <p className="testimonial-title">Principal Investigator, Advanced Materials Research</p>
          </div>
        </div>
      </section>
    </>
  );
} 