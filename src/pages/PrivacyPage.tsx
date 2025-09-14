import { SEO } from '../components/common/SEO';

export function PrivacyPage() {
  return (
    <>
      <SEO title="Privacy Policy - NineScrolls" description="NineScrolls Privacy Policy" url="/privacy" />
      <section className="about-hero">
        <div className="container">
          <h1>Privacy Policy</h1>
          <p>Last updated: September 14, 2025</p>
        </div>
      </section>
      <section className="story">
        <div className="story-content">
          <h2>Introduction</h2>
          <p>Your privacy matters to us. This Privacy Policy explains what information we collect, how we use it, and the choices available to you. By using our website or submitting information, you agree to the practices described here.</p>

          <h2>Information We Collect</h2>
          <ul>
            <li>Contact details you provide (e.g., name, email address, organization, job title) when you submit forms.</li>
            <li>Usage information collected through standard analytics tools (e.g., page views, traffic sources, browser/device type).</li>
            <li>Communication preferences if you opt in to receive updates about our products or services.</li>
          </ul>

          <h2>How We Use Information</h2>
          <ul>
            <li>Respond to your inquiries and provide requested materials (e.g., equipment guides).</li>
            <li>Improve our website, products, and services.</li>
            <li>With your consent, send occasional updates about products, events, and insights (1–2 emails per month). You may unsubscribe at any time using the link provided in each email.</li>
          </ul>

          <h2>Data Sharing</h2>
          <p>We do not sell your personal data. We may share limited information with trusted service providers (e.g., cloud hosting, analytics platforms, email delivery services) who assist us in operating our business. These providers are contractually bound to use your data only for the services we request.</p>

          <h2>Retention & Security</h2>
          <p>We retain personal data only as long as necessary for the purposes described above, unless a longer retention period is required by law. We implement reasonable administrative, technical, and physical safeguards to protect personal information against unauthorized access, use, or disclosure.</p>

          <h2>Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Request access to the personal data we hold about you.</li>
            <li>Ask for corrections or updates to your data.</li>
            <li>Request deletion of your data.</li>
            <li>Withdraw consent to marketing communications at any time.</li>
          </ul>
          <p>To exercise these rights, contact us at <a href="mailto:privacy@ninescrolls.com">privacy@ninescrolls.com</a>.</p>

          <h2>Cookies & Tracking</h2>
          <p>Our website may use cookies or similar technologies to improve user experience and analyze site usage. You can control cookies through your browser settings.</p>

          <h2>Contact Us</h2>
          <p>If you have questions about this Privacy Policy or our data practices, please contact us: <a href="mailto:privacy@ninescrolls.com">privacy@ninescrolls.com</a></p>
        </div>
      </section>
    </>
  );
}

export default PrivacyPage;
