import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { AdminLayout } from './AdminLayout';
import { ThemeProvider } from '../../contexts/ThemeContext';

export function AdminRoute() {
  return (
    <Authenticator hideSignUp>
      <ThemeProvider>
        <AdminLayout />
      </ThemeProvider>
    </Authenticator>
  );
}
