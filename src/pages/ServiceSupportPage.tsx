import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const serviceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Equipment Service & Support",
  "provider": {
    "@type": "Organization",
    "name": "NineScrolls LLC",
    "url": "https://ninescrolls.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "San Diego",
      "addressRegion": "CA",
      "addressCountry": "US"
    }
  },
  "description": "Comprehensive warranty, preventive maintenance, and annual maintenance contract (AMC) service packages for plasma processing and thin film deposition equipment.",
  "areaServed": {
    "@type": "Country",
    "name": "United States"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "AMC Service Packages",
    "itemListElement": [
      {
        "@type": "Offer",
        "name": "Basic AMC",
        "description": "2 PM visits, priority support, 15% parts discount, remote diagnostics",
        "priceCurrency": "USD",
        "price": "12000",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "12000",
          "priceCurrency": "USD",
          "billingDuration": "P1Y"
        }
      },
      {
        "@type": "Offer",
        "name": "Premium AMC",
        "description": "4 PM visits, 48-hour on-site response, 25% parts discount, software updates, 24/7 voicemail for critical issues",
        "priceCurrency": "USD",
        "price": "25000",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "25000",
          "priceCurrency": "USD",
          "billingDuration": "P1Y"
        }
      },
      {
        "@type": "Offer",
        "name": "Custom AMC",
        "description": "Tailored service package with dedicated support team, flexible terms, and multi-site support"
      }
    ]
  }
};

const services = [
  { icon: 'verified_user', title: 'Standard Warranty', desc: '2-year coverage on parts and labor — double the industry norm.' },
  { icon: 'build', title: 'Preventive Maintenance', desc: 'One free PM visit included with every system purchase.' },
  { icon: 'description', title: 'Extended Options', desc: 'Optional annual service contracts billed yearly, not prepaid.' },
];

const processSteps = [
  { icon: 'search', title: 'Initial Assessment', desc: 'We review your equipment model, usage profile, and facility environment — typically completed within 1 business day via remote consultation.' },
  { icon: 'edit_note', title: 'Service Planning', desc: 'Our engineers recommend a warranty extension or AMC tier based on your equipment type, PM frequency needs, and uptime goals.' },
  { icon: 'settings', title: 'Implementation', desc: 'On-site or remote service begins per the agreed schedule. We handle parts, calibration, and software updates with minimal disruption to your workflow.' },
  { icon: 'sync', title: 'Ongoing Support', desc: 'Regular check-ins, proactive PM reminders, and priority access to our technical team. Annual reviews ensure your service plan evolves with your needs.' },
];

