import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import sgMail from '@sendgrid/mail';

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Access-Control-Max-Age': '300'
};

// Email configuration from environment variables
const config = {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'info@ninescrolls.com',
    toEmail: process.env.TO_EMAIL || 'sales@ninescrolls.com',
    replyTo: process.env.REPLY_TO_EMAIL || 'info@ninescrolls.com'
};

// Validate required environment variables
function validateConfig() {
    const requiredVars = ['SENDGRID_API_KEY', 'FROM_EMAIL', 'TO_EMAIL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

// Initialize SendGrid with API key
function initializeSendGrid() {
    if (!config.sendgridApiKey) {
        throw new Error('SendGrid API key is not configured');
    }
    sgMail.setApiKey(config.sendgridApiKey);
}

// Handle preflight requests
function handlePreflight(): APIGatewayProxyResultV2 {
    return {
        statusCode: 200,
        headers: corsHeaders
    };
}

// Send email to company
async function sendCompanyEmail(data: any) {
    const msg = {
        to: config.toEmail,
        from: config.fromEmail,
        replyTo: config.replyTo,
        subject: `New Product Inquiry: ${data.productName}`,
        text: `
Product Inquiry Details:
Product: ${data.productName}
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || 'Not provided'}
Organization: ${data.organization || 'Not provided'}

Message:
${data.message}
        `,
        html: `
<h2>New Product Inquiry</h2>
<h3>Product: ${data.productName}</h3>
<p><strong>Name:</strong> ${data.name}</p>
<p><strong>Email:</strong> ${data.email}</p>
<p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
<p><strong>Organization:</strong> ${data.organization || 'Not provided'}</p>
<h3>Message:</h3>
<p>${data.message.replace(/\n/g, '<br>')}</p>
        `
    };

    await sgMail.send(msg);
}

// Send confirmation email to customer
async function sendCustomerEmail(data: any) {
    const msg = {
        to: data.email,
        from: config.fromEmail,
        subject: `Thank you for your interest in ${data.productName}`,
        text: `
Dear ${data.name},

Thank you for your interest in our ${data.productName}. We have received your inquiry and will review it shortly.

What happens next:
1. Our sales team will review your request
2. We'll respond with detailed information within 1 business day

Best regards,
NineScrolls Sales Team
        `,
        html: `
<h2>Thank you for your interest in ${data.productName}</h2>
<p>Dear ${data.name},</p>
<p>Thank you for your interest in our ${data.productName}. We have received your inquiry and will review it shortly.</p>
<h3>What happens next:</h3>
<ol>
    <li>Our sales team will review your request</li>
    <li>We'll respond with detailed information within 1 business day</li>
</ol>
<p>Best regards,<br>NineScrolls Sales Team</p>
        `
    };

    await sgMail.send(msg);
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    console.log('Lambda function invoked with event:', JSON.stringify(event, null, 2));

    try {
        // Handle preflight requests
        if (event.requestContext.http.method === 'OPTIONS') {
            return handlePreflight();
        }

        // Validate environment configuration
        validateConfig();
        initializeSendGrid();

        // Extract and validate form data
        const body = event.body ? JSON.parse(event.body) : {};
        console.log('Received form data:', body);

        const requiredFields = ['name', 'email', 'message'];
        const missingFields = requiredFields.filter(field => !body[field]);

        if (missingFields.length > 0) {
            console.error('Missing required fields:', missingFields);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: `Missing required fields: ${missingFields.join(', ')}`
                })
            };
        }

        // Send emails
        await Promise.all([
            sendCompanyEmail(body),
            sendCustomerEmail(body)
        ]);

        console.log('Emails sent successfully');

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Emails sent successfully'
            })
        };

    } catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Internal server error'
            })
        };
    }
};