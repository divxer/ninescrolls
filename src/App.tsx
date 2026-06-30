import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout/Layout';
import { AppRoutes } from './routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
import { PageTimeTracker } from './components/analytics/PageTimeTracker';
import { HubSpotPageViewSync } from './components/analytics/HubSpotPageViewSync';
import { RedirectHandler } from './components/common/RedirectHandler';
import { CartProvider } from './contexts/CartContext';

// Admin routes load lazily (only under /admin) so the public bundle never ships
// the admin auth UI (@aws-amplify/ui-react Authenticator + its CSS theme).
const AdminRoutes = lazy(() => import('./routes/AdminRoutes'));

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  if (isAdmin) {
    // Fallback shown while the AdminRoutes chunk downloads (the chunk's own
    // PageLoader isn't available until then). Mirrors the route-level loader.
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-surface-container-lowest">
            <div className="text-center py-16 px-5 text-lg text-on-surface-variant">Loading...</div>
          </div>
        }
      >
        <AdminRoutes />
      </Suspense>
    );
  }

  return (
    <CartProvider>
      <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
      <PageTimeTracker />
      <HubSpotPageViewSync />
      <RedirectHandler />
      <Layout>
        <AppRoutes />
      </Layout>
    </CartProvider>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Router>
        <AppShell />
      </Router>
    </HelmetProvider>
  );
}

export default App;
