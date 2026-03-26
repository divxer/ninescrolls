import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';

export function AboutPage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About NineScrolls LLC",
    "description": "NineScrolls LLC is a U.S.-based scientific equipment platform serving universities and research institutions with advanced plasma processing and thin film deposition systems.",
    "mainEntity": {
      "@type": "Organization",
      "name": "NineScrolls LLC",
      "description": "NineScrolls LLC is a U.S.-based scientific equipment supplier dedicated to advancing innovation in plasma processing and thin film deposition for research institutions.",
      "foundingDate": "2023",
      "url": "https://ninescrolls.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "San Diego",
        "addressRegion": "CA",
        "addressCountry": "US"
      },
      "areaServed": {
        "@type": "Country",
        "name": "United States"
      },
      "knowsAbout": [
        "Semiconductor Manufacturing Equipment",
        "Thin Film Deposition",
        "Plasma Etching",
        "ALD Systems",
        "PECVD Systems",
        "Scientific Research Equipment"
      ]
    }
  };

  return (
    <>
      <SEO
        title="About Us"
        description="NineScrolls LLC is a U.S.-based scientific equipment platform serving universities and research institutions with advanced plasma processing and thin film deposition systems."
        keywords="scientific equipment supplier, plasma processing, thin film deposition, research equipment, US-based semiconductor equipment, NineScrolls LLC, university lab equipment"
        url="/about"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <main>
        {/* Hero Section */}
        <section className="relative h-[600px] flex items-center hero-gradient text-white">
          <div className="container mx-auto px-8 relative z-10">
            <h1 className="text-7xl font-headline font-bold mb-6">U.S.-Based Scientific Equipment Platform</h1>
            <p className="text-2xl max-w-2xl font-light opacity-80">
              Serving universities, research institutions, and advanced semiconductor laboratories with precision plasma processing and thin film deposition systems.
            </p>
          </div>
        </section>

        {/* What We Do — Service Responsibilities */}
        <section className="py-24 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-headline font-bold mb-4">How We Support You</h2>
            <p className="text-lg text-on-surface-variant">End-to-end support from consultation through installation and beyond</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-on-primary-container text-3xl">forum</span>
              </div>
              <h3 className="text-xl font-headline font-bold mb-3">Pre-Sales Technical Consultation</h3>
              <p className="text-on-surface-variant leading-relaxed">We handle all technical discussions, feasibility assessments, and system configuration consultations directly from the U.S., ensuring you get expert guidance from day one.</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-on-primary-container text-3xl">description</span>
              </div>
              <h3 className="text-xl font-headline font-bold mb-3">System Configuration & Quotation</h3>
              <p className="text-on-surface-variant leading-relaxed">All quotations, pricing, and configuration details are provided by NineScrolls LLC, ensuring consistency, transparency, and full accountability throughout the process.</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-on-primary-container text-3xl">local_shipping</span>
              </div>
              <h3 className="text-xl font-headline font-bold mb-3">Project Coordination & Delivery</h3>
              <p className="text-on-surface-variant leading-relaxed">We manage project timelines, shipping coordination, and delivery logistics to ensure smooth handover and seamless integration into your facility.</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-on-primary-container text-3xl">build</span>
              </div>
              <h3 className="text-xl font-headline font-bold mb-3">Post-Installation Support</h3>
              <p className="text-on-surface-variant leading-relaxed">Technical support, maintenance coordination, and service requests are handled through our U.S.-based support team with dedicated response channels.</p>
            </div>
          </div>
        </section>

        {/* Manufacturing Partner Section */}
        <section className="py-24 px-8 bg-surface-container-low" id="manufacturer">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-headline font-bold text-center mb-16">Engineering & Manufacturing Partner</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
              <div className="space-y-6">
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  NineScrolls LLC partners with Tyloong Semiconductor Equipment, a manufacturer with over three decades
                  of expertise in plasma processing and thin film deposition systems. This partnership enables us to offer
                  proven, production-grade platforms backed by deep engineering knowledge and continuous R&D investment.
                </p>
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  As the exclusive U.S. representative, NineScrolls manages all customer-facing operations — from
                  pre-sales consultation through installation and ongoing support — while leveraging Tyloong's
                  manufacturing excellence and technical depth.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-surface-container-lowest p-8 rounded-xl text-center border border-outline-variant">
                  <span className="text-4xl font-headline font-bold text-primary block mb-2">30+</span>
                  <span className="text-sm text-on-surface-variant">Years of Semiconductor Equipment Experience</span>
                </div>
                <div className="bg-surface-container-lowest p-8 rounded-xl text-center border border-outline-variant">
                  <span className="text-4xl font-headline font-bold text-primary block mb-2">1,000+</span>
                  <span className="text-sm text-on-surface-variant">Systems Installed Globally</span>
                </div>
                <div className="bg-surface-container-lowest p-8 rounded-xl text-center border border-outline-variant">
                  <span className="text-4xl font-headline font-bold text-primary block mb-2">R&D</span>
                  <span className="text-sm text-on-surface-variant">Continuous Platform Innovation</span>
                </div>
                <div className="bg-surface-container-lowest p-8 rounded-xl text-center border border-outline-variant">
                  <span className="text-4xl font-headline font-bold text-primary block mb-2">6+</span>
                  <span className="text-sm text-on-surface-variant">Equipment Platform Categories</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Philosophy */}
        <section className="py-24 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-headline font-bold mb-4">Our Story</h2>
            <p className="text-lg text-on-surface-variant">Order in the Universe. Precision in Engineering.</p>
          </div>
          <div className="space-y-16">
            <p className="text-xl text-on-surface-variant leading-relaxed max-w-3xl mx-auto text-center">
              At NineScrolls, we believe that science and engineering are expressions of a deeper order
              that governs both the universe and human innovation. Our visual symbol and name reflect two
              complementary traditions of understanding order.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="bg-surface-container-lowest p-10 rounded-xl border border-outline-variant">
                <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-on-primary-container text-3xl">public</span>
                </div>
                <h3 className="text-2xl font-headline font-bold mb-4">The Dragon: Cosmic Order</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  Our circular dragon motif represents an ancient understanding of the universe — celestial
                  motion, the continuous flow of energy, and harmony between opposing forces. In early Chinese
                  philosophy, the universe is structured and dynamic, governed by balance, motion, and
                  transformation. <strong>Nature operates through order.</strong>
                </p>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-xl border border-outline-variant">
                <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-on-primary-container text-3xl">menu_book</span>
                </div>
                <h3 className="text-2xl font-headline font-bold mb-4">The Nine Chapters: Mathematical Order</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  Our name draws inspiration from <em>The Nine Chapters on the Mathematical Art</em>, an ancient
                  text that systematized practical problem-solving — from land measurement and engineering
                  calculations to solving simultaneous equations. Its essence was simple and
                  powerful: <strong>Mathematics creates order in the human world.</strong>
                </p>
              </div>
            </div>
            <div className="bg-primary-container rounded-xl p-10 text-center max-w-3xl mx-auto">
              <p className="text-lg font-medium text-on-primary-container">
                NineScrolls exists to translate scientific order into engineering precision. From cosmic order
                to engineered precision — this is the spirit of NineScrolls.
              </p>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-24 px-8 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-bold mb-4">Our Core Values</h2>
              <p className="text-lg text-on-surface-variant">The principles that guide every decision we make</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-start gap-6 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-primary-container">language</span>
                </div>
                <div>
                  <h3 className="text-xl font-headline font-bold mb-2">Integration</h3>
                  <p className="text-on-surface-variant leading-relaxed">We create seamless connections between manufacturers, researchers, and industry professionals to accelerate scientific discovery and simplify procurement.</p>
                </div>
              </div>
              <div className="flex items-start gap-6 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-primary-container">star</span>
                </div>
                <div>
                  <h3 className="text-xl font-headline font-bold mb-2">Innovation</h3>
                  <p className="text-on-surface-variant leading-relaxed">We drive advancement in the scientific equipment industry through innovative solutions, platform integration, and continuous technology evaluation.</p>
                </div>
              </div>
              <div className="flex items-start gap-6 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-primary-container">group</span>
                </div>
                <div>
                  <h3 className="text-xl font-headline font-bold mb-2">Collaboration</h3>
                  <p className="text-on-surface-variant leading-relaxed">We foster partnerships and facilitate connections across the scientific community, bringing together research institutions, manufacturers, and domain experts.</p>
                </div>
              </div>
              <div className="flex items-start gap-6 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-primary-container">verified</span>
                </div>
                <div>
                  <h3 className="text-xl font-headline font-bold mb-2">Expertise</h3>
                  <p className="text-on-surface-variant leading-relaxed">We leverage deep industry knowledge and hands-on experience to deliver tailored solutions that create lasting value for our partners and research clients.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Credentials */}
        <section className="py-24 px-8 max-w-7xl mx-auto">
          <h2 className="text-4xl font-headline font-bold text-center mb-16">Trust & Credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-4 block">location_on</span>
              <h4 className="font-headline font-bold mb-2">U.S.-Based Operations</h4>
              <p className="text-on-surface-variant text-sm">San Diego, California</p>
              <p className="text-on-surface-variant text-sm">Direct technical support team</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-4 block">badge</span>
              <h4 className="font-headline font-bold mb-2">D-U-N-S Number</h4>
              <p className="text-primary font-bold text-lg">13-477-6662</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-4 block">verified</span>
              <h4 className="font-headline font-bold mb-2">UEI Number</h4>
              <p className="text-primary font-bold text-lg">C4BFCTH5L5D1</p>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-4 block">account_balance</span>
              <h4 className="font-headline font-bold mb-2">Government Ready</h4>
              <p className="text-on-surface-variant text-sm">Registered for federal and institutional procurement</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-8 hero-gradient text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-6">Ready to Discuss Your Research Needs?</h2>
            <p className="text-xl opacity-80 mb-10">Our team is here to help you find the right equipment platform for your laboratory.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/products" className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors text-lg">Explore Equipment</Link>
              <Link to="/contact" className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-bold rounded-lg hover:bg-white/10 transition-colors text-lg">Contact Our Team</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
