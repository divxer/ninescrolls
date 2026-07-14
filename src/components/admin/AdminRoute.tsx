import { Authenticator } from '@aws-amplify/ui-react';
import { Helmet } from 'react-helmet-async';
import '@aws-amplify/ui-react/styles.css';
import { AdminLayout, AdminShell } from './AdminLayout';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';
import { isQuotationFixtureUrl } from '../../pages/admin/quotationFixtureGate';

export function AdminRoute() {
  const location = useLocation();
  const fixture = import.meta.env.DEV
    && isQuotationFixtureUrl(location.pathname, location.search, true);
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Helmet>
      {fixture ? (
        <ThemeProvider>
          <AdminShell loginId="visual-fixture@localhost" />
        </ThemeProvider>
      ) : <Authenticator hideSignUp>
        <ThemeProvider>
          <AdminLayout />
        </ThemeProvider>
      </Authenticator>}
    </>
  );
}
