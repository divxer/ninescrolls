interface Config {
    apiUrl: string;
    fromEmail: string;
    toEmail: string;
    replyToEmail: string;
}

const config: Config = {
    apiUrl: import.meta.env.VITE_API_URL || '',
    fromEmail: import.meta.env.VITE_FROM_EMAIL || 'noreply@ninescrolls.com',
    toEmail: import.meta.env.VITE_TO_EMAIL || 'info@ninescrolls.com',
    replyToEmail: import.meta.env.VITE_REPLY_TO_EMAIL || 'info@ninescrolls.com'
};

export default config; 