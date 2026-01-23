import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import * as sgMail from '@sendgrid/mail';
import { env } from '$amplify/env/stripe-webhook';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' });

  // Get raw body for signature verification
  // API Gateway v2 may base64 encode the body
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8');

  // Get Stripe signature from headers
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  if (!sig) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing stripe-signature header' }),
    };
  }

  let stripeEvent: Stripe.Event;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Webhook signature verification failed',
        message: err.message 
      }),
    };
  }

  // Handle different event types
  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', {
        sessionId: session.id,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      });

      // Retrieve full session details including line items
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'line_items.data.price.product'],
      });

      // Send order confirmation email
      await sendOrderConfirmationEmail(fullSession);
      
      // TODO: Additional business logic:
      // 2. Update order status in database
      // 3. Trigger fulfillment process
      // 4. Send notification to sales team

    } else if (stripeEvent.type === 'payment_intent.succeeded') {
      const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } else {
      console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error processing webhook', message: err.message }),
    };
  }
};

/**
 * Send professional order confirmation email
 */
async function sendOrderConfirmationEmail(session: Stripe.Checkout.Session) {
  try {
    // Initialize SendGrid
    if (!env.SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY is not configured');
      return;
    }
    sgMail.setApiKey(env.SENDGRID_API_KEY);

    // Extract order information
    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      console.error('Customer email not found in session');
      return;
    }
    
    const customerName = session.customer_details?.name || 
                         (session.customer_details?.first_name 
                           ? `${session.customer_details.first_name} ${(session.customer_details as any).last_name || ''}`.trim()
                           : '') ||
                         'Valued Customer';
    
    // Generate order number from session ID (use last 12 characters)
    const orderNumber = `ORDER-${session.id.replace('cs_', '').substring(0, 12)}`;
    
    // Format amount
    const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00';
    const currency = session.currency?.toUpperCase() || 'USD';
    
    // Extract line items
    const lineItems = (session.line_items?.data || []).map((item: any) => {
      const productName = item.description || item.price?.product?.name || 'Product';
      const quantity = item.quantity || 1;
      const unitPrice = item.price?.unit_amount ? (item.price.unit_amount / 100).toFixed(2) : '0.00';
      return { productName, quantity, unitPrice };
    });

    // Format shipping address
    // Note: shipping_details might be in session.shipping or session.shipping_details
    const shippingDetails = (session as any).shipping_details || (session as any).shipping;
    const shippingAddress = shippingDetails?.address;
    const shippingAddressText = shippingAddress
      ? `${shippingAddress.line1 || ''}\n${shippingAddress.line2 || ''}\n${shippingAddress.city || ''}, ${shippingAddress.state || ''} ${shippingAddress.postal_code || ''}\n${shippingAddress.country || ''}`
          .split('\n')
          .filter(line => line.trim())
          .join('\n')
      : 'To be confirmed';

    // Build order summary HTML
    const orderSummaryHtml = lineItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${item.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${item.unitPrice}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    // Professional email template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-top: 0; margin-bottom: 20px;">Order Confirmation</h1>
    
    <p style="margin-bottom: 20px;">Dear ${customerName},</p>
    
    <p style="margin-bottom: 20px;">Thank you for your order with NineScrolls LLC.</p>
    
    <p style="margin-bottom: 20px;">
      We have received your order for the ${lineItems[0]?.productName || 'product'} and your payment has been successfully processed.
      Our sales team will contact you within one business day to confirm specifications, shipping details, and provide tracking information.
    </p>
    
    <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 4px;">
      <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Order Summary</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Order Number:</td>
          <td style="padding: 8px 0; text-align: right;">${orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Product:</td>
          <td style="padding: 8px 0; text-align: right;">${lineItems[0]?.productName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Quantity:</td>
          <td style="padding: 8px 0; text-align: right;">${lineItems[0]?.quantity || 1}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Unit Price:</td>
          <td style="padding: 8px 0; text-align: right;">$${lineItems[0]?.unitPrice || '0.00'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Subtotal:</td>
          <td style="padding: 8px 0; text-align: right;">$${amountTotal}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Shipping:</td>
          <td style="padding: 8px 0; text-align: right;">Free</td>
        </tr>
        <tr style="border-top: 2px solid #2563eb; margin-top: 10px;">
          <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">Total:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 16px;">$${amountTotal} ${currency}</td>
        </tr>
      </table>
      
      <div style="margin-top: 25px;">
        <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 0; margin-bottom: 10px;">Shipping Address</h3>
        <p style="margin: 0; white-space: pre-line; color: #666;">${shippingAddressText}</p>
      </div>
      
      <div style="margin-top: 20px;">
        <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 0; margin-bottom: 10px;">Notes</h3>
        <p style="margin: 0; color: #666;">${session.metadata?.notes || 'None'}</p>
      </div>
    </div>
    
    <p style="margin-bottom: 20px;">
      If you have any immediate questions, please contact us at:
    </p>
    
    <ul style="margin-bottom: 20px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">📧 <a href="mailto:sales@ninescrolls.com" style="color: #2563eb; text-decoration: none;">sales@ninescrolls.com</a></li>
      <li style="margin-bottom: 8px;">📞 <a href="tel:+18585377743" style="color: #2563eb; text-decoration: none;">+1 (858) 537-7743</a></li>
      <li style="margin-bottom: 8px;">🌐 <a href="https://www.ninescrolls.com" style="color: #2563eb; text-decoration: none;">www.ninescrolls.com</a></li>
    </ul>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <p style="margin-bottom: 10px; color: #666; font-size: 14px;">
        <strong>NineScrolls LLC</strong> is a U.S.-based scientific equipment supplier specializing in plasma processing systems for research laboratories and pilot-scale manufacturing.
      </p>
      <p style="margin-bottom: 10px; color: #666; font-size: 14px;">
        For your security, all online payments are processed through Stripe.
      </p>
      <p style="margin-bottom: 0; color: #666; font-size: 12px;">
        <a href="https://www.ninescrolls.com/return-policy" style="color: #2563eb; text-decoration: none;">Return Policy</a> | 
        <a href="https://www.ninescrolls.com/service-support" style="color: #2563eb; text-decoration: none;">Warranty & Service</a>
      </p>
    </div>
    
    <p style="margin-top: 30px; margin-bottom: 0;">
      Best regards,<br>
      <strong>The NineScrolls Sales Team</strong>
    </p>
  </div>
</body>
</html>
    `;

    // Send email to customer
    // Ensure customerEmail is not null/undefined (already checked above)
    const email = {
      to: customerEmail as string, // Type assertion since we checked above
      from: 'noreply@ninescrolls.com',
      replyTo: 'sales@ninescrolls.com',
      subject: `Order Confirmation – ${lineItems[0]?.productName || 'Product'} (${orderNumber})`,
      html: emailHtml,
    };

    await sgMail.send(email);
    console.log('Order confirmation email sent successfully to:', customerEmail);

    // Also send notification to sales team
    const salesTeamEmail = {
      to: 'info@ninescrolls.com',
      from: 'noreply@ninescrolls.com',
      replyTo: customerEmail || 'noreply@ninescrolls.com',
      subject: `New Order: ${orderNumber} - ${lineItems[0]?.productName || 'Product'}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>
        <p><strong>Product:</strong> ${lineItems[0]?.productName || 'N/A'}</p>
        <p><strong>Quantity:</strong> ${lineItems[0]?.quantity || 1}</p>
        <p><strong>Total:</strong> $${amountTotal} ${currency}</p>
        <p><strong>Stripe Session ID:</strong> ${session.id}</p>
        <p><strong>Shipping Address:</strong></p>
        <pre style="white-space: pre-line;">${shippingAddressText}</pre>
        <p><a href="https://dashboard.stripe.com/payments/${session.payment_intent}">View in Stripe Dashboard</a></p>
      `,
    };

    await sgMail.send(salesTeamEmail);
    console.log('Sales team notification email sent successfully');

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    // Don't throw - we don't want to fail the webhook if email fails
  }
}
