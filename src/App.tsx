import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout/Layout';
import { AppRoutes } from './routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
import { SegmentAnalytics } from './components/analytics/SegmentAnalytics';
import { RedirectHandler } from './components/common/RedirectHandler';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
        <SegmentAnalytics writeKey={import.meta.env.VITE_SEGMENT_WRITE_KEY} />
        <RedirectHandler />
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </HelmetProvider>
  );
}

export default App;
