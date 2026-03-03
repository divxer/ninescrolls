import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import '../../styles/Admin.css';

export function AdminLayout() {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path ? 'admin-nav-link active' : 'admin-nav-link';

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-left">
          <Link to="/admin/insights" className="admin-logo">
            NineScrolls Admin
          </Link>
        </div>
        <button
          className="admin-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
        <nav className={`admin-nav ${menuOpen ? 'admin-nav-open' : ''}`}>
          <Link to="/admin/insights" className={isActive('/admin/insights')} onClick={() => setMenuOpen(false)}>
            Articles
          </Link>
          <Link to="/admin/insights/new" className={isActive('/admin/insights/new')} onClick={() => setMenuOpen(false)}>
            New Article
          </Link>
          <Link to="/admin/analytics" className={isActive('/admin/analytics')} onClick={() => setMenuOpen(false)}>
            Analytics
          </Link>
        </nav>
        <div className={`admin-header-right ${menuOpen ? 'admin-nav-open' : ''}`}>
          <span className="admin-user-email">{user?.signInDetails?.loginId}</span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="admin-view-site">
            View Site
          </a>
          <button onClick={signOut} className="admin-logout-btn">
            Sign Out
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
