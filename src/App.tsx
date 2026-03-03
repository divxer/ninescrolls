import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout/Layout';
import { AppRoutes, AdminRoutes } from './routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
import { SegmentAnalytics } from './components/analytics/SegmentAnalytics';
import { HubSpotPageViewSync } from './components/analytics/HubSpotPageViewSync';
import { RedirectHandler } from './components/common/RedirectHandler';
import { CartProvider } from './contexts/CartContext';

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  if (isAdmin) {
    return <AdminRoutes />;
  }

  return (
    <CartProvider>
      <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
      <SegmentAnalytics writeKey={import.meta.env.VITE_SEGMENT_WRITE_KEY} />
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
