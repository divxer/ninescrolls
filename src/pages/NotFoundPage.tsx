import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';

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
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <main className="min-h-[819px] flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-[12rem] font-headline font-black text-on-surface/5 leading-none select-none">404</h1>
        <div className="-mt-20">
          <h2 className="text-4xl font-headline font-bold mb-4">Precision Segment Missing</h2>
          <p className="text-on-surface-variant mb-8 max-w-md mx-auto">The data segment you are looking for has been moved or archived.</p>

          {suggestedPath && (
            <div className="mb-8 bg-surface-container-low p-6 rounded-xl inline-block">
              <p className="text-on-surface-variant text-sm mb-2">Did you mean to visit:</p>
              <Link to={suggestedPath} className="text-primary font-bold hover:underline text-lg">
                {suggestedPath}
              </Link>
            </div>
          )}

          <div className="mb-12">
            <h3 className="text-lg font-headline font-bold mb-6 text-on-surface">Helpful Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-3xl mx-auto">
              <div>
                <h4 className="font-bold text-on-surface mb-3 text-sm uppercase tracking-widest">Products</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/products/ald" className="text-on-surface-variant hover:text-primary transition-colors">ALD Systems</Link></li>
                  <li><Link to="/products/icp-etcher" className="text-on-surface-variant hover:text-primary transition-colors">ICP Etching Systems</Link></li>
                  <li><Link to="/products/rie-etcher" className="text-on-surface-variant hover:text-primary transition-colors">RIE Etching Systems</Link></li>
                  <li><Link to="/products/sputter" className="text-on-surface-variant hover:text-primary transition-colors">Sputter Systems</Link></li>
                  <li><Link to="/products/pecvd" className="text-on-surface-variant hover:text-primary transition-colors">PECVD Systems</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-on-surface mb-3 text-sm uppercase tracking-widest">Resources</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/insights" className="text-on-surface-variant hover:text-primary transition-colors">Technical Insights</Link></li>
                  <li><a href="/NineScrolls-Equipment-Guide.pdf" download="NineScrolls-Equipment-Guide.pdf" className="text-on-surface-variant hover:text-primary transition-colors">Equipment Guide</a></li>
                  <li><Link to="/about" className="text-on-surface-variant hover:text-primary transition-colors">About NineScrolls</Link></li>
                  <li><Link to="/contact" className="text-on-surface-variant hover:text-primary transition-colors">Contact Us</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-on-surface mb-3 text-sm uppercase tracking-widest">Popular Pages</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/" className="text-on-surface-variant hover:text-primary transition-colors">Home</Link></li>
                  <li><Link to="/products" className="text-on-surface-variant hover:text-primary transition-colors">All Products</Link></li>
                  <li><Link to="/insights" className="text-on-surface-variant hover:text-primary transition-colors">Latest Insights</Link></li>
                  <li><Link to="/contact" className="text-on-surface-variant hover:text-primary transition-colors">Get Quote</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-on-surface-variant mb-6">Can't find what you're looking for? Try browsing or contact our team.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/products" className="bg-primary text-white px-8 py-3 rounded-sm font-bold hover:opacity-90 transition-opacity">
                Browse All Products
              </Link>
              <Link to="/contact" className="border border-outline-variant text-on-surface px-8 py-3 rounded-sm font-bold hover:bg-surface-container-low transition-colors">
                Contact Our Team
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
