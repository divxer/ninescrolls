import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import '../../styles/Admin.css';

export function AdminLayout() {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();

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
        <nav className="admin-nav">
          <Link to="/admin/insights" className={isActive('/admin/insights')}>
            Articles
          </Link>
          <Link to="/admin/insights/new" className={isActive('/admin/insights/new')}>
            New Article
          </Link>
          <Link to="/admin/analytics" className={isActive('/admin/analytics')}>
            Analytics
          </Link>
        </nav>
        <div className="admin-header-right">
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
