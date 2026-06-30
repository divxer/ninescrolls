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
    return (
      <Suspense fallback={null}>
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
