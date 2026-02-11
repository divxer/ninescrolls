import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Chat } from '../common/Chat';
import { CookieBanner } from '../common/CookieBanner';
import { CartIcon } from '../common/CartIcon';
import { NewsletterSubscribe } from '../common/NewsletterSubscribe';

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
      const w = window;
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
  }, [isMenuOpen, isProductsOpen]);
  
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
                    <Link to="/products/compact-rie" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Compact RIE','Etching'); }}>Compact RIE</Link>
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
                    <Link to="/products/plasma-cleaner" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Plasma Cleaner','Cleaning / Stripping'); }}>Plasma Cleaner</Link>
                    <Link to="/products/plasma-systems" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('NS-Plasma Systems','Cleaning / Stripping'); }}>NS-Plasma Systems</Link>
                    <Link to="/products/ns-plasma-4r" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('NS-Plasma 4R','Cleaning / Stripping'); }}>NS-Plasma 4R</Link>
                    <Link to="/products/ns-plasma-20r" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('NS-Plasma 20R','Cleaning / Stripping'); }}>NS-Plasma 20R</Link>
                    <Link to="/products/ns-plasma-20r-i" role="menuitem" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('NS-Plasma 20R-I','Cleaning / Stripping'); }}>NS-Plasma 20R-I</Link>
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
            <li className="cart-icon-nav"><CartIcon /></li>
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
              <p>Sales: sales@ninescrolls.com</p>
              <p>Support: support@ninescrolls.com</p>
              <p style={{ marginTop: '0.5rem' }}>
                Urgent inquiries: +1 (858) 879-8898<br />
                <span style={{ fontSize: '0.85em', color: '#999' }}>
                  Calls may be routed to voicemail outside business hours.
                </span>
              </p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <div className="footer-nav-links">
                <Link to="/products">Products</Link>
                <Link to="/about">About Us</Link>
                <Link to="/insights">Insights</Link>
                <Link to="/service-support">Service & Support</Link>
                <Link to="/contact">Contact</Link>
              </div>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://linkedin.com/company/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="https://twitter.com/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="https://www.youtube.com/@NineScrollsLLC" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
              <NewsletterSubscribe variant="footer" />
            </div>
            <div className="footer-section">
              <h4>Partners</h4>
              <div className="footer-nav-links">
                <a href="http://en.beijingtailong.com/" target="_blank" rel="noopener noreferrer">Beijing Tailong Electronic Technology</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} NineScrolls LLC. All rights reserved.</p>
            <div className="footer-links">
              <Link to="/privacy">Privacy Policy</Link>
              <span className="footer-link-separator">|</span>
              <Link to="/return-policy">Return Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
} 
