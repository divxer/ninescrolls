import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout/Layout';
import { AppRoutes } from './routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
import { SegmentAnalytics } from './components/analytics/SegmentAnalytics';
import { HubSpotPageViewSync } from './components/analytics/HubSpotPageViewSync';
import { RedirectHandler } from './components/common/RedirectHandler';
import { CartProvider } from './contexts/CartContext';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <CartProvider>
          <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
          <SegmentAnalytics writeKey={import.meta.env.VITE_SEGMENT_WRITE_KEY} />
          <HubSpotPageViewSync />
          <RedirectHandler />
          <Layout>
            <AppRoutes />
          </Layout>
        </CartProvider>
      </Router>
    </HelmetProvider>
  );
}

export default App;
