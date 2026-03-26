import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';

const roles = [
  {
    icon: 'groups',
    title: 'Sales Representative',
    desc: 'Develop relationships with universities, national labs, and research institutions. Manage the full sales cycle for capital equipment — from initial outreach to purchase order.',
    highlights: ['University and national lab account development', 'Capital equipment sales cycle management', 'Trade show and conference representation'],
    location: 'San Diego, CA',
    type: 'Full-time',
  },
  {
    icon: 'support_agent',
    title: 'Applications / Pre-Sales Engineer',
    desc: 'Provide technical consultation and live demos. Help customers identify the right plasma or thin film solution for their specific research needs.',
    highlights: ['Technical feasibility assessments', 'System configuration and selection guidance', 'Application-specific demo and evaluation support'],
    location: 'San Diego, CA',
    type: 'Full-time',
  },
  {
    icon: 'engineering',
    title: 'Field Service / After-Sales Engineer',
    desc: 'Support equipment installation, commissioning, and ongoing maintenance at customer sites across the U.S. Ensure researchers get the most out of their systems.',
    highlights: ['On-site installation and commissioning', 'Preventive maintenance and troubleshooting', 'Customer training and process optimization'],
    location: 'San Diego, CA + Travel',
    type: 'Full-time',
  },
];

const whyValues = [
  { icon: 'location_on', title: 'San Diego Based', desc: 'Work from one of the country\'s top life science and engineering hubs with access to leading universities and research institutions.' },
  { icon: 'trending_up', title: 'Growth-Stage Opportunity', desc: 'Join a company at an exciting growth phase where your contributions directly shape the direction and success of the business.' },
  { icon: 'star', title: 'Cutting-Edge Technology', desc: 'Work with advanced plasma processing and thin film deposition systems that power breakthrough research in materials science, photonics, and nanotechnology.' },
];

export function CareersPage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Careers at NineScrolls LLC",
    "description": "Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems. Explore opportunities in sales, applications engineering, and field service.",
    "mainEntity": {
      "@type": "Organization",
      "name": "NineScrolls LLC",
      "url": "https://ninescrolls.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "San Diego",
        "addressRegion": "CA",
        "addressCountry": "US"
      }
    }
  };

  return (
    <>
      <SEO
        title="Careers"
        description="Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems serving US universities. Explore roles in sales, pre-sales engineering, and field service."
        keywords="scientific equipment careers, plasma processing jobs, thin film deposition careers, lab equipment sales, field service engineer, San Diego scientific jobs, NineScrolls careers"
        url="/careers"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <main>
        {/* Hero + Intro */}
        <section className="py-32 bg-surface-container-low px-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-6xl font-headline font-bold mb-8">Join the Vanguard.</h1>
            <p className="text-xl text-on-surface-variant max-w-3xl leading-relaxed mb-6">
              Help us bring world-class plasma processing and thin film deposition systems to research institutions across the United States.
            </p>
            <div className="max-w-3xl space-y-4 text-on-surface-variant mb-16">
              <p>
                NineScrolls is a San Diego-based supplier of research-grade plasma surface treatment and thin film processing systems, serving universities and research institutions across the United States.
              </p>
              <p>
                As we expand our presence in the U.S. scientific equipment market, we are building a team of talented professionals who share our passion for enabling cutting-edge research.
              </p>
            </div>

            {/* Why NineScrolls values */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
              {whyValues.map(val => (
                <div key={val.title} className="p-8 bg-white rounded-xl shadow-sm border border-outline-variant/10">
                  <span className="material-symbols-outlined text-3xl text-primary mb-4 block">{val.icon}</span>
                  <h3 className="text-xl font-headline font-bold mb-4">{val.title}</h3>
                  <p className="text-on-surface-variant text-sm">{val.desc}</p>
                </div>
              ))}
            </div>

            {/* Anticipated Roles */}
            <h2 className="text-4xl font-headline font-bold mb-4">Anticipated Roles</h2>
            <p className="text-on-surface-variant text-lg mb-8">We are currently growing and expect to hire for the following positions</p>

            <div className="space-y-4">
              {roles.map(job => (
                <div key={job.title} className="bg-white p-8 rounded-xl group cursor-pointer hover:bg-primary transition-all border border-outline-variant/10">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white transition-colors">{job.icon}</span>
                        <div>
                          <h4 className="text-2xl font-headline font-bold group-hover:text-white transition-colors">{job.title}</h4>
                          <p className="text-on-surface-variant group-hover:text-white/80 transition-colors text-sm">{job.location} &bull; {job.type}</p>
                        </div>
                      </div>
                      <p className="text-on-surface-variant group-hover:text-white/80 transition-colors mb-4 ml-[3.5rem]">{job.desc}</p>
                      <ul className="space-y-1 ml-[3.5rem]">
                        {job.highlights.map(h => (
                          <li key={h} className="flex items-center gap-2 text-sm text-on-surface-variant group-hover:text-white/70 transition-colors">
                            <span className="w-1.5 h-1.5 bg-primary group-hover:bg-white rounded-full shrink-0"></span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white transition-colors mt-2">arrow_forward</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="hero-gradient py-24 px-8 text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-6">Get in Touch</h2>
            <p className="text-white/80 text-lg mb-8">
              We don't always have open positions listed, but we welcome inquiries from motivated individuals interested in the scientific equipment industry.
            </p>
            <a href="mailto:careers@ninescrolls.com" className="inline-block px-8 py-3 bg-white text-primary font-bold rounded-lg hover:opacity-90 transition-opacity mb-8">
              careers@ninescrolls.com
            </a>
            <div className="mt-8">
              <p className="text-white/60 mb-4">Or learn more about what we do:</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/about" className="px-8 py-3 border border-white/40 text-white font-bold rounded-lg hover:bg-white/10 transition-colors">About NineScrolls</Link>
                <Link to="/products" className="px-8 py-3 border border-white/40 text-white font-bold rounded-lg hover:bg-white/10 transition-colors">Our Equipment</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
