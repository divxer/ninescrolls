import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: { email: true },
  // 'admin' group gates price-api (cost & supplier data are OEM-confidential).
  // Membership is managed via scripts/add-admin-user.ts — run against BOTH the
  // sandbox and prod pools before the price-book feature is usable.
  groups: ['admin'],
});
