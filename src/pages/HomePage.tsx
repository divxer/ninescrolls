import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { newsCategories } from '../types';

export function HomePage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const { posts: allFetchedPosts, loading: insightsLoading } = useInsightsPosts();
  const newsCats = useMemo(() => new Set(newsCategories.filter(c => c !== 'All')), []);
  const allInsightsPosts = useMemo(() => allFetchedPosts.filter(p => !newsCats.has(p.category)), [allFetchedPosts, newsCats]);
  const latestInsights = useMemo(
    () => [...allInsightsPosts]
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 3),
    [allInsightsPosts]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://ninescrolls.com/#organization",
        "url": "https://ninescrolls.com",
        "name": "NineScrolls LLC",
        "description": "Research-grade semiconductor equipment provider specializing in plasma etching systems (RIE, ICP-RIE), thin-film deposition systems (ALD, PECVD, HDP-CVD), and plasma cleaners for surface preparation.",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ninescrolls.com/assets/images/logo.png"
        },
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "12546 Cabezon Pl",
          "addressLocality": "San Diego",
          "addressRegion": "CA",
          "postalCode": "92129",
          "addressCountry": "US"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+1-858-879-8898",
          "contactType": "sales",
          "email": "sales@ninescrolls.com",
          "availableLanguage": ["English", "Chinese"]
        },
        "sameAs": [
          "https://www.linkedin.com/company/nine-scrolls-technology"
        ],
        "knowsAbout": [
          "plasma etching",
          "reactive ion etching",
          "inductively coupled plasma etching",
          "atomic layer deposition",
          "plasma-enhanced chemical vapor deposition",
          "high-density plasma CVD",
          "magnetron sputtering",
          "ion beam etching",
          "plasma cleaning",
          "thin film deposition",
          "semiconductor manufacturing equipment"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://ninescrolls.com/#website",
        "url": "https://ninescrolls.com",
        "name": "NineScrolls",
        "publisher": {
          "@id": "https://ninescrolls.com/#organization"
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="NineScrolls - Advanced Plasma Etching & ALD Systems for Semiconductor Manufacturing"
        description="Leading provider of plasma etching systems, ALD equipment, and semiconductor manufacturing solutions. Expert RIE etching, ICP etching, and thin film deposition technology for research and production."
        keywords="plasma etching, plasma etching machine, plasma etching process, inductively coupled plasma etching, what is plasma etching, semiconductor manufacturing, thin film deposition"
        url="/"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <main>
        {/* Hero Section */}
        <section className="relative h-screen min-h-[700px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img className="w-full h-full object-cover" src="/assets/images/hero-cleanroom.jpg" alt="Semiconductor cleanroom facility" />
            <div className="absolute inset-0 bg-gradient-to-r from-on-surface/80 via-on-surface/45 to-transparent"></div>
          </div>
          <div className="container mx-auto px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="max-w-2xl">
              <span className="inline-block px-4 py-1 mb-6 bg-primary text-white text-xs font-bold tracking-widest uppercase rounded-full">Engineering Excellence</span>
              <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-white leading-[1.1] mb-6 tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                Research-Grade <span className="text-[#4d94ff]">Semiconductor</span> Equipment.
              </h1>
              <p className="text-lg text-slate-300 mb-10 leading-relaxed font-light">
                Bridging advanced manufacturing with local U.S.-based expert support. We empower labs and startups with the precision tools required for the next generation of thin-film engineering.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/products" className="px-8 py-4 bg-primary text-white font-bold rounded-sm flex items-center gap-2 group transition-all hover:bg-primary-container">
                  Explore Equipment
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
                <Link to="/startup-package" className="px-8 py-4 border border-white/30 text-white font-bold rounded-sm hover:bg-white/10 backdrop-blur-sm transition-all">
                  Startup Package
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section className="py-24 bg-surface">
          <div className="container mx-auto px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
              <div className="max-w-xl">
                <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Precision Instruments</h2>
                <div className="h-1 w-20 bg-primary mb-6"></div>
                <p className="text-on-surface-variant">Industrial reliability meets laboratory precision. Our flagship platforms are designed for high-repeatability research environments.</p>
              </div>
              <Link className="text-primary font-bold text-sm tracking-widest uppercase flex items-center gap-2 hover:gap-4 transition-all shrink-0" to="/products">
                View All Products <span className="material-symbols-outlined">east</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Link to="/products/rie-etcher" className="group bg-surface-container-lowest rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  <OptimizedImage
                    src="/assets/images/products/rie-etcher/main.jpg"
                    alt="RIE Etcher Series"
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-headline font-bold text-on-surface mb-2">RIE Etcher Series</h3>
                  <p className="text-sm text-on-surface-variant mb-4">High-precision reactive ion etching for semiconductor processing and MEMS fabrication.</p>
                  <span className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </Link>

              <Link to="/products/icp-etcher" className="group bg-surface-container-lowest rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  <OptimizedImage
                    src="/assets/images/products/icp-etcher/main.jpg"
                    alt="ICP Etcher Series"
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-headline font-bold text-on-surface mb-2">ICP Etcher Series</h3>
                  <p className="text-sm text-on-surface-variant mb-4">Advanced inductively coupled plasma for high-aspect-ratio and deep reactive ion etching.</p>
                  <span className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </Link>

              <Link to="/products/ald" className="group bg-surface-container-lowest rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  <OptimizedImage
                    src="/assets/images/products/ald/main.jpg"
                    alt="ALD Systems"
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-headline font-bold text-on-surface mb-2">ALD Systems</h3>
                  <p className="text-sm text-on-surface-variant mb-4">Atomic layer deposition for ultra-thin conformal films with angstrom-level thickness control.</p>
                  <span className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </Link>

              <Link to="/products/pecvd" className="group bg-surface-container-lowest rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  <OptimizedImage
                    src="/assets/images/products/pecvd/main.jpg"
                    alt="PECVD Systems"
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-headline font-bold text-on-surface mb-2">PECVD Systems</h3>
                  <p className="text-sm text-on-surface-variant mb-4">Plasma-enhanced chemical vapor deposition for high-quality thin film coatings.</p>
                  <span className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Technologies Section */}
        <section className="py-24 bg-surface-container-low">
          <div className="container mx-auto px-8">
            <div className="max-w-xl mb-16">
              <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Cutting-Edge Technologies</h2>
              <div className="h-1 w-20 bg-primary mb-6"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-4xl text-primary mb-4 block">precision_manufacturing</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-3">Precision Engineering</h3>
                <p className="text-on-surface-variant leading-relaxed">Advanced manufacturing techniques ensuring nanometer-scale accuracy with &plusmn;3% uniformity across wafer surfaces.</p>
              </div>

              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-4xl text-primary mb-4 block">smart_toy</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-3">Automation Systems</h3>
                <p className="text-on-surface-variant leading-relaxed">Intelligent control systems with temperature range from -70&deg;C to 200&deg;C for reproducible results and process stability.</p>
              </div>

              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-4xl text-primary mb-4 block">bolt</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-3">Plasma Technology</h3>
                <p className="text-on-surface-variant leading-relaxed">State-of-the-art plasma processing with high-density sources delivering etch rates up to 5 &mu;m/min for advanced applications.</p>
              </div>
            </div>
          </div>
        </section>

        {/* R&D / Innovation Section */}
        <section className="relative py-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img className="w-full h-full object-cover" src="/assets/images/research-facility.jpg" alt="Research facility" />
            <div className="absolute inset-0 bg-on-surface/60"></div>
          </div>
          <div className="container mx-auto px-8 relative z-10 text-center max-w-3xl">
            <span className="inline-block px-4 py-1 mb-6 bg-primary text-white text-xs font-bold tracking-widest uppercase rounded-full">Innovation</span>
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-white tracking-tight mb-6">Driving Innovation Through R&D</h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-10">
              Our commitment to research and development drives continuous improvements in our equipment solutions. We work closely with leading research labs to push the boundaries of what's possible in semiconductor processing.
            </p>
            <Link to="/about" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-sm group transition-all hover:bg-primary-container">
              Discover Our R&D
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </Link>
          </div>
        </section>

        {/* Insights Section */}
        <section className="py-24 bg-surface">
          <div className="container mx-auto px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
              <div className="max-w-xl">
                <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Research Insights</h2>
                <div className="h-1 w-20 bg-primary mb-6"></div>
                <p className="text-on-surface-variant">Expert guides and technical resources for research laboratories.</p>
              </div>
              <Link className="text-primary font-bold text-sm tracking-widest uppercase flex items-center gap-2 hover:gap-4 transition-all shrink-0" to="/insights">
                View All Insights <span className="material-symbols-outlined">east</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {insightsLoading ? (
                <div className="col-span-full text-center text-on-surface-variant py-12">Loading insights...</div>
              ) : latestInsights.map((post) => (
                <Link key={post.id} to={`/insights/${post.slug}`} className="group bg-surface-container-lowest rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                  <div className="aspect-[16/10] overflow-hidden">
                    <OptimizedImage
                      src={post.imageUrl}
                      alt={post.title}
                      width={400}
                      height={250}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold tracking-widest uppercase text-primary">{post.category}</span>
                      <span className="text-xs text-on-surface-variant">{post.readTime} min read</span>
                    </div>
                    <h3 className="text-lg font-headline font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-sm text-on-surface-variant line-clamp-2">{post.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Partners & Testimonials Section */}
        <section className="py-24 bg-surface-container-low">
          <div className="container mx-auto px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-4">Trusted by Leading Institutions</h2>
              <div className="h-1 w-20 bg-primary mx-auto mb-6"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              <div className="text-center p-8 bg-surface-container-lowest rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">account_balance</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Research Universities</h3>
                <p className="text-on-surface-variant">Top-tier academic institutions worldwide</p>
              </div>
              <div className="text-center p-8 bg-surface-container-lowest rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">biotech</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Research Institutes</h3>
                <p className="text-on-surface-variant">National labs and research centers</p>
              </div>
              <div className="text-center p-8 bg-surface-container-lowest rounded-sm shadow-sm">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">domain</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Corporate R&D</h3>
                <p className="text-on-surface-variant">Innovation labs and tech companies</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm border-t-2 border-primary">
                <span className="material-symbols-outlined text-3xl text-primary/30 mb-4 block">format_quote</span>
                <p className="text-on-surface leading-relaxed mb-6">"NineScrolls' cutting-edge systems have significantly advanced our research capabilities in semiconductor device fabrication."</p>
                <p className="font-headline font-bold text-on-surface">Dr. Sarah Chen</p>
                <p className="text-sm text-on-surface-variant">Principal Investigator, Advanced Materials Research Lab</p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm border-t-2 border-primary">
                <span className="material-symbols-outlined text-3xl text-primary/30 mb-4 block">format_quote</span>
                <p className="text-on-surface leading-relaxed mb-6">"The precision and reliability of NineScrolls equipment has been essential for our MEMS fabrication processes."</p>
                <p className="font-headline font-bold text-on-surface">Prof. Michael Rodriguez</p>
                <p className="text-sm text-on-surface-variant">Department of Electrical Engineering, Research University</p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-sm shadow-sm border-t-2 border-primary">
                <span className="material-symbols-outlined text-3xl text-primary/30 mb-4 block">format_quote</span>
                <p className="text-on-surface leading-relaxed mb-6">"Excellent technical support and equipment performance. Highly recommended for research-grade applications."</p>
                <p className="font-headline font-bold text-on-surface">Dr. Jennifer Kim</p>
                <p className="text-sm text-on-surface-variant">Materials Science Research Center</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
