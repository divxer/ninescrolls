import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Chat } from '../common/Chat';
import { CookieBanner } from '../common/CookieBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  // Analytics helper
  const trackProductMenuClick = (label: string, category: string) => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'click', {
          event_category: 'Nav Products',
          event_label: `${category} - ${label}`,
          value: 1
        });
      }
      if (Array.isArray(w._hsq)) {
        w._hsq.push(['trackEvent', { id: 'nav_products_click', value: `${category}:${label}` }]);
      }
    }
  };

  const openProducts = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsProductsOpen(true);
  };

  const scheduleProductsClose = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setIsProductsOpen(false), 220);
  };
  
  // Close menu when location changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsProductsOpen(false);
  }, [location]);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest('.nav-container')) {
        setIsMenuOpen(false);
      }
      if (isProductsOpen && !target.closest('.has-dropdown')) {
        setIsProductsOpen(false);
      }
    };
    
    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  return (
    <>
      <Chat />
      <CookieBanner />
      <header className="main-header">
        <nav className="nav-container">
          <div className="logo">
            <Link to="/">
              <img src="/assets/images/logo.svg" alt="NineScrolls LLC" className="logo-img" />
              <span className="logo-text">NineScrolls LLC</span>
            </Link>
          </div>
          
          {/* Hamburger Menu Button */}
          <button 
            className={`hamburger-menu ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          
          <ul className={`nav-links ${isMenuOpen ? 'nav-open' : ''}`}>
            <li><Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Home</Link></li>
            <li><Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>About Us</Link></li>
            <li 
              className={`has-dropdown ${isProductsOpen ? 'open' : ''}`}
              onMouseEnter={openProducts}
              onMouseLeave={scheduleProductsClose}
            >
              {isMenuOpen ? (
                <button
                  className={`nav-link dropdown-trigger ${location.pathname.startsWith('/products') ? 'active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={isProductsOpen}
                  onClick={() => setIsProductsOpen(!isProductsOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsProductsOpen(false);
                  }}
                >
                  Products
                </button>
              ) : (
                <Link
                  to="/products"
                  className={`nav-link dropdown-trigger ${location.pathname.startsWith('/products') ? 'active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={isProductsOpen}
                  onClick={() => trackProductMenuClick('All Products (label)','CTA')}
                >
                  Products
                </Link>
              )}
              <div className="dropdown-panel" role="menu" aria-label="Products">
                <div className="dropdown-grid">
                  <div className="dropdown-col">
                    <h4>Etching</h4>
                    <Link to="/products/icp-etcher" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('ICP‑RIE','Etching'); }}>ICP‑RIE</Link>
                    <Link to="/products/rie-etcher" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('RIE','Etching'); }}>RIE</Link>
                    <Link to="/products/rie-etcher#drie" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('DRIE','Etching'); }}>DRIE (Bosch)</Link>
                  </div>
                  <div className="dropdown-col">
                    <h4>Deposition</h4>
                    <Link to="/products/pecvd" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('PECVD','Deposition'); }}>PECVD</Link>
                    <Link to="/products/ald" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('ALD','Deposition'); }}>ALD</Link>
                    <Link to="/products/hdp-cvd" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('HDP‑CVD','Deposition'); }}>HDP‑CVD</Link>
                  </div>
                  <div className="dropdown-col">
                    <h4>Coating / Developing</h4>
                    <Link to="/products/coater-developer" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Coater / Developer','Coating / Developing'); }}>Coater / Developer</Link>
                    <h4 style={{marginTop:'12px'}}>Cleaning / Stripping</h4>
                    <Link to="/products/striper" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Stripping System','Cleaning / Stripping'); }}>Stripping System</Link>
                  </div>
                  <div className="dropdown-cta">
                    <Link to="/products" className="btn btn-primary" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('All Products','CTA'); }}>All Products</Link>
                    <Link to="/contact?topic=quote" className="btn btn-secondary" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Request a Quote','CTA'); }}>Request a Quote</Link>
                  </div>
                </div>
              </div>
            </li>
            <li><Link to="/startup-package" className={`nav-link ${location.pathname === '/startup-package' || location.pathname === '/solutions/startup-labs' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Startup Package</Link></li>
            <li><Link to="/service-support" className={`nav-link ${location.pathname === '/service-support' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Service & Support</Link></li>
            <li><Link to="/insights" className={`nav-link ${location.pathname === '/insights' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Insights</Link></li>
            <li><Link to="/contact" className={`nav-link ${location.pathname === '/contact' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Contact Us</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer className="main-footer" id="contact">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Contact Us</h4>
              <p>Email: info@ninescrolls.com</p>
              <p>For urgent inquiries: +1 (858) 537-7743</p>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://linkedin.com/company/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a href="https://twitter.com/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://www.youtube.com/@NineScrollsLLC" className="social-link" target="_blank" rel="noopener noreferrer">YouTube</a>
              </div>
            </div>
            <div className="footer-section">
              <h4>Partners</h4>
              <div className="social-links">
                <a href="http://en.beijingtailong.com/" className="social-link" target="_blank" rel="noopener noreferrer">Beijing Tailong Electronic Technology</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 NineScrolls LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
} 