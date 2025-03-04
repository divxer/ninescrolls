import { defineFrontend } from '@aws-amplify/backend';

export const frontend = defineFrontend({
    environment: {
        VITE_API_URL: process.env.API_URL || '',
        VITE_FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@ninescrolls.com',
        VITE_TO_EMAIL: process.env.TO_EMAIL || 'info@ninescrolls.com',
        VITE_REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL || 'info@ninescrolls.com'
    }
}); 