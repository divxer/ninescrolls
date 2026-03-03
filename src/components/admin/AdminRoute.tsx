import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { AdminLayout } from './AdminLayout';

export function AdminRoute() {
  return (
    <Authenticator hideSignUp>
      <AdminLayout />
    </Authenticator>
  );
}
