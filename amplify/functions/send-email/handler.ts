import * as sgMail from '@sendgrid/mail';
import type { Handler } from 'aws-lambda';

type SendEmailEvent = {
  arguments: {
    productName: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    message: string;
  };
};

export const handler: Handler<SendEmailEvent> = async (event) => {
  try {
    const { productName, name, email, phone, organization, message } = event.arguments;

    // Initialize SendGrid with API key from secret
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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

    // Send both emails
    await Promise.all([
      sgMail.send(companyEmail),
      sgMail.send(customerEmail)
    ]);

    return {
      message: "Emails sent successfully"
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to send emails');
  }
}; 