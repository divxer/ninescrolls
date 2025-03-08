import { useState } from 'react';
import { ContactFormData } from '../types';

export function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Implement form submission logic
    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <section className="contact-hero">
        <div className="container">
          <div className="contact-header">
            <h1>Contact Us</h1>
            <p className="subtitle">Get in touch with our team of experts</p>
          </div>
        </div>
      </section>

      <section className="contact-content">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <div className="info-card">
                <h3>Sales Inquiries</h3>
                <p>For product information and quotes:</p>
                <ul>
                  <li>Email: sales@ninescrolls.com</li>
                  <li>Phone: +1 (555) 123-4567</li>
                </ul>
              </div>

              <div className="info-card">
                <h3>Technical Support</h3>
                <p>For technical assistance and service:</p>
                <ul>
                  <li>Email: support@ninescrolls.com</li>
                  <li>Phone: +1 (555) 123-4568</li>
                </ul>
              </div>

              <div className="info-card">
                <h3>Headquarters</h3>
                <p>NineScrolls LLC</p>
                <address>
                  123 Technology Drive<br />
                  Suite 100<br />
                  Silicon Valley, CA 94025<br />
                  United States
                </address>
              </div>

              <div className="info-card">
                <h3>Business Hours</h3>
                <p>Monday - Friday</p>
                <p>9:00 AM - 6:00 PM (PST)</p>
              </div>
            </div>

            <div className="contact-form">
              {!isSuccess ? (
                <>
                  <h2>Send Us a Message</h2>
                  <form onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label htmlFor="name">Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="organization">Organization</label>
                      <input
                        type="text"
                        id="organization"
                        name="organization"
                        value={formData.organization}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="message">Message *</label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={handleInputChange}
                      ></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="success-message">
                  <span className="success-icon">✓</span>
                  <h3>Thank You!</h3>
                  <p>Your message has been sent successfully. We'll get back to you within 1 business day.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="global-presence">
        <div className="container">
          <h2>Global Presence</h2>
          <div className="presence-grid">
            <div className="presence-card">
              <h3>North America</h3>
              <p>Sales and Service Center</p>
              <p>Silicon Valley, CA</p>
            </div>
            <div className="presence-card">
              <h3>Asia Pacific</h3>
              <p>Regional Office</p>
              <p>Singapore</p>
            </div>
            <div className="presence-card">
              <h3>Europe</h3>
              <p>Technical Support Center</p>
              <p>Munich, Germany</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 