import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useTheme } from '../../contexts/useTheme';
import '../../styles/admin-tailwind.css';
import '../../styles/Admin.css';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/orders', label: 'Orders', icon: 'shopping_cart' },
  { path: '/admin/rfqs', label: 'RFQs', icon: 'request_quote' },
  { path: '/admin/leads', label: 'Leads', icon: 'contact_mail' },
  { path: '/admin/insights', label: 'Insights', icon: 'insights' },
  { path: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
];

export function AdminLayout() {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { effectiveTheme, toggleTheme, preference } = useTheme();

  // Apply data-theme to .admin-root after mount
  useEffect(() => {
    const root = document.querySelector('.admin-root');
    if (root) root.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="admin-root">
      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'admin-sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="mb-10 px-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
          </div>
          <div>
            <h1 className="font-headline text-lg font-bold tracking-tighter text-primary">NineScrolls LLC</h1>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Precision Editorial</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {NAV_ITEMS.map(({ path, label, icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-4 px-4 py-3 font-body text-sm tracking-tight font-medium transition-colors relative no-underline ${
                  active
                    ? 'text-on-surface font-bold bg-surface-variant rounded-none before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-secondary before:rounded-r-full'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg'
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 28, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 28" }}
                >{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto space-y-1 border-t border-outline-variant/10 pt-6">
          {/* New Report CTA */}
          <Link
            to="/admin/orders/new"
            className="w-full mb-6 bg-primary text-on-primary font-headline py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container transition-all shadow-md text-sm font-semibold no-underline"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Order
          </Link>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors font-body text-sm tracking-tight font-medium no-underline"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 28" }}>open_in_new</span>
            <span>View Site</span>
          </a>
          <div className="px-4 py-1.5 text-[10px] text-on-surface-variant/60 truncate">
            {user?.signInDetails?.loginId}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors font-body text-sm tracking-tight font-medium w-full border-none bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 28" }}>logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Top Header ── */}
      <header className="admin-header-bar">
        <div className="flex items-center gap-6">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 hover:bg-surface-container-low rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-headline font-black text-xl tracking-tight text-on-surface hidden lg:block">
            NineScrolls Ledger
          </span>
          {/* Search bar */}
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              className="bg-surface-container-low border-none rounded-full py-1.5 pl-9 pr-4 text-sm w-64 focus:ring-1 focus:ring-secondary/20 placeholder:text-on-surface-variant/50 transition-all"
              placeholder="Search..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="border-none bg-transparent hover:bg-surface-container-low rounded-full p-2 transition-all cursor-pointer" aria-label="Notifications">
            <span className="material-symbols-outlined text-[#44474e]" style={{ fontSize: 28, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 28' }}>notifications</span>
          </button>
          <button
            className="border-none bg-transparent hover:bg-surface-container-low rounded-full p-2 transition-all cursor-pointer relative"
            aria-label={`Toggle dark mode (${preference})`}
            title={preference === 'auto' ? `Auto (${effectiveTheme})` : effectiveTheme}
            onClick={toggleTheme}
          >
            <span className="material-symbols-outlined text-[#44474e]" style={{ fontSize: 28, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 28' }}>
              {effectiveTheme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            {preference === 'auto' && (
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-secondary rounded-full border border-surface" />
            )}
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container text-sm font-bold">
            {(user?.signInDetails?.loginId || 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="bg-surface">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
