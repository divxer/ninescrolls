import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { cdnUrl } from '../config/imageConfig';

export function PlasmaCleanerOverviewPage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "Plasma Cleaners - HY & PLUTO Series",
    "description": "RF plasma cleaners for research laboratories. HY Series (慧仪智控) and PLUTO Series (沛沅仪器) available through NineScrolls LLC.",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "HY-4L",
        "url": "https://ninescrolls.com/products/hy-4l"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "PLUTO-T",
        "url": "https://ninescrolls.com/products/pluto-t"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "HY-20L",
        "url": "https://ninescrolls.com/products/hy-20l"
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "PLUTO-M",
        "url": "https://ninescrolls.com/products/pluto-m"
      },
      {
        "@type": "ListItem",
        "position": 5,
        "name": "HY-20LRF",
        "url": "https://ninescrolls.com/products/hy-20lrf"
      },
      {
        "@type": "ListItem",
        "position": 6,
        "name": "PLUTO-F",
        "url": "https://ninescrolls.com/products/pluto-f"
      }
    ]
  };

  return (
    <>
      <SEO
        title="Plasma Cleaners - HY & PLUTO Series | NineScrolls"
        description="RF plasma cleaners for research laboratories. HY Series and PLUTO Series — from compact teaching systems to 500W flagship cleaners. US-based sales, support, and warranty."
        keywords="plasma cleaner, RF plasma, research plasma system, HY-4L, HY-20L, PLUTO-T, PLUTO-M, PLUTO-F, batch plasma processing, surface activation"
        url="/products/plasma-cleaner"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="hero-gradient relative min-h-[400px] flex items-center py-20 text-white">
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' }
          ]} />
          <div className="text-center mt-6">
          <h1 className="text-5xl md:text-5xl font-bold mb-6">Plasma Cleaners</h1>
          <p className="text-2xl md:text-2xl mb-4 opacity-95">
            HY Series & PLUTO Series — RF Plasma Systems for Research Labs
          </p>
          <p className="text-lg max-w-[700px] mx-auto opacity-90 leading-relaxed">
            From compact teaching systems to 500W flagship cleaners. Six models covering every research plasma cleaning need, from $6,499 to $15,999.
          </p>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {/* HY-4L */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-primary">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/ns-plasma-4r/main.jpg')}
                  alt="HY-4L - Compact RF/MF Plasma Cleaner"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-primary/10 text-primary">Entry Level</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">HY-4L</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">Compact / Teaching / Validation</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  Practical entry point for laboratories requiring RF or Mid-Frequency plasma capability.
                  Designed for exploratory plasma processing, small-volume sample preparation, and teaching.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>~4 L Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>RF or Mid-Frequency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">science</span>
                    <span>Simple Operation</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">Starting at</span>
                  <span className="text-3xl font-bold text-primary">$6,499</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/hy-4l" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-T */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-primary">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/pluto-t/main.jpg')}
                  alt="PLUTO-T - 200W RF Plasma Cleaner"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-primary/10 text-primary">RF Compact</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">PLUTO-T</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">200W RF / Touchscreen / Under $10K</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  High-performance 200W RF plasma cleaner with touchscreen control at an accessible price point.
                  33% more RF power than comparable entry-level systems.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>~4.3 L Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>200W RF (13.56 MHz)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    <span>Touchscreen</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">US Price</span>
                  <span className="text-3xl font-bold text-primary">$9,999</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/pluto-t" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* HY-20L */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-[#8b5cf6]">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/ns-plasma-20r/main.jpg')}
                  alt="HY-20L - Research-Grade Batch Plasma Processing System"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-[#8b5cf6]/10 text-[#8b5cf6]">Batch Processing</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">HY-20L</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">Core Research / 20L Batch Chamber</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  Research-grade batch plasma processing with 20-liter chamber and full PLC control.
                  Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>Up to 300W</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    <span>Full PLC Control</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">Starting at</span>
                  <span className="text-3xl font-bold text-primary">$11,999</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/hy-20l" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-M */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-[#8b5cf6]">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/pluto-m/main.jpg')}
                  alt="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-[#8b5cf6]/10 text-[#8b5cf6]">RF Mid-Size</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">PLUTO-M</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">200W RF / 8L Chamber / Batch Capable</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  Optimal balance of RF precision and batch capability. 8-liter chamber with 200W RF power
                  for efficient multi-sample processing without sacrificing performance.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>~8 L Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>200W RF (13.56 MHz)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    <span>Recipe Storage</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">US Price</span>
                  <span className="text-3xl font-bold text-primary">$12,999</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/pluto-m" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* HY-20LRF */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-[#8b5cf6]">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/ns-plasma-20r-i/main.jpg')}
                  alt="HY-20LRF - Integrated RF Vacuum Plasma Cleaner"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-[#8b5cf6]/10 text-[#8b5cf6]">Integrated RF</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">HY-20LRF</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">20L Integrated / 300W RF / PLC + Touchscreen</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  Integrated RF vacuum plasma cleaner with 20-liter batch chamber and 300W RF power.
                  Higher throughput for labs needing repeatable plasma surface treatment.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>300W RF (13.56 MHz)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    <span>PLC + Touchscreen</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">US Price</span>
                  <span className="text-3xl font-bold text-primary">$14,499</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/hy-20lrf" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-F */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col border-t-4 border-[#8b5cf6]">
              <div className="w-full h-[300px] overflow-hidden bg-gray-100 flex items-center justify-center min-w-0 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/pluto-f/main.jpg')}
                  alt="PLUTO-F - 500W RF Flagship Plasma Cleaner"
                  width={600}
                  height={400}
                  className="w-full h-full object-contain p-4"
                />
              </div>
              <div className="p-10 flex flex-col grow">
                <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 w-fit bg-[#8b5cf6]/10 text-[#8b5cf6]">RF Flagship</div>
                <h2 className="text-3xl font-bold mb-2 text-on-surface">PLUTO-F</h2>
                <p className="text-lg text-on-surface-variant mb-6 font-medium">500W RF / 14.5L Chamber / Advanced Recipes</p>
                <p className="text-base text-on-surface-variant leading-relaxed mb-6 grow">
                  NineScrolls' most powerful RF plasma cleaner. 500W RF with 14.5-liter chamber and advanced recipe management.
                  11x the RF power of comparable desktop systems at a fraction of the price.
                </p>
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span>~14.5 L Chamber</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                    <span>500W RF (13.56 MHz)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    <span>Advanced Recipes</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <span className="text-sm text-on-surface-variant font-medium">US Price</span>
                  <span className="text-3xl font-bold text-primary">$15,999</span>
                </div>
                <div className="mt-auto">
                  <Link to="/products/pluto-f" className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-4xl font-bold mb-4 text-on-surface">Which system is right for you?</h2>
          <p className="text-xl text-on-surface-variant mb-8 max-w-[600px] mx-auto">Compare features, specifications, and use cases to find the best fit for your laboratory.</p>
          <Link to="/products/plasma-cleaner/compare" className="inline-flex items-center border-2 border-primary text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary hover:text-on-primary transition-colors no-underline">
            Compare Models
          </Link>
        </div>
      </section>
    </>
  );
}
