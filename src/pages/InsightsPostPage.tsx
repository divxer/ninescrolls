import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { insightsPosts, InsightsPost } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import { PlasmaCleanerComparisonPage } from './PlasmaCleanerComparisonPage';
import '../styles/InsightsPostPage.css';

export const InsightsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<InsightsPost | null>(null);
  const [loading, setLoading] = useState(true);

  // Scroll to top when component mounts or slug changes
  useScrollToTop([slug]);

  useEffect(() => {
    // Special handling for standalone component pages
    if (slug === 'plasma-cleaner-comparison-research-labs') {
      const foundPost = insightsPosts.find(p => p.slug === slug);
      if (foundPost) {
        setPost(foundPost);
      }
      setLoading(false);
      return;
    }
    
    const foundPost = insightsPosts.find(p => p.slug === slug);
    setTimeout(() => {
      setPost(foundPost || null);
      setLoading(false);
    }, 500);

    // Note: Page view is automatically tracked by SegmentAnalytics component
    // No need for separate TRACK event - PAGE event already includes:
    // - Full IP analysis with behavior scoring
    // - Time on site
    // - Target customer detection
    // - Pathname (which identifies the article)
    // If you need article-specific data in Segment, you can add it to PAGE event properties
  }, [slug]);

  // Special handling for standalone component pages
  // For these pages, we still show the standard hero section, then render the custom content
  const isStandaloneComponent = slug === 'plasma-cleaner-comparison-research-labs';

  if (loading) {
    return (
      <div className="insights-post-page">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  // Use post data (set in useEffect)
  const displayPost = post;

  // For standalone components, we can still render even if post data is missing
  // (it will use fallback values)
  if (!displayPost && !isStandaloneComponent) {
    return (
      <div className="insights-post-page">
        <div className="container">
          <div className="error">Post not found</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={displayPost?.title || (isStandaloneComponent ? 'Plasma Cleaner Comparison for Research Laboratories' : 'Insights')}
        description={
          displayPost?.slug === 'reactive-ion-etching-guide'
            ? 'Reactive Ion Etching (RIE) guide: principles, process control, system types (CCP/ICP/DRIE), applications, and equipment selection.'
            : displayPost?.slug === 'deep-reactive-ion-etching-bosch-process'
            ? 'Deep Reactive Ion Etching (DRIE) and the Bosch process: cycles, applications, defects and mitigations, ICP‑DRIE notes.'
            : displayPost?.slug === 'icp-rie-technology-advanced-etching'
            ? 'ICP‑RIE technology: high‑density plasma etching, independent control of plasma density and ion energy, applications and benefits.'
            : displayPost?.slug === 'reactive-ion-etching-vs-ion-milling'
            ? 'Reactive Ion Etching vs Ion Milling: principle comparison, precision/throughput trade‑offs, and selection guide.'
            : displayPost?.slug === 'semiconductor-etchers-overview'
            ? 'Semiconductor etchers overview: RIE/ICP/DRIE categories, research vs production considerations, and equipment comparison.'
            : displayPost?.slug === 'plasma-etching'
            ? 'What is plasma etching? Principles, techniques and applications; differences between RIE, ICP and other methods.'
            : displayPost?.slug === 'plasma-cleaner-comparison-research-labs' || isStandaloneComponent
            ? 'Compare plasma cleaners for academic labs. Quartz vs stainless steel, RF vs MF, and batch plasma cleaner selection guide.'
            : displayPost?.excerpt || `${displayPost?.title}`
        }
        keywords={displayPost?.tags?.join(', ') || (isStandaloneComponent ? 'plasma cleaner comparison, plasma cleaner for research laboratories' : '')}
        image={displayPost?.imageUrl || (isStandaloneComponent ? '/assets/images/insights/plasma-cleaner-comparison-cover-lg.png' : undefined)}
        url={`/insights/${displayPost?.slug || slug || ''}`}
        type="article"
      />
      {((displayPost?.slug === 'plasma-etching' || displayPost?.slug === 'reactive-ion-etching-guide' || displayPost?.slug === 'plasma-cleaner-comparison-research-labs' || isStandaloneComponent) && (displayPost || isStandaloneComponent)) && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": displayPost?.title || (isStandaloneComponent ? 'Plasma Cleaner Comparison for Research Laboratories' : ''),
            "description": displayPost?.slug === 'plasma-etching' ?
              'What is plasma etching? Learn how plasma etching works, its applications in semiconductor manufacturing, and the differences between RIE, ICP, and other etching techniques.' :
              displayPost?.slug === 'reactive-ion-etching-guide' ?
              'Reactive Ion Etching (RIE) guide: principles, system types and selection, process control, and applications.' :
              'Compare plasma cleaners for academic labs. Quartz vs stainless steel, RF vs MF, and batch plasma cleaner selection guide.',
            "image": `https://ninescrolls.com${displayPost?.imageUrl || (isStandaloneComponent ? '/assets/images/insights/plasma-cleaner-comparison-cover-lg.png' : '')}`,
            "author": {
              "@type": "Organization",
              "name": "NineScrolls Team"
            },
            "publisher": {
              "@type": "Organization",
              "name": "NineScrolls",
              "logo": {
                "@type": "ImageObject",
                "url": "https://ninescrolls.com/assets/images/logo.png"
              }
            },
            "datePublished": displayPost?.publishDate || (isStandaloneComponent ? '2025-01-15' : ''),
            "dateModified": displayPost?.publishDate || (isStandaloneComponent ? '2025-01-15' : ''),
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://ninescrolls.com/insights/${displayPost?.slug || slug || ''}`
            },
            "keywords": (displayPost?.slug === 'plasma-cleaner-comparison-research-labs' || isStandaloneComponent)
              ? "plasma cleaner comparison, plasma cleaner for research laboratories, RF plasma cleaner vs quartz plasma cleaner, batch plasma cleaner academic lab, research grade plasma cleaner"
              : "plasma etching, what is plasma etching, how does plasma etching work, RIE etching, ICP etching, semiconductor manufacturing",
            "articleSection": displayPost?.category || (isStandaloneComponent ? 'Materials Science' : ''),
            "wordCount": "2500+",
            "timeRequired": `PT${displayPost?.readTime || (isStandaloneComponent ? 8 : 0)}M`
          })}
        </script>
      )}
      <div className="insights-post-page">
        {/* Hero Section */}
        <section className="insights-post-hero">
          <div className="container">
            <div className="hero-content">
              <div className="hero-text">
                <h1 className="insights-post-title">{displayPost?.title || (isStandaloneComponent ? 'Plasma Cleaner Comparison for Research Laboratories' : '')}</h1>
                <div className="insights-post-meta">
                  <span className="author">{displayPost?.author || (isStandaloneComponent ? 'NineScrolls Team' : '')}</span>
                  <span className="date">{displayPost ? new Date(displayPost.publishDate).toLocaleDateString() : (isStandaloneComponent ? new Date('2025-01-15').toLocaleDateString() : '')}</span>
                  <span className="category">{displayPost?.category || (isStandaloneComponent ? 'Materials Science' : '')}</span>
                  <span className="read-time">{displayPost?.readTime || (isStandaloneComponent ? 8 : 0)} min read</span>
                </div>
              </div>
              <div className="hero-image">
                {displayPost?.slug === 'deep-reactive-ion-etching-bosch-process' ? (
                  <picture>
                    <source srcSet="/assets/images/insights/drie-cover-xl.webp" media="(min-width: 1280px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/drie-cover-lg.webp" media="(min-width: 1024px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/drie-cover-md.webp" media="(min-width: 768px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/drie-cover-sm.webp" media="(max-width: 767px)" type="image/webp" />
                    <img src="/assets/images/insights/drie-cover-lg.png" alt={displayPost?.title || ''} loading="eager" fetchPriority="high" decoding="sync" />
                  </picture>
                ) : displayPost?.slug === 'icp-rie-technology-advanced-etching' ? (
                  <picture>
                    <source srcSet="/assets/images/insights/icp-rie-cover-xl.webp" media="(min-width: 1280px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/icp-rie-cover-lg.webp" media="(min-width: 1024px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/icp-rie-cover-md.webp" media="(min-width: 768px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/icp-rie-cover-sm.webp" media="(max-width: 767px)" type="image/webp" />
                    <img src="/assets/images/insights/icp-rie-cover-lg.png" alt={displayPost?.title || ''} loading="eager" fetchPriority="high" decoding="sync" />
                  </picture>
                ) : displayPost?.slug === 'reactive-ion-etching-vs-ion-milling' ? (
                  <picture>
                    <source srcSet="/assets/images/insights/rie-vs-milling-cover-xl.webp" media="(min-width: 1280px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/rie-vs-milling-cover-lg.webp" media="(min-width: 1024px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/rie-vs-milling-cover-md.webp" media="(min-width: 768px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/rie-vs-milling-cover-sm.webp" media="(max-width: 767px)" type="image/webp" />
                    <img src="/assets/images/insights/rie-vs-milling-cover-lg.png" alt={displayPost?.title || ''} loading="eager" fetchPriority="high" decoding="sync" />
                  </picture>
                ) : displayPost?.slug === 'semiconductor-etchers-overview' ? (
                  <picture>
                    <source srcSet="/assets/images/insights/etchers-overview-cover-xl.webp" media="(min-width: 1280px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/etchers-overview-cover-lg.webp" media="(min-width: 1024px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/etchers-overview-cover-md.webp" media="(min-width: 768px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/etchers-overview-cover-sm.webp" media="(max-width: 767px)" type="image/webp" />
                    <img src="/assets/images/insights/etchers-overview-cover-lg.png" alt={displayPost?.title || ''} loading="eager" fetchPriority="high" decoding="sync" />
                  </picture>
                ) : displayPost?.slug === 'plasma-cleaner-comparison-research-labs' || isStandaloneComponent ? (
                  <picture>
                    <source srcSet="/assets/images/insights/plasma-cleaner-comparison-cover-xl.webp" media="(min-width: 1280px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/plasma-cleaner-comparison-cover-lg.webp" media="(min-width: 1024px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/plasma-cleaner-comparison-cover-md.webp" media="(min-width: 768px)" type="image/webp" />
                    <source srcSet="/assets/images/insights/plasma-cleaner-comparison-cover-sm.webp" media="(max-width: 767px)" type="image/webp" />
                    <img src="/assets/images/insights/plasma-cleaner-comparison-cover-lg.png" alt={displayPost?.title || 'Plasma Cleaner Comparison for Research Laboratories'} loading="eager" fetchPriority="high" decoding="sync" />
                  </picture>
                ) : (
                  <img src={displayPost?.imageUrl || ''} alt={displayPost?.title || ''} loading="eager" fetchPriority="high" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="insights-post-content">
          {isStandaloneComponent ? (
            /* Two-stage layout with unified alignment */
            <div className="content-container-unified">
              {/* Top Section: Two-column layout with sidebar (TL;DR, TOC, Introduction) */}
              <div className="content-wrapper-top">
                <div className="main-content">
                  <PlasmaCleanerComparisonPage />
                </div>
                <div className="sidebar">
                    <div className="related-products">
                      <h3>Related Products</h3>
                      <ul>
                        {displayPost?.slug === 'hdp-cvd-in-depth-guide-practical-handbook' ? (
                          <>
                            <li><a href="/products/hdp-cvd">HDP-CVD Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                            <li><a href="/products/ald">ALD Systems</a></li>
                            <li><a href="/products/sputter">Sputter Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'reactive-ion-etching-guide' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'deep-reactive-ion-etching-bosch-process' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'icp-rie-technology-advanced-etching' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'reactive-ion-etching-vs-ion-milling' ? (
                          <>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/sputter">Sputter Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'semiconductor-etchers-overview' ? (
                          <>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'plasma-cleaning-precision-surface-preparation' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                            <li><a href="/products/ald">ALD Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'plasma-etching-explained-fundamentals-applications' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'understanding-differences-pe-rie-icp-rie-plasma-etching' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'plasma-etching' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                            <li><a href="/products/striper">Striper Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'plasma-non-uniform-etch-chamber-solutions' ? (
                          <>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                            <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                            <li><a href="/products/ald">ALD Systems</a></li>
                          </>
                        ) : displayPost?.slug === 'plasma-cleaner-comparison-research-labs' ? (
                          <>
                            <li>
                              <a href="/products/ns-plasma-4r">NS-Plasma 4R</a>
                              <span className="product-mini">Compact / Teaching / Validation</span>
                            </li>
                            <li>
                              <a href="/products/ns-plasma-20r">NS-Plasma 20R</a>
                              <span className="product-mini">Core Research / Batch Processing</span>
                            </li>
                            <li>
                              <a href="/products/ns-plasma-20r-i">NS-Plasma 20R-I</a>
                              <span className="product-mini">Integrated / Batch Processing</span>
                            </li>
                            <li style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
                              <a href="/products/plasma-systems" style={{ fontSize: '0.9rem', color: '#667eea' }}>View all plasma systems →</a>
                            </li>
                          </>
                        ) : (
                          <>
                            <li><a href="/products/striper">Striper Systems</a></li>
                            <li><a href="/products/pecvd">PECVD Systems</a></li>
                            <li><a href="/products/ald">ALD Systems</a></li>
                            <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          </>
                        )}
                      </ul>
                    </div>
                    <div className="related-articles">
                      <h3>Related Articles</h3>
                      <ul>
                        {displayPost && rankRelatedInsights(insightsPosts, displayPost, 4).map(rp => (
                          <li key={rp.slug}><a href={`/insights/${rp.slug}`}>{rp.title}</a></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard single-column layout for regular posts */
              <div className="content-wrapper">
                <div className="main-content">
                  {post?.content ? (
                    <div 
                      className="post-content"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                  ) : null}
                  
                  {/* Tags */}
                  {displayPost?.tags && displayPost.tags.length > 0 && (
                    <div className="post-tags">
                      <h3>Tags:</h3>
                      <div className="tags">
                        {displayPost.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share Buttons */}
                  <div className="share-section">
                    <h3>Share this article:</h3>
                    <div className="share-buttons">
                      <button className="share-btn twitter">Twitter</button>
                      <button className="share-btn linkedin">LinkedIn</button>
                      <button className="share-btn email">Email</button>
                    </div>
                  </div>
                </div>

                <div className="sidebar">
                  <div className="related-products">
                    <h3>Related Products</h3>
                    <ul>
                      {displayPost?.slug === 'hdp-cvd-in-depth-guide-practical-handbook' ? (
                        <>
                          <li><a href="/products/hdp-cvd">HDP-CVD Systems</a></li>
                          <li><a href="/products/pecvd">PECVD Systems</a></li>
                          <li><a href="/products/ald">ALD Systems</a></li>
                          <li><a href="/products/sputter">Sputter Systems</a></li>
                        </>
                      ) : post?.slug === 'reactive-ion-etching-guide' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'deep-reactive-ion-etching-bosch-process' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'icp-rie-technology-advanced-etching' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'reactive-ion-etching-vs-ion-milling' ? (
                        <>
                          <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/sputter">Sputter Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'semiconductor-etchers-overview' ? (
                        <>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'plasma-cleaning-precision-surface-preparation' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/pecvd">PECVD Systems</a></li>
                          <li><a href="/products/ald">ALD Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'plasma-etching-explained-fundamentals-applications' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                          <li><a href="/products/pecvd">PECVD Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'understanding-differences-pe-rie-icp-rie-plasma-etching' ? (
                        <>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                          <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                          <li><a href="/products/striper">Striper Systems</a></li>
                          <li><a href="/products/pecvd">PECVD Systems</a></li>
                        </>
                      ) : displayPost?.slug === 'plasma-etching' ? (
                         <>
                           <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                           <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                           <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                           <li><a href="/products/striper">Striper Systems</a></li>
                         </>
                       ) : displayPost?.slug === 'plasma-non-uniform-etch-chamber-solutions' ? (
                         <>
                           <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                           <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                           <li><a href="/products/pecvd">PECVD Systems</a></li>
                           <li><a href="/products/ald">ALD Systems</a></li>
                         </>
                       ) : (
                        <>
                          <li><a href="/products/striper">Striper Systems</a></li>
                          <li><a href="/products/pecvd">PECVD Systems</a></li>
                          <li><a href="/products/ald">ALD Systems</a></li>
                          <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="related-articles">
                    <h3>Related Articles</h3>
                    <ul>
                      {displayPost && rankRelatedInsights(insightsPosts, displayPost, 4).map(rp => (
                        <li key={rp.slug}><a href={`/insights/${rp.slug}`}>{rp.title}</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
        </section>
      </div>
    </>
  );
};

export default InsightsPostPage; 