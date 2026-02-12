import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Chat } from '../common/Chat';
import { CookieBanner } from '../common/CookieBanner';
import { CartIcon } from '../common/CartIcon';

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
          {/* Brand Header */}
          <div className="footer-brand-header">
            <div className="footer-brand-identity">
              <img src="/assets/images/logo.svg" alt="NineScrolls LLC" className="footer-logo" />
              <div>
                <h3 className="footer-company-name">NineScrolls LLC</h3>
                <p className="footer-tagline">Advanced Plasma Processing &amp; Thin Film Deposition Systems</p>
              </div>
            </div>
          </div>

          <div className="footer-divider" />

          {/* 4-Column Layout */}
          <div className="footer-content footer-4col">

            {/* Column 1 – Contact & Location */}
            <div className="footer-section footer-contact-col">
              <h4>Contact</h4>

              <div className="footer-contact-block">
                <span className="footer-contact-label">General Inquiries</span>
                <a href="mailto:info@ninescrolls.com" className="footer-email">info@ninescrolls.com</a>
              </div>

              <div className="footer-contact-block">
                <span className="footer-contact-label">Sales &amp; Quotations</span>
                <a href="mailto:sales@ninescrolls.com" className="footer-email">sales@ninescrolls.com</a>
              </div>

              <div className="footer-contact-block">
                <span className="footer-contact-label">Technical Support</span>
                <a href="mailto:support@ninescrolls.com" className="footer-email">support@ninescrolls.com</a>
              </div>

              <div className="footer-divider-thin" />

              <div className="footer-contact-block">
                <span className="footer-contact-label">San Diego Office</span>
                <a href="tel:+18588798898" className="footer-phone">+1 (858) 879-8898</a>
              </div>

              <div className="footer-contact-block footer-emergency">
                <span className="footer-contact-label">Emergency Service</span>
                <span className="footer-contact-detail">24/7 response for installed systems</span>
                <span className="footer-contact-note">(Existing customers only)</span>
              </div>
            </div>

            {/* Column 2 – Equipment Platforms */}
            <div className="footer-section">
              <h4>Equipment Platforms</h4>
              <div className="footer-nav-links">
                <Link to="/products/icp-etcher">Plasma Etching Systems</Link>
                <Link to="/products/ald">ALD Systems</Link>
                <Link to="/products/pecvd">PECVD Systems</Link>
                <Link to="/products/hdp-cvd">HDP-CVD Systems</Link>
                <Link to="/products/coater-developer">Sputtering &amp; Coating Systems</Link>
                <Link to="/products">All Equipment →</Link>
              </div>
            </div>

            {/* Column 3 – Company */}
            <div className="footer-section">
              <h4>Company</h4>
              <div className="footer-nav-links">
                <Link to="/about">About NineScrolls</Link>
                <Link to="/about#manufacturer">Manufacturer Network</Link>
                <Link to="/insights">Technical Insights</Link>
                <Link to="/service-support">Service &amp; Support</Link>
                <Link to="/startup-package">Startup Lab Package</Link>
                <Link to="/contact">Contact Us</Link>
              </div>
            </div>

            {/* Column 4 – Trust & Credentials */}
            <div className="footer-section footer-trust-col">
              <h4>Trust &amp; Credentials</h4>

              <div className="footer-trust-block">
                <span className="footer-trust-label">Manufacturer Partner</span>
                <a href="http://en.beijingtailong.com/" target="_blank" rel="noopener noreferrer" className="footer-trust-partner">
                  Tyloong Semiconductor Equipment
                </a>
                <span className="footer-trust-detail">30+ years in plasma processing</span>
                <span className="footer-trust-detail">Continuous platform R&D investment</span>
              </div>

              <div className="footer-divider-thin" />

              <div className="footer-trust-block">
                <span className="footer-trust-label">U.S.-Based Operations</span>
                <span className="footer-trust-location">San Diego, California</span>
                <span className="footer-trust-detail">Direct technical support team</span>
              </div>

              <div className="footer-divider-thin" />

              <div className="footer-trust-block">
                <span className="footer-trust-label">D-U-N-S®</span>
                <span className="footer-trust-detail">13-477-6662</span>
              </div>
            </div>
          </div>

          {/* Positioning Statement */}
          <div className="footer-positioning">
            <p>Serving U.S. universities, research institutions, and advanced semiconductor laboratories.</p>
          </div>

          <div className="footer-divider" />

          {/* Footer Bottom */}
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} NineScrolls LLC. All rights reserved.</p>

            <div className="footer-bottom-center">
              <div className="social-links">
                <a href="https://linkedin.com/company/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="https://twitter.com/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="https://www.youtube.com/@NineScrollsLLC" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
            </div>

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
