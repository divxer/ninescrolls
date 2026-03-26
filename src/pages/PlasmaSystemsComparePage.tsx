import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';

export function PlasmaSystemsComparePage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "HY Series Plasma Cleaners Comparison",
    "itemListElement": [
      {
        "@type": "Product",
        "name": "HY-4L",
        "url": "https://ninescrolls.com/products/hy-4l"
      },
      {
        "@type": "Product",
        "name": "HY-20L",
        "url": "https://ninescrolls.com/products/hy-20l"
      },
      {
        "@type": "Product",
        "name": "HY-20LRF (Integrated)",
        "url": "https://ninescrolls.com/products/hy-20lrf"
      }
    ]
  };

  return (
    <>
      <SEO
        title="Compare HY Series Plasma Cleaners - HY-4L vs HY-20L vs HY-20LRF | NineScrolls"
        description="Compare HY-4L, HY-20L, and HY-20LRF systems. Find the right compact RF plasma system for your research laboratory needs."
        keywords="HY Series comparison, plasma system comparison, HY-4L vs HY-20L vs HY-20LRF, research plasma systems"
        url="/products/plasma-cleaner/compare"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="bg-surface-container-lowest text-on-surface py-12 text-center border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-4">Compare HY Series Plasma Cleaners</h1>
          <p className="text-lg text-on-surface-variant max-w-[700px] mx-auto leading-relaxed">
            Start with HY-4L for validation.<br />
            Choose HY-20L or HY-20LRF for core research.
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-6">
          <div className="overflow-x-auto mb-12">
            <div
              className="grid bg-white rounded-xl overflow-hidden shadow-md border border-outline-variant/20"
              style={{ gridTemplateColumns: '200px minmax(0,1fr) 2px minmax(0,1fr) 2px minmax(0,1fr)' }}
            >
              {/* Header Row */}
              <div className="p-6 text-left font-bold text-lg bg-surface-container-lowest border-b-2 border-outline-variant/20">Feature</div>
              <div className="p-6 text-left font-semibold text-lg bg-surface-container-lowest border-b-2 border-outline-variant/20">
                <div className="flex flex-col gap-2 items-start">
                  <h3 className="text-2xl font-bold m-0 text-gray-600">HY-4L</h3>
                  <p className="text-lg !text-gray-600 font-bold mt-2">Compact / Teaching / Validation</p>
                  <Link to="/products/hy-4l" className="text-primary no-underline text-sm font-semibold hover:opacity-80">
                    View Details →
                  </Link>
                </div>
              </div>
              <div className="bg-primary border-b-2 border-outline-variant/20"></div>
              <div className="p-6 text-left font-semibold text-lg bg-white border-b-2 border-outline-variant/20">
                <div className="flex flex-col gap-2 items-start">
                  <h3 className="text-2xl font-bold m-0 text-primary">HY-20L</h3>
                  <p className="text-lg !text-gray-600 font-bold mt-2">Core Research / Batch Processing</p>
                  <Link to="/products/hy-20l" className="text-primary no-underline text-sm font-semibold hover:opacity-80">
                    View Details →
                  </Link>
                </div>
              </div>
              <div className="bg-primary border-b-2 border-outline-variant/20"></div>
              <div className="p-6 text-left font-semibold text-lg bg-white border-b-2 border-outline-variant/20">
                <div className="flex flex-col gap-2 items-start">
                  <h3 className="text-2xl font-bold m-0 text-primary">HY-20LRF</h3>
                  <p className="text-lg !text-gray-600 font-bold mt-2">Integrated / Batch Processing</p>
                  <Link to="/products/hy-20lrf" className="text-primary no-underline text-sm font-semibold hover:opacity-80">
                    View Details →
                  </Link>
                </div>
              </div>

              {/* Content Rows */}
              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Typical Use</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">Teaching / Validation</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">Core Research</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">Integrated / Batch Processing</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Batch Processing</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">Designed for small-volume use</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">
                <span className="text-primary font-bold text-lg">✔</span> Full batch capacity
              </div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">
                <span className="text-primary font-bold text-lg">✔</span> Full batch capacity
              </div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Process Repeatability</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">Moderate</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">High</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">High</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Automation</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">Simplified for teaching & validation</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">Full PLC</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 !text-primary !font-semibold">PLC + Touchscreen</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Chamber Volume</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">~4 L</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">~20 L</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">20 L</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">RF Power</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">Adjustable (research-grade range)</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">Up to 300 W</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">300 W (13.56 MHz)</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Control System</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">PLC + Touchscreen, Auto / Manual</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">PLC + Touch Screen</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">PLC + Touchscreen</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface border-b border-outline-variant/10">Price (Starting)</div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10 bg-surface-container-lowest">$6,499 (MF) / $7,999 (RF)</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">$11,999 (MF) / $14,999 (RF)</div>
              <div className="bg-primary border-b border-outline-variant/10"></div>
              <div className="p-6 text-left text-on-surface-variant border-b border-outline-variant/10">$14,499</div>

              <div className="p-6 text-left font-semibold bg-surface-container-lowest text-on-surface !border-b-0">Upgrade Path</div>
              <div className="p-6 text-left text-on-surface-variant !border-b-0 bg-surface-container-lowest">
                <Link to="/products/hy-20l" className="text-primary no-underline font-semibold hover:opacity-80">
                  → HY-20L / HY-20LRF
                </Link>
              </div>
              <div className="bg-primary !border-b-0"></div>
              <div className="p-6 text-left text-on-surface-variant !border-b-0">—</div>
              <div className="bg-primary !border-b-0"></div>
              <div className="p-6 text-left text-on-surface-variant !border-b-0">—</div>
            </div>
          </div>

          <div className="text-center p-8 bg-white rounded-lg shadow-sm max-w-[800px] mx-auto mb-12">
            <p className="text-lg text-on-surface-variant italic leading-relaxed m-0">
              Many laboratories begin with HY-4L and upgrade to HY-20L or HY-20LRF as their process requirements evolve.
            </p>
          </div>

          {/* Split Path CTAs - Direct Action */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1200px] mx-auto">
            <div className="bg-surface-container-lowest p-10 rounded-xl shadow-md text-center hover:-translate-y-1 hover:shadow-lg transition-all border-t-4 border-slate-500">
              <h3 className="text-2xl font-bold mb-4 text-gray-600">Start with HY-4L</h3>
              <p className="text-on-surface-variant mb-6 leading-relaxed">Ideal for validation, teaching labs, and exploratory research</p>
              <Link to="/products/hy-4l" className="inline-flex items-center justify-center w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                Explore HY-4L →
              </Link>
            </div>
            <div className="bg-white p-10 rounded-xl shadow-[0_4px_20px_rgba(59,130,246,0.1)] text-center hover:-translate-y-1 hover:shadow-lg transition-all border-t-4 border-primary">
              <h3 className="text-2xl font-bold mb-4 text-primary">Explore HY-20L</h3>
              <p className="text-on-surface-variant mb-6 leading-relaxed">Designed for core research requiring batch processing and reproducibility</p>
              <Link to="/products/hy-20l" className="inline-flex items-center justify-center w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                Explore HY-20L →
              </Link>
            </div>
            <div className="bg-white p-10 rounded-xl shadow-[0_4px_20px_rgba(59,130,246,0.1)] text-center hover:-translate-y-1 hover:shadow-lg transition-all border-t-4 border-primary">
              <h3 className="text-2xl font-bold mb-4 text-primary">Explore HY-20LRF</h3>
              <p className="text-on-surface-variant mb-6 leading-relaxed">Integrated system for batch processing with optimized cost-efficiency</p>
              <Link to="/products/hy-20lrf" className="inline-flex items-center justify-center w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors no-underline">
                Explore HY-20LRF →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 text-center bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4 text-on-surface">Need help choosing?</h2>
          <p className="text-lg text-on-surface-variant mb-8">Contact our team for personalized recommendations based on your research needs.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/contact" className="inline-flex items-center border-2 border-primary text-primary px-8 py-4 rounded-lg font-semibold hover:bg-primary hover:text-on-primary transition-colors no-underline">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
