import { defineBackend } from '@aws-amplify/backend';
import { sendEmail } from './functions/send-email/resource';

export const backend = defineBackend({
  sendEmail
});
