import { SEO } from '../components/common/SEO';

export function PrivacyPage() {
  return (
    <>
      <SEO title="Privacy Policy" description="NineScrolls Privacy Policy" url="/privacy" />
      <div className="bg-[#FAFAFA]">
        <section className="border-b border-slate-200 bg-white px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Policy</span>
            <h1 className="mt-5 text-5xl font-headline font-bold tracking-tight text-slate-950">Privacy Policy</h1>
            <p className="mt-5 text-lg text-slate-600">Legal and privacy information</p>
            <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: September 14, 2025</p>
          </div>
        </section>

        <section className="px-6 py-12 lg:px-10">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 md:p-10">
            <div className="space-y-12 text-slate-600 leading-relaxed">
              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Introduction</h2>
                <p>Your privacy matters to us. This Privacy Policy explains what information we collect, how we use it, and the choices available to you. By using our website or submitting information, you agree to the practices described here.</p>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Information We Collect</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Contact details you provide (e.g., name, email address, organization, job title) when you submit forms.</li>
                  <li>Usage information collected through standard analytics tools (e.g., page views, traffic sources, browser/device type).</li>
                  <li>Communication preferences if you opt in to receive updates about our products or services.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">How We Use Information</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Respond to your inquiries and provide requested materials (e.g., equipment guides).</li>
                  <li>Improve our website, products, and services.</li>
                  <li>With your consent, send occasional updates about products, events, and insights (1-2 emails per month). You may unsubscribe at any time using the link provided in each email.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Data Sharing</h2>
                <p>We do not sell your personal data. We may share limited information with trusted service providers (e.g., cloud hosting, analytics platforms, email delivery services) who assist us in operating our business. These providers are contractually bound to use your data only for the services we request.</p>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Retention &amp; Security</h2>
                <p>We retain personal data only as long as necessary for the purposes described above, unless a longer retention period is required by law. We implement reasonable administrative, technical, and physical safeguards to protect personal information against unauthorized access, use, or disclosure.</p>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Your Rights</h2>
                <p className="mb-4">Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Request access to the personal data we hold about you.</li>
                  <li>Ask for corrections or updates to your data.</li>
                  <li>Request deletion of your data.</li>
                  <li>Withdraw consent to marketing communications at any time.</li>
                </ul>
                <p className="mt-4">To exercise these rights, contact us at <a href="mailto:privacy@ninescrolls.com" className="font-bold text-sky-700 hover:underline">privacy@ninescrolls.com</a>.</p>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Cookies &amp; Tracking</h2>
                <p>Our website may use cookies or similar technologies to improve user experience and analyze site usage. You can control cookies through your browser settings.</p>
              </section>

              <section>
                <h2 className="text-2xl font-headline font-bold text-slate-950 mb-4">Contact Us</h2>
                <p>If you have questions about this Privacy Policy or our data practices, please contact us: <a href="mailto:privacy@ninescrolls.com" className="font-bold text-sky-700 hover:underline">privacy@ninescrolls.com</a></p>
              </section>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default PrivacyPage;
