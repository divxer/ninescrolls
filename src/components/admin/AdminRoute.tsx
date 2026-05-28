import { Authenticator } from '@aws-amplify/ui-react';
import { Helmet } from 'react-helmet-async';
import '@aws-amplify/ui-react/styles.css';
import { AdminLayout } from './AdminLayout';
import { ThemeProvider } from '../../contexts/ThemeContext';

export function AdminRoute() {
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Helmet>
      <Authenticator hideSignUp>
        <ThemeProvider>
          <AdminLayout />
        </ThemeProvider>
      </Authenticator>
    </>
  );
}
