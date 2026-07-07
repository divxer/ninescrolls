import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Chat } from '../common/Chat';
import { CookieBanner } from '../common/CookieBanner';
import { CartIcon } from '../common/CartIcon';
import { cdnUrl } from '../../config/imageConfig';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());
  const hoverTimerRef = useRef<number | null>(null);

  const toggleAccordion = (category: string) => {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Analytics helper
  const trackProductMenuClick = (label: string, category: string) => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as {
        gtag?: (...args: unknown[]) => void;
        _hsq?: unknown[];
      };
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
    setOpenAccordions(new Set());
  }, [location]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest('nav')) {
        setIsMenuOpen(false);
      }
      if (isProductsOpen && !target.closest('.products-dropdown-wrapper')) {
        setIsProductsOpen(false);
      }
    };

    if (isMenuOpen || isProductsOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen, isProductsOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const navLinks = [
    { to: '/products', label: 'Products', hasDropdown: true },
    { to: '/#applications', label: 'Applications' },
    { to: '/#processes', label: 'Processes' },
    { to: '/#resources', label: 'Resources' },
    { to: '/service-support', label: 'Support' },
    { to: '/about', label: 'About' },
  ];

  const productCategories = [
    {
      key: 'etching',
      label: 'Etching',
      items: [
        { to: '/products/icp-etcher', label: 'ICP‑RIE', desc: 'High-density plasma etching' },
        { to: '/products/rie-etcher', label: 'RIE', desc: 'Reactive ion etching' },
        { to: '/products/compact-rie', label: 'Compact RIE', desc: 'Compact benchtop etcher' },
        { to: '/products/rie-etcher#drie', label: 'DRIE (Bosch)', desc: 'Deep silicon etching' },
      ]
    },
    {
      key: 'deposition',
      label: 'Deposition',
      items: [
        { to: '/products/pecvd', label: 'PECVD', desc: 'Plasma-enhanced thin films' },
        { to: '/products/ald', label: 'ALD', desc: 'Atomic layer deposition' },
        { to: '/products/hdp-cvd', label: 'HDP‑CVD', desc: 'High-density plasma CVD' },
        { to: '/products/e-beam-evaporator', label: 'E-Beam Evaporator', desc: 'Electron-beam evaporation' },
      ]
    },
    {
      key: 'coating',
      label: 'Coating / Developing',
      items: [
        { to: '/products/coater-developer', label: 'Coater / Developer', desc: 'Photoresist coat & develop' },
      ]
    },
    {
      key: 'cleaning',
      label: 'Cleaning / Stripping',
      items: [
        { to: '/products/striper', label: 'Stripping System', desc: 'Photoresist stripping' },
        { to: '/products/plasma-cleaner', label: 'Plasma Cleaners', desc: 'Surface clean & activation' },
      ]
    },
  ];

  // Plasma-cleaner model variants live in the footer (sitewide internal links
  // for long-tail SEO) rather than the mega menu; the /products/plasma-cleaner
  // overview page carries the full model cards and detail links.
  const plasmaCleanerModels = [
    { to: '/products/hy-4l', label: 'HY-4L' },
    { to: '/products/hy-20l', label: 'HY-20L' },
    { to: '/products/hy-20lrf', label: 'HY-20LRF' },
    { to: '/products/pluto-t', label: 'PLUTO-T' },
    { to: '/products/pluto-m', label: 'PLUTO-M' },
    { to: '/products/pluto-f', label: 'PLUTO-F' },
  ];

  // Solutions / Resources column — routes buyers by intent, not just by product.
  const productResources = [
    {
      key: 'explore',
      label: 'Explore',
      items: [
        { to: '/#applications', label: 'By Application' },
        { to: '/#processes', label: 'By Process' },
        { to: '/#research', label: 'Research & Citations' },
      ],
    },
    {
      key: 'resources',
      label: 'Resources',
      items: [
        { to: '/insights', label: 'Knowledge Center' },
        { to: '/startup-package', label: 'Startup Package' },
        { to: '/service-support', label: 'Service & Support' },
      ],
    },
  ];

  // Desktop mega-menu column layout: stack the short single-item Coating
  // category with Deposition so no column is left mostly empty. Order follows
  // productCategories (etching, deposition, coating, cleaning).
  const [etchingCat, depositionCat, coatingCat, cleaningCat] = productCategories;
  const productColumns = [
    [etchingCat],
    [depositionCat, coatingCat],
    [cleaningCat],
  ];

  return (
    <>
      <Chat />
      <CookieBanner />

      {/* ── Header ── */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={cdnUrl('/assets/images/logo.svg')} alt="NineScrolls LLC" className="h-8 w-auto" />
            <span className="text-2xl font-bold tracking-tighter text-slate-900 font-headline uppercase">NineScrolls</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex gap-8 font-headline tracking-tight text-sm font-medium">
            {navLinks.map(link => (
              link.hasDropdown ? (
                <div
                  key={link.to}
                  className="products-dropdown-wrapper relative"
                  onMouseEnter={openProducts}
                  onMouseLeave={scheduleProductsClose}
                >
                  <Link
                    to={link.to}
                    className={`text-slate-600 hover:text-primary transition-colors duration-200 flex items-center gap-1 ${location.pathname.startsWith('/products') ? 'text-primary' : ''}`}
                    onClick={() => trackProductMenuClick('All Products (label)', 'CTA')}
                  >
                    {link.label}
                    <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isProductsOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </Link>

                  {/* Desktop Dropdown */}
                  {isProductsOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-2xl border border-outline-variant/10 px-7 py-6 min-w-[820px]">
                      <div className="grid grid-cols-4 gap-x-6 gap-y-5">
                        {productColumns.map((column, colIndex) => (
                          <div key={colIndex} className="space-y-6">
                            {column.map(cat => (
                              <div key={cat.key}>
                                <h4 className="text-xs uppercase tracking-widest text-slate-900 font-bold mb-3">{cat.label}</h4>
                                <div className="space-y-2">
                                  {cat.items.map(item => (
                                    <div key={item.to}>
                                      <Link
                                        to={item.to}
                                        className="group block"
                                        onClick={() => { setIsProductsOpen(false); trackProductMenuClick(item.label, cat.label); }}
                                      >
                                        <span className="block text-sm text-slate-700 group-hover:text-primary transition-colors">{item.label}</span>
                                        {item.desc && <span className="block text-xs leading-snug text-slate-400">{item.desc}</span>}
                                      </Link>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* Solutions / Resources column */}
                        <div className="border-l border-slate-100 pl-6 space-y-5">
                          {productResources.map(group => (
                            <div key={group.key}>
                              <h4 className="text-xs uppercase tracking-widest text-slate-900 font-bold mb-3">{group.label}</h4>
                              <div className="space-y-2">
                                {group.items.map(item => (
                                  <Link
                                    key={item.to}
                                    to={item.to}
                                    className="block text-sm text-slate-600 hover:text-primary transition-colors"
                                    onClick={() => { setIsProductsOpen(false); trackProductMenuClick(item.label, group.label); }}
                                  >
                                    {item.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-5 pt-5 border-t border-outline-variant/20 flex gap-4">
                        <Link to="/products" className="flex-1 text-center py-2 text-sm font-bold bg-primary text-white rounded-sm hover:bg-primary-container transition-colors" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('All Products', 'CTA'); }}>All Products</Link>
                        <Link to="/request-quote" className="flex-1 text-center py-2 text-sm font-bold border border-outline-variant text-on-surface-variant rounded-sm hover:bg-on-surface hover:text-white transition-colors" onClick={() => { setIsProductsOpen(false); trackProductMenuClick('Request a Quote', 'CTA'); }}>Request a Quote</Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-slate-600 hover:text-primary transition-colors duration-200 ${location.pathname === link.to ? 'text-primary' : ''}`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <CartIcon />
            <Link to="/request-quote" className="hidden lg:inline-flex bg-primary hover:bg-primary-container text-on-primary px-5 py-2 rounded-sm text-sm font-medium transition-all active:opacity-80 active:scale-[0.99]">
              Request Quote
            </Link>
            {/* Mobile Hamburger */}
            <button
              className="lg:hidden flex flex-col gap-1.5 p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <span className={`w-6 h-0.5 bg-slate-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`w-6 h-0.5 bg-slate-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`w-6 h-0.5 bg-slate-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white border-t border-outline-variant/10 max-h-[calc(100vh-72px)] overflow-y-auto">
            <div className="px-8 py-6 space-y-1">
              {navLinks.map(link => (
                link.hasDropdown ? (
                  <div key={link.to}>
                    <button
                      className="w-full flex justify-between items-center py-3 text-sm font-headline font-medium text-slate-800"
                      onClick={() => toggleAccordion('products')}
                    >
                      Products
                      <span className={`material-symbols-outlined text-base transition-transform duration-200 ${openAccordions.has('products') ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                    {openAccordions.has('products') && (
                      <div className="pl-4 pb-3 space-y-1">
                        {productCategories.map(cat => (
                          <div key={cat.key}>
                            <button
                              className="w-full flex justify-between items-center py-2 text-xs font-bold uppercase tracking-widest text-slate-500"
                              onClick={() => toggleAccordion(cat.key)}
                            >
                              {cat.label}
                              <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${openAccordions.has(cat.key) ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>
                            {openAccordions.has(cat.key) && (
                              <div className="pl-4 space-y-1">
                                {cat.items.map(item => (
                                  <div key={item.to}>
                                    <Link
                                      to={item.to}
                                      className="group block py-1.5"
                                      onClick={() => { setIsMenuOpen(false); trackProductMenuClick(item.label, cat.label); }}
                                    >
                                      <span className="block text-sm text-slate-700 group-hover:text-primary">{item.label}</span>
                                      {item.desc && <span className="block text-xs leading-snug text-slate-400">{item.desc}</span>}
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {productResources.map(group => (
                          <div key={group.key}>
                            <p className="py-2 text-xs font-bold uppercase tracking-widest text-slate-500">{group.label}</p>
                            <div className="pl-4 space-y-1">
                              {group.items.map(item => (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  className="block py-1.5 text-sm text-slate-600 hover:text-primary"
                                  onClick={() => { setIsMenuOpen(false); trackProductMenuClick(item.label, group.label); }}
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}

                        <div className="pt-3 space-y-2">
                          <Link to="/products" className="block text-center py-2 text-sm font-bold bg-primary text-white rounded-sm" onClick={() => { setIsMenuOpen(false); trackProductMenuClick('All Products', 'CTA'); }}>All Products</Link>
                          <Link to="/request-quote" className="block text-center py-2 text-sm font-bold border border-outline-variant text-on-surface-variant rounded-sm" onClick={() => { setIsMenuOpen(false); trackProductMenuClick('Request a Quote', 'CTA'); }}>Request a Quote</Link>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block py-3 text-sm font-headline font-medium ${location.pathname === link.to ? 'text-primary' : 'text-slate-800'}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
              <div className="pt-4 border-t border-outline-variant/20">
                <Link to="/startup-package" className="block py-3 text-sm font-headline font-medium text-slate-800" onClick={() => setIsMenuOpen(false)}>Startup Package</Link>
                <Link to="/careers" className="block py-3 text-sm font-headline font-medium text-slate-800" onClick={() => setIsMenuOpen(false)}>Careers</Link>
                <Link to="/news" className="block py-3 text-sm font-headline font-medium text-slate-800" onClick={() => setIsMenuOpen(false)}>News</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-grow">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-slate-100 w-full pt-16 pb-8 border-t border-slate-200/20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 max-w-screen-2xl mx-auto">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <img src={cdnUrl('/assets/images/logo.svg')} alt="NineScrolls LLC" className="h-8 w-auto" />
              <span className="font-headline font-bold text-lg text-slate-900 uppercase tracking-tighter">NineScrolls</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Advanced Plasma Processing & Thin Film Deposition Systems for semiconductor engineering and research laboratories.
            </p>
            <div className="flex gap-3">
              <a href="https://linkedin.com/company/ninescrolls" className="text-slate-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="https://twitter.com/ninescrolls" className="text-slate-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@NineScrollsLLC" className="text-slate-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-slate-900 font-bold mb-8">Contact</h4>
            <ul className="text-xs leading-relaxed space-y-4 text-slate-500">
              <li>
                <span className="block text-slate-400 text-[10px] uppercase tracking-widest mb-1">General Inquiries</span>
                <a href="mailto:info@ninescrolls.com" className="hover:text-primary transition-colors">info@ninescrolls.com</a>
              </li>
              <li>
                <span className="block text-slate-400 text-[10px] uppercase tracking-widest mb-1">Sales & Quotations</span>
                <a href="mailto:sales@ninescrolls.com" className="hover:text-primary transition-colors">sales@ninescrolls.com</a>
              </li>
              <li>
                <span className="block text-slate-400 text-[10px] uppercase tracking-widest mb-1">San Diego Office</span>
                <a href="tel:+18588798898" className="hover:text-primary transition-colors">+1 (858) 879-8898</a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-slate-900 font-bold mb-8">Company</h4>
            <ul className="text-xs leading-relaxed space-y-4">
              <li><Link className="text-slate-500 hover:text-primary" to="/about">About Us</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/careers">Careers</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/news">News</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/insights">Insights</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/service-support">Service & Support</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/startup-package">Startup Package</Link></li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-slate-900 font-bold mb-8">Trust</h4>
            <ul className="text-xs leading-relaxed space-y-4">
              <li><Link className="text-slate-500 hover:text-primary" to="/service-support">Support</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/privacy">Privacy Policy</Link></li>
              <li><Link className="text-slate-500 hover:text-primary" to="/return-policy">Return Policy</Link></li>
              <li>
                <span className="block text-slate-400 text-[10px] uppercase tracking-widest mb-1">Manufacturer Partner</span>
                <a href="http://en.beijingtailong.com/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-primary">Tyloong Semiconductor</a>
              </li>
              <li>
                <span className="block text-slate-400 text-[10px] uppercase tracking-widest mb-1">D-U-N-S</span>
                <span className="text-slate-500">13-477-6662</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Plasma Cleaner models — sitewide internal links (long-tail SEO) */}
        <div className="max-w-screen-2xl mx-auto mt-12 px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-5">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold shrink-0">Plasma Cleaners</span>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {plasmaCleanerModels.map(model => (
                <li key={model.to}>
                  <Link to={model.to} className="text-xs text-slate-500 hover:text-primary transition-colors">{model.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="max-w-screen-2xl mx-auto mt-12 px-8 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs leading-relaxed text-slate-500 uppercase tracking-widest">&copy; {new Date().getFullYear()} NineScrolls LLC. All rights reserved.</p>
          <div className="flex items-center gap-2 text-slate-600">
            <span className="text-[10px] uppercase tracking-widest">Powered by Precision</span>
            <span className="w-1 h-1 bg-primary rounded-full"></span>
            <span className="text-[10px] uppercase tracking-widest">U.S. Operations</span>
          </div>
        </div>
      </footer>
    </>
  );
}
