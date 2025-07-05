import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout/Layout';
import { AppRoutes } from './routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </HelmetProvider>
  );
}

export default App;
