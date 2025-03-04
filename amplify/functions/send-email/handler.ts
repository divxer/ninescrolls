import * as sgMail from '@sendgrid/mail';
import type { Handler } from 'aws-lambda';

type SendEmailEvent = {
    httpMethod?: string;
    body?: string;
    productName?: string;
    name?: string;
    email?: string;
    phone?: string;
    organization?: string;
    message?: string;
};

const corsHeaders = {
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '300',
};

export const handler: Handler<SendEmailEvent> = async (event) => {
    console.log('Lambda function invoked with event:', JSON.stringify(event, null, 2));

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    try {
        // Parse the request body if it exists
        let formData = event;
        if (event.body) {
            try {
                formData = JSON.parse(event.body);
            } catch (error) {
                console.error('Failed to parse request body:', error);
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Invalid JSON in request body' })
                };
            }
        }

        const { productName, name, email, phone, organization, message } = formData;
        console.log('Extracted form data:', { productName, name, email, phone, organization, message });

        // Validate required fields
        if (!productName || !name || !email || !message) {
            console.log('Validation failed - missing required fields:', {
                hasProductName: !!productName,
                hasName: !!name,
                hasEmail: !!email,
                hasMessage: !!message
            });
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Initialize SendGrid with API key from secret
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            console.error('SendGrid API key is not configured');
            throw new Error('SENDGRID_API_KEY is not configured');
        }
        console.log('SendGrid API key configured');
        sgMail.setApiKey(apiKey);

        // Email to company
        const companyEmail = {
            to: 'info@ninescrolls.com',
            from: 'noreply@ninescrolls.com',
            subject: `New Product Inquiry: ${productName}`,
            html: `
                <h2>New Product Inquiry</h2>
                <p><strong>Product:</strong> ${productName}</p>
                <p><strong>Customer Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                <p><strong>Organization:</strong> ${organization || 'Not provided'}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `,
        };

        // Confirmation email to customer
        const customerEmail = {
            to: email,
            from: 'noreply@ninescrolls.com',
            subject: `Thank you for your interest in ${productName}`,
            html: `
                <h2>Thank you for contacting NineScrolls LLC</h2>
                <p>Dear ${name},</p>
                <p>We have received your inquiry about the ${productName}. Our team will review your request and get back to you within one business day.</p>
                <p>Here's a summary of your inquiry:</p>
                <ul>
                    <li><strong>Product:</strong> ${productName}</li>
                    <li><strong>Your Message:</strong> ${message}</li>
                </ul>
                <p>If you have any immediate questions, please don't hesitate to call us at +1 (858) 537-7743.</p>
                <br>
                <p>Best regards,</p>
                <p>The NineScrolls Team</p>
            `,
        };

        console.log('Attempting to send emails...');
        // Send both emails
        await Promise.all([
            sgMail.send(companyEmail).then(() => console.log('Company email sent successfully')),
            sgMail.send(customerEmail).then(() => console.log('Customer email sent successfully'))
        ]);

        console.log('All emails sent successfully');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Emails sent successfully" })
        };
    } catch (error) {
        console.error('Error in Lambda function:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to send emails' })
        };
    }
};