import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

export function PlasmaSystemsComparePage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "Plasma Cleaners Comparison — HY & PLUTO Series",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "HY-4L", "url": "https://ninescrolls.com/products/hy-4l" },
      { "@type": "ListItem", "position": 2, "name": "PLUTO-T", "url": "https://ninescrolls.com/products/pluto-t" },
      { "@type": "ListItem", "position": 3, "name": "HY-20L", "url": "https://ninescrolls.com/products/hy-20l" },
      { "@type": "ListItem", "position": 4, "name": "PLUTO-M", "url": "https://ninescrolls.com/products/pluto-m" },
      { "@type": "ListItem", "position": 5, "name": "HY-20LRF", "url": "https://ninescrolls.com/products/hy-20lrf" },
      { "@type": "ListItem", "position": 6, "name": "PLUTO-F", "url": "https://ninescrolls.com/products/pluto-f" }
    ]
  };

  return (
    <>
      <SEO
        title="Compare All Plasma Cleaners — HY & PLUTO Series | NineScrolls"
        description="Compare all 6 plasma cleaners side-by-side: HY-4L, PLUTO-T, HY-20L, PLUTO-M, HY-20LRF, and PLUTO-F. Find the right RF plasma system for your research lab."
        keywords="plasma cleaner comparison, HY Series, PLUTO Series, HY-4L, PLUTO-T, HY-20L, PLUTO-M, HY-20LRF, PLUTO-F, research plasma systems"
        url="/products/plasma-cleaner/compare"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="bg-surface-container-lowest text-on-surface py-12 border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6">
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'Compare All', path: '/products/plasma-cleaner/compare' }
          ]} />
          <div className="text-center mt-6">
          <h1 className="text-4xl font-bold mb-4">Compare All Plasma Cleaners</h1>
          <p className="text-lg text-on-surface-variant max-w-[700px] mx-auto leading-relaxed">
            HY Series & PLUTO Series — six models from $6,499 to $15,999
          </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-6">
          {/* Series Labels */}
          <div className="flex gap-4 justify-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm">
              <span className="w-3 h-3 rounded-full bg-primary"></span> HY Series
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tertiary/10 text-tertiary font-bold text-sm">
              <span className="w-3 h-3 rounded-full bg-tertiary"></span> PLUTO Series
            </span>
          </div>

          <div className="overflow-x-auto mb-12 rounded-xl shadow-md border border-outline-variant/20">
            <table className="w-full border-collapse bg-white min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-outline-variant/20">
                  <th className="p-5 text-left font-bold text-sm bg-surface-container-lowest w-[140px] sticky left-0 z-10">Feature</th>
                  <th className="p-5 text-center bg-primary/5 border-l border-outline-variant/10">
                    <Link to="/products/hy-4l" className="no-underline group">
                      <span className="text-xl font-bold text-primary block">HY-4L</span>
                      <span className="text-xs text-on-surface-variant block mt-1">Compact / Teaching</span>
                      <span className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                  <th className="p-5 text-center bg-tertiary/5 border-l border-outline-variant/10">
                    <Link to="/products/pluto-t" className="no-underline group">
                      <span className="text-xl font-bold text-tertiary block">PLUTO-T</span>
                      <span className="text-xs text-on-surface-variant block mt-1">Entry-Level RF</span>
                      <span className="text-xs text-tertiary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                  <th className="p-5 text-center bg-primary/5 border-l border-outline-variant/10">
                    <Link to="/products/hy-20l" className="no-underline group">
                      <span className="text-xl font-bold text-primary block">HY-20L</span>
                      <span className="text-xs text-on-surface-variant block mt-1">Core Research</span>
                      <span className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                  <th className="p-5 text-center bg-tertiary/5 border-l border-outline-variant/10">
                    <Link to="/products/pluto-m" className="no-underline group">
                      <span className="text-xl font-bold text-tertiary block">PLUTO-M</span>
                      <span className="text-xs text-on-surface-variant block mt-1">Mid-Range Batch</span>
                      <span className="text-xs text-tertiary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                  <th className="p-5 text-center bg-primary/5 border-l border-outline-variant/10">
                    <Link to="/products/hy-20lrf" className="no-underline group">
                      <span className="text-xl font-bold text-primary block">HY-20LRF</span>
                      <span className="text-xs text-on-surface-variant block mt-1">Integrated RF</span>
                      <span className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                  <th className="p-5 text-center bg-tertiary/5 border-l border-outline-variant/10">
                    <Link to="/products/pluto-f" className="no-underline group">
                      <span className="text-xl font-bold text-tertiary block">PLUTO-F</span>
                      <span className="text-xs text-on-surface-variant block mt-1">500W Flagship</span>
                      <span className="text-xs text-tertiary font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">Details <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Typical Use', values: ['Teaching / Validation', 'Single-sample / Small-batch', 'Core Research', 'Multi-sample Batch', 'Integrated Batch', 'Large-batch / Ashing'] },
                  { label: 'Chamber Volume', values: ['~4 L', '~4.3 L', '~20 L', '~8 L', '20 L', '~14.5 L'] },
                  { label: 'Chamber Material', values: ['Stainless Steel', 'Stainless Steel', 'Stainless Steel', 'Stainless Steel', 'Stainless Steel', 'Aluminum Alloy'] },
                  { label: 'RF Power', values: ['Adjustable', '200 W', 'Up to 300 W', '200 W', '300 W', '500 W'] },
                  { label: 'RF Frequency', values: ['13.56 MHz / 40 kHz', '13.56 MHz', '13.56 MHz / 40 kHz', '13.56 MHz', '13.56 MHz', '13.56 MHz'] },
                  { label: 'Gas Lines', values: ['1 standard', '1 (optional 2nd)', '1 standard', '2 standard', '1 standard', '2 standard'] },
                  { label: 'Recipe Storage', values: ['—', '—', 'Yes', 'Yes', 'Yes', 'Multi-step'] },
                  { label: 'Batch Processing', values: ['Small-volume', 'Small-volume', 'Full batch', 'Full batch', 'Full batch', 'Full batch'] },
                  { label: 'Control System', values: ['PLC + Touchscreen', 'Touchscreen', 'PLC + Touchscreen', 'Touchscreen', 'PLC + Touchscreen', 'Touchscreen'] },
                  { label: 'Price', values: ['From $6,499', '$9,999', 'From $11,999', '$12,999', '$14,499', '$15,999'] },
                ].map((row, i) => (
                  <tr key={row.label} className={`border-b border-outline-variant/10 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest/50'}`}>
                    <td className="p-4 font-semibold text-sm text-on-surface sticky left-0 z-10 bg-inherit">{row.label}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className={`p-4 text-center text-sm border-l border-outline-variant/10 ${j % 2 === 0 ? 'bg-primary/[0.02]' : 'bg-tertiary/[0.02]'} ${row.label === 'Batch Processing' && val === 'Full batch' ? 'text-primary font-semibold' : 'text-on-surface-variant'} ${row.label === 'Price' ? 'font-bold text-on-surface' : ''}`}>
                        {row.label === 'Batch Processing' && val === 'Full batch' ? (
                          <><span className="material-symbols-outlined text-primary text-base align-middle mr-1" style={{ fontSize: '16px' }}>check_circle</span>{val}</>
                        ) : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center p-8 bg-white rounded-lg shadow-sm max-w-[800px] mx-auto mb-12">
            <p className="text-lg text-on-surface-variant italic leading-relaxed m-0">
              Many laboratories begin with an entry-level system and upgrade as their process requirements evolve.
            </p>
          </div>

          {/* CTA Cards — 2 rows of 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1200px] mx-auto">
            {[
              { name: 'HY-4L', path: '/products/hy-4l', desc: 'Teaching, validation, exploratory research', series: 'hy' },
              { name: 'PLUTO-T', path: '/products/pluto-t', desc: 'Single-sample RF cleaning under $10K', series: 'pluto' },
              { name: 'HY-20L', path: '/products/hy-20l', desc: 'Core research with batch processing', series: 'hy' },
              { name: 'PLUTO-M', path: '/products/pluto-m', desc: 'Multi-sample batch with recipe storage', series: 'pluto' },
              { name: 'HY-20LRF', path: '/products/hy-20lrf', desc: 'Integrated RF batch processing', series: 'hy' },
              { name: 'PLUTO-F', path: '/products/pluto-f', desc: '500W flagship for demanding applications', series: 'pluto' },
            ].map(product => (
              <div key={product.name} className={`bg-white p-8 rounded-xl shadow-sm text-center hover:-translate-y-1 hover:shadow-lg transition-all border-t-4 ${product.series === 'hy' ? 'border-primary' : 'border-tertiary'}`}>
                <h3 className={`text-xl font-bold mb-3 ${product.series === 'hy' ? 'text-primary' : 'text-tertiary'}`}>{product.name}</h3>
                <p className="text-on-surface-variant text-sm mb-5 leading-relaxed">{product.desc}</p>
                <Link to={product.path} className={`inline-flex items-center justify-center w-full px-5 py-2.5 rounded-lg font-medium transition-colors no-underline text-sm ${product.series === 'hy' ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-tertiary text-white hover:bg-tertiary/90'}`}>
                  View {product.name} →
                </Link>
              </div>
            ))}
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
