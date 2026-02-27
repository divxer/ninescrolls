import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { OptimizedImage } from '../components/common/OptimizedImage';
import '../styles/HomePage.css';

export function HomePage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const { posts: allInsightsPosts, loading: insightsLoading } = useInsightsPosts();
  const latestInsights = useMemo(
    () => [...allInsightsPosts]
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 3),
    [allInsightsPosts]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://ninescrolls.com/#organization",
        "url": "https://ninescrolls.com",
        "name": "NineScrolls LLC",
        "description": "Research-grade semiconductor equipment provider specializing in plasma etching systems (RIE, ICP-RIE), thin-film deposition systems (ALD, PECVD, HDP-CVD), and plasma cleaners for surface preparation.",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ninescrolls.com/assets/images/logo.png"
        },
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
          "telephone": "+1-858-879-8898",
          "contactType": "sales",
          "email": "sales@ninescrolls.com",
          "availableLanguage": ["English", "Chinese"]
        },
        "sameAs": [
          "https://www.linkedin.com/company/nine-scrolls-technology"
        ],
        "knowsAbout": [
          "plasma etching",
          "reactive ion etching",
          "inductively coupled plasma etching",
          "atomic layer deposition",
          "plasma-enhanced chemical vapor deposition",
          "high-density plasma CVD",
          "magnetron sputtering",
          "ion beam etching",
          "plasma cleaning",
          "thin film deposition",
          "semiconductor manufacturing equipment"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://ninescrolls.com/#website",
        "url": "https://ninescrolls.com",
        "name": "NineScrolls",
        "publisher": {
          "@id": "https://ninescrolls.com/#organization"
        }
      }
    ]
  };

  return (
    <>
      <SEO 
        title="NineScrolls - Advanced Plasma Etching & ALD Systems for Semiconductor Manufacturing"
        description="Leading provider of plasma etching systems, ALD equipment, and semiconductor manufacturing solutions. Expert RIE etching, ICP etching, and thin film deposition technology for research and production."
        keywords="plasma etching, plasma etching machine, plasma etching process, inductively coupled plasma etching, what is plasma etching, semiconductor manufacturing, thin film deposition"
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
              <div className="product-image-wrapper">
                <OptimizedImage
                  src="/assets/images/products/rie-etcher/main.jpg"
                  alt="RIE Etcher Series"
                  width={400}
                  height={300}
                />
              </div>
              <div className="product-card-content">
                <h3>RIE Etcher Series - Plasma Etching Systems</h3>
                <p>High-precision RIE etching with advanced plasma etching capabilities for semiconductor processing and MEMS fabrication</p>
                <span className="learn-more">Learn More →</span>
              </div>
            </Link>
            
            <Link to="/products/icp-etcher" className="product-card">
              <div className="product-image-wrapper">
                <OptimizedImage
                  src="/assets/images/products/icp-etcher/main.jpg"
                  alt="ICP Etcher Series"
                  width={400}
                  height={300}
                />
              </div>
              <div className="product-card-content">
                <h3>ICP Etcher Series - Advanced Plasma Etching</h3>
                <p>Advanced inductively coupled plasma etching system for high-aspect-ratio etching and deep reactive ion etching (DRIE)</p>
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
              <p>Advanced manufacturing techniques ensuring nanometer-scale accuracy with ±3% uniformity across wafer surfaces</p>
            </div>
            
            <div className="tech-card">
              <span className="tech-icon">🔧</span>
              <h3>Automation Systems</h3>
              <p>Intelligent control systems with temperature range from -70°C to 200°C for reproducible results and process stability</p>
            </div>
            
            <div className="tech-card">
              <span className="tech-icon">⚡</span>
              <h3>Plasma Technology</h3>
              <p>State-of-the-art plasma processing with high-density sources delivering etch rates up to 5 μm/min for advanced applications</p>
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

      <section className="resources-section">
        <div className="container">
          <h2>Research Insights</h2>
          <p className="section-subtitle">Expert guides and technical resources for research laboratories</p>
          <div className="insights-showcase">
            {insightsLoading ? (
              <div className="loading">Loading insights...</div>
            ) : latestInsights.map((post) => (
                <Link key={post.id} to={`/insights/${post.slug}`} className="insight-card">
                  <div className="insight-card-image">
                    <OptimizedImage
                      src={post.imageUrl}
                      alt={post.title}
                      width={400}
                      height={250}
                    />
                  </div>
                  <div className="insight-card-content">
                    <div className="insight-card-meta">
                      <span className="insight-category">{post.category}</span>
                      <span className="insight-read-time">{post.readTime} min read</span>
                    </div>
                    <h3 className="insight-card-title">{post.title}</h3>
                    {post.excerpt && (
                      <p className="insight-card-excerpt">{post.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
          </div>
          <div className="text-center" style={{ marginTop: '2rem' }}>
            <Link to="/insights" className="btn btn-primary">View All Insights</Link>
          </div>
        </div>
      </section>

      <section className="partners">
        <div className="container">
          <h2>Trusted by Leading Institutions</h2>
          <div className="partner-grid">
            <div className="partner-category">
              <span className="partner-icon">🏛️</span>
              <h3>Research Universities</h3>
              <p>Top-tier academic institutions worldwide</p>
            </div>
            <div className="partner-category">
              <span className="partner-icon">🔬</span>
              <h3>Research Institutes</h3>
              <p>National labs and research centers</p>
            </div>
            <div className="partner-category">
              <span className="partner-icon">🏢</span>
              <h3>Corporate R&D</h3>
              <p>Innovation labs and tech companies</p>
            </div>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial">
              <p>"NineScrolls' cutting-edge systems have significantly advanced our research capabilities in semiconductor device fabrication."</p>
              <p className="testimonial-author">Dr. Sarah Chen</p>
              <p className="testimonial-title">Principal Investigator, Advanced Materials Research Lab</p>
            </div>
            <div className="testimonial">
              <p>"The precision and reliability of NineScrolls equipment has been essential for our MEMS fabrication processes."</p>
              <p className="testimonial-author">Prof. Michael Rodriguez</p>
              <p className="testimonial-title">Department of Electrical Engineering, Research University</p>
            </div>
            <div className="testimonial">
              <p>"Excellent technical support and equipment performance. Highly recommended for research-grade applications."</p>
              <p className="testimonial-author">Dr. Jennifer Kim</p>
              <p className="testimonial-title">Materials Science Research Center</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 