import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Chat } from '../common/Chat';
import { CookieBanner } from '../common/CookieBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Close menu when location changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest('.nav-container')) {
        setIsMenuOpen(false);
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
            <li><Link to="/products" className={`nav-link ${location.pathname === '/products' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>Products</Link></li>
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