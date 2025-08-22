import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/NotFoundPage.css';

export const NotFoundPage: React.FC = () => {
  const location = useLocation();

  // Scroll to top when component mounts
  useScrollToTop();

  useEffect(() => {
    // Track 404 error for analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: '404 - Page Not Found',
        page_location: window.location.href,
        custom_map: {
          'error_type': '404_not_found'
        }
      });
    }
  }, []);

  // Common 404 paths and their suggested redirects
  const getSuggestedPath = (pathname: string) => {
    const suggestions: Record<string, string> = {
      '/product': '/products',
      '/product/': '/products',
      '/products/ald-system': '/products/ald',
      '/products/icp-etching': '/products/icp-etcher',
      '/products/rie-etching': '/products/rie-etcher',
      '/products/sputtering': '/products/sputter',
      '/products/pecvd-system': '/products/pecvd',
      '/products/hdp-cvd-system': '/products/hdp-cvd',
      '/products/ibe-ribe-system': '/products/ibe-ribe',
      '/products/coater-developer-system': '/products/coater-developer',
      '/products/striper-system': '/products/striper',
      '/blog': '/insights',
      '/blog/': '/insights',
      '/news': '/insights',
      '/about-us': '/about',
      '/contact-us': '/contact',
      '/enquiry': '/contact',
      '/quote': '/contact',
      '/support': '/contact',
      '/datasheet': '/products',
      '/datasheets': '/products',
      '/catalog': '/products',
      '/equipment': '/products',
      '/systems': '/products',
      '/technology': '/insights',
      '/research': '/insights',
      '/applications': '/insights'
    };

    return suggestions[pathname.toLowerCase()] || null;
  };

  const suggestedPath = getSuggestedPath(location.pathname);

  return (
    <>
      <SEO 
        title="404 - Page Not Found"
        description="The page you're looking for doesn't exist. Explore our semiconductor equipment products, insights, and contact information."
        keywords="404, page not found, semiconductor equipment, thin film deposition, etching systems"
        url="/404"
        type="website"
      />
      
      <div className="not-found-page">
        <div className="container">
          <div className="not-found-content">
            <div className="error-code">404</div>
            <h1>Page Not Found</h1>
            <p className="error-message">
              Sorry, the page you're looking for doesn't exist or has been moved.
            </p>
            
            {suggestedPath && (
              <div className="suggestion-box">
                <p>Did you mean to visit:</p>
                <Link to={suggestedPath} className="suggested-link">
                  {suggestedPath}
                </Link>
              </div>
            )}

            <div className="helpful-links">
              <h2>Here are some helpful links:</h2>
              <div className="links-grid">
                <div className="link-category">
                  <h3>Products</h3>
                  <ul>
                    <li><Link to="/products/ald">ALD Systems</Link></li>
                    <li><Link to="/products/icp-etcher">ICP Etching Systems</Link></li>
                    <li><Link to="/products/rie-etcher">RIE Etching Systems</Link></li>
                    <li><Link to="/products/sputter">Sputter Systems</Link></li>
                    <li><Link to="/products/pecvd">PECVD Systems</Link></li>
                  </ul>
                </div>
                
                <div className="link-category">
                  <h3>Resources</h3>
                  <ul>
                    <li><Link to="/insights">Technical Insights</Link></li>
                    <li><a href="/equipment-guide.pdf" download="NineScrolls-Equipment-Guide.pdf">Equipment Guide</a></li>
                    <li><Link to="/about">About NineScrolls</Link></li>
                    <li><Link to="/contact">Contact Us</Link></li>
                  </ul>
                </div>
                
                <div className="link-category">
                  <h3>Popular Pages</h3>
                  <ul>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/products">All Products</Link></li>
                    <li><Link to="/insights">Latest Insights</Link></li>
                    <li><Link to="/contact">Get Quote</Link></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="search-section">
              <h2>Can't find what you're looking for?</h2>
              <p>Try searching our website or contact our technical team for assistance.</p>
              <div className="action-buttons">
                <Link to="/products" className="btn btn-primary">
                  Browse All Products
                </Link>
                <Link to="/contact" className="btn btn-secondary">
                  Contact Our Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