export function ServiceSupportPage() {
  useScrollToTop();

  return (
    <>
      <SEO
        title="Warranty & Service Support"
        description="NineScrolls provides 2-year standard warranty, preventive maintenance, and annual maintenance contract (AMC) packages for plasma processing and thin film deposition equipment. Currently serving the continental United States."
        keywords="warranty, service support, equipment maintenance, AMC, annual maintenance contract, preventive maintenance, technical support, semiconductor equipment service"
        url="/service-support"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(serviceStructuredData)}
        </script>
      </Helmet>

      <main>
        {/* Hero */}
        <section className="hero-gradient py-32 px-8 text-white">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-6xl font-headline font-bold mb-6">World-Class Support</h1>
            <p className="text-xl text-white/80 max-w-3xl leading-relaxed mb-4">Comprehensive service solutions designed to maximize your equipment performance and minimize downtime</p>
            <p className="text-sm text-white/60">Currently serving customers across the continental United States. Remote technical support available worldwide.</p>
          </div>
        </section>

        {/* Warranty Overview – card grid */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-headline font-bold mb-4">Standard Warranty Coverage</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-3xl">Every NineScrolls system includes a 2-year standard warranty — double the industry norm — with parts, labor, and technical support at no extra cost.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-1 px-1 bg-outline-variant/10 rounded-2xl overflow-hidden">
              {services.map(s => (
                <div key={s.title} className="bg-white p-12 hover:bg-surface-container-low transition-all">
                  <span className="material-symbols-outlined text-4xl text-primary mb-8 block">{s.icon}</span>
                  <h3 className="text-2xl font-headline font-bold mb-4">{s.title}</h3>
                  <p className="text-on-surface-variant">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Detailed warranty features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/10">
                <h4 className="text-lg font-headline font-bold mb-2">Standard Warranty Included</h4>
                <p className="text-on-surface-variant text-sm mb-4">(Most major manufacturers only provide 1-year coverage. NineScrolls includes 2 years standard warranty with equipment purchase. This is bundled with the sale, not a separately sold extended warranty product.)</p>
                <ul className="space-y-2">
                  {['Parts and labor coverage', 'Manufacturing defects', 'Component failures', 'Technical support included'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-on-surface"><span className="material-symbols-outlined text-primary text-base">check</span>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/10">
                <h4 className="text-lg font-headline font-bold mb-2">One free PM service included</h4>
                <ul className="space-y-2">
                  {['System optimization', 'Performance calibration', 'Preventive recommendations', 'Expert technician service'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-on-surface"><span className="material-symbols-outlined text-primary text-base">check</span>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/10">
                <h4 className="text-lg font-headline font-bold mb-2">Optional Service Contracts</h4>
                <ul className="space-y-2">
                  {['Optional service contracts (billed annually, not prepaid)', 'Annual Maintenance Contracts (AMC) - billed annually', 'Custom service agreements', 'Priority support access'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-on-surface"><span className="material-symbols-outlined text-primary text-base">check</span>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Competitive Comparison */}
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-headline font-bold mb-4">Warranty Coverage – Quick Compare</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-3xl">Most major manufacturers provide only 1-year standard coverage. NineScrolls includes 2 years standard warranty with equipment purchase.</p>

            <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
              <table className="w-full text-left" role="table" aria-label="Warranty Coverage Comparison">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="p-4 font-headline font-bold" scope="col">Feature</th>
                    <th className="p-4 font-headline font-bold" scope="col">Major Manufacturers</th>
                    <th className="p-4 font-headline font-bold" scope="col">NineScrolls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {[
                    ['Standard Warranty', '1 year (parts & labor)', '2 years standard warranty included (parts & labor)'],
                    ['Preventive Maintenance', 'Paid option', '1 free PM visit'],
                    ['Response Time', '5-10 business days', '2-3 business days'],
                    ['Service Cost', 'Premium rates', 'Competitive pricing'],
                    ['Technical Support', 'Limited hours', 'Extended availability'],
                    ['Custom Solutions', 'Standard only', 'Tailored to your needs'],
                  ].map(([feature, competitor, ns]) => (
                    <tr key={feature} className="bg-white">
                      <td className="p-4 font-bold">{feature}</td>
                      <td className="p-4 text-on-surface-variant">{competitor}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 text-primary font-medium">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          {ns}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-on-surface-variant text-sm mt-6">*Response times apply to continental U.S. locations. Competitor data reflects typical published terms from major semiconductor equipment manufacturers.</p>
            <div className="mt-8">
              <Link to="/contact?topic=compare" className="inline-block px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity">Get Detailed Comparison</Link>
            </div>
          </div>
        </section>

        {/* TCO Analysis */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-headline font-bold mb-4">Total Cost of Ownership (5-Year)</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-3xl">A realistic view of where budgets go helps optimize long-term planning and uptime. With an AMC in place, NineScrolls customers typically see lower maintenance and downtime costs compared to industry averages.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="flex justify-center">
                <div className="relative w-64 h-64">
                  <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="TCO donut chart">
                    <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="28" />
                    <circle cx="100" cy="100" r="78" fill="none" stroke="#3b82f6" strokeWidth="28" strokeDasharray="196 293.6" strokeDashoffset="0" />
                    <circle cx="100" cy="100" r="78" fill="none" stroke="#10b981" strokeWidth="28" strokeDasharray="122.4 367.2" strokeDashoffset="-196" />
                    <circle cx="100" cy="100" r="78" fill="none" stroke="#06b6d4" strokeWidth="28" strokeDasharray="122.4 367.2" strokeDashoffset="-318.4" />
                    <circle cx="100" cy="100" r="78" fill="none" stroke="#f59e0b" strokeWidth="28" strokeDasharray="48.96 440.64" strokeDashoffset="-440.8" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm text-on-surface-variant">5-Year TCO</span>
                    <span className="text-3xl font-headline font-bold">100%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { color: '#3b82f6', label: 'Equipment Purchase – 40%' },
                  { color: '#10b981', label: 'Maintenance & Service – 25%' },
                  { color: '#06b6d4', label: 'Operating Costs – 25%' },
                  { color: '#f59e0b', label: 'Downtime Impact – 10%' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="text-on-surface">{item.label}</span>
                  </div>
                ))}
                <p className="text-on-surface-variant text-sm mt-4">*Based on industry averages for research-grade plasma processing and thin film deposition equipment.</p>
                <div className="flex flex-wrap gap-4 mt-6">
                  <Link to="/contact?topic=tco" className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity">Request a TCO Report</Link>
                  <Link to="/contact?topic=expert" className="px-8 py-3 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors">Talk to an Expert</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AMC Packages */}
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-headline font-bold mb-4">AMC Packages</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-3xl">Transparent service options designed for research institutions and manufacturing facilities. All service contracts are billed annually and not collected for multiple years in advance.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Basic */}
              <div className="bg-white p-8 rounded-xl border border-outline-variant/10 flex flex-col">
                <span className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold mb-4 w-fit">Basic AMC</span>
                <p className="text-on-surface-variant text-sm mb-4">Ideal for benchtop and small-footprint systems</p>
                <div className="text-3xl font-headline font-bold mb-1">Starting from $12,000</div>
                <p className="text-on-surface-variant text-sm mb-6">/ year (billed annually)</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {['2 preventive maintenance visits', 'Priority technical support', 'Parts discount (15%)', 'Remote diagnostics', 'Email support', 'Basic training'].map(f => (
                    <li key={f} className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span><span className="text-sm">{f}</span></li>
                  ))}
                </ul>
                <Link to="/contact?topic=amc" className="block text-center px-6 py-3 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors">Get AMC Pricing</Link>
              </div>

              {/* Premium */}
              <div className="bg-white p-8 rounded-xl border-2 border-primary flex flex-col relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-tertiary text-white rounded-full text-xs font-bold">Most Popular</span>
                <span className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold mb-4 w-fit">Premium AMC</span>
                <p className="text-on-surface-variant text-sm mb-4">Recommended for production-scale and multi-chamber systems</p>
                <div className="text-3xl font-headline font-bold mb-1">Starting from $25,000</div>
                <p className="text-on-surface-variant text-sm mb-6">/ year (billed annually)</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {['4 preventive maintenance visits', '48-hour on-site response*', 'Parts discount (25%)', 'Software updates included', 'Voicemail available 24/7 for critical issues', 'Advanced training', 'Performance optimization', 'Priority parts availability'].map(f => (
                    <li key={f} className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span><span className="text-sm">{f}</span></li>
                  ))}
                </ul>
                <Link to="/contact?topic=amc" className="block text-center px-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity">Request Premium Quote</Link>
              </div>

              {/* Custom */}
              <div className="bg-white p-8 rounded-xl border border-outline-variant/10 flex flex-col">
                <span className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold mb-4 w-fit">Custom AMC</span>
                <p className="text-on-surface-variant text-sm mb-4">Tailored for unique configurations or multi-site deployments</p>
                <div className="text-3xl font-headline font-bold mb-1">Tailored</div>
                <p className="text-on-surface-variant text-sm mb-6">/ quote</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {['Dedicated support team', 'Flexible contract terms', 'Integration with existing systems', 'Optional parts coverage', 'Custom training programs', 'Multi-site support'].map(f => (
                    <li key={f} className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span><span className="text-sm">{f}</span></li>
                  ))}
                </ul>
                <Link to="/contact?topic=amc" className="block text-center px-6 py-3 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors">Talk to Sales</Link>
              </div>
            </div>

            <p className="text-on-surface-variant text-sm mt-8">*Pricing and on-site response times apply to continental U.S. locations. Special discounts available for universities and research institutes — <Link to="/contact?topic=amc" className="text-primary underline">contact us</Link> for details.</p>
          </div>
        </section>

        {/* Service Process */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-headline font-bold mb-4">Our Service Process</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-3xl">A systematic approach to ensure optimal equipment performance and minimal downtime.</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {processSteps.map((step, i) => (
                <div key={step.title} className="relative">
                  <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/10 h-full">
                    <span className="material-symbols-outlined text-4xl text-primary mb-6 block">{step.icon}</span>
                    <h3 className="text-xl font-headline font-bold mb-3">{step.title}</h3>
                    <p className="text-on-surface-variant text-sm">{step.desc}</p>
                  </div>
                  {i < processSteps.length - 1 && (
                    <span className="hidden md:block material-symbols-outlined text-2xl text-on-surface-variant/40 absolute top-1/2 -right-5 -translate-y-1/2">arrow_forward</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 mt-12">
              <Link to="/contact?topic=service" className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity">Start Service Planning</Link>
              <a
                href="/docs/NineScrolls_Service_Process_Guide.pdf"
                className="px-8 py-3 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors"
                download="NineScrolls_Service_Process_Guide.pdf"
              >
                Download Process Guide
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="hero-gradient py-24 px-8 text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-6">Ready to Optimize Your Equipment Performance?</h2>
            <p className="text-white/80 text-lg mb-8">Contact our service team to discuss your specific needs and get a customized quote</p>
            <Link to="/contact?topic=service" className="inline-block px-8 py-3 bg-white text-primary font-bold rounded-lg hover:opacity-90 transition-opacity">Request Service Quote</Link>
          </div>
        </section>
      </main>
    </>
  );
}
