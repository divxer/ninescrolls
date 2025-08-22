import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { insightsPosts, InsightsPost } from '../types';
import '../styles/InsightsPostPage.css';

export const InsightsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const analytics = useCombinedAnalytics();
  const [post, setPost] = useState<InsightsPost | null>(null);
  const [loading, setLoading] = useState(true);

  // Scroll to top when component mounts or slug changes
  useScrollToTop([slug]);

  useEffect(() => {
    const foundPost = insightsPosts.find(p => p.slug === slug);
    setTimeout(() => {
      setPost(foundPost || null);
      setLoading(false);
    }, 500);

    if (foundPost) {
      analytics.segment.trackWithSimpleIPAnalysis('Insights Post Viewed', {
        slug: slug,
        postTitle: foundPost.title,
        category: foundPost.category
      });
    }
  }, [slug, analytics]);

  if (loading) {
    return (
      <div className="insights-post-page">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!post) {
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
        title={post.title}
        description={post.slug === 'plasma-etching' 
          ? `What is plasma etching? Learn how plasma etching works, its applications in semiconductor manufacturing, and the differences between RIE, ICP, and other etching techniques. Expert guide with 12 min read.`
          : `${post.title} - Comprehensive comparison of Plasma Etching (PE), Reactive Ion Etching (RIE), and Inductively Coupled Plasma Reactive Ion Etching (ICP-RIE) technologies. Learn about plasma density, operating pressure, selectivity, and applications in semiconductor manufacturing and MEMS.`
        }
        keywords={post.slug === 'plasma-etching'
          ? `plasma etching, what is plasma etching, how does plasma etching work, RIE etching, ICP etching, semiconductor manufacturing, dry etching, plasma etching machine, plasma etcher, etching technology`
          : `${post.tags.join(', ')}, plasma etching, semiconductor manufacturing, MEMS, thin film processing, etching technology, ICP-RIE, RIE, PE etching`
        }
        image={post.imageUrl}
        url={`/insights/${post.slug}`}
        type="article"
      />
      {post.slug === 'plasma-etching' && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": "What is plasma etching? Learn how plasma etching works, its applications in semiconductor manufacturing, and the differences between RIE, ICP, and other etching techniques.",
            "image": `https://ninescrolls.com${post.imageUrl}`,
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
            "datePublished": post.publishDate,
            "dateModified": post.publishDate,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://ninescrolls.com/insights/${post.slug}`
            },
            "keywords": "plasma etching, what is plasma etching, how does plasma etching work, RIE etching, ICP etching, semiconductor manufacturing",
            "articleSection": "Materials Science",
            "wordCount": "2500+",
            "timeRequired": `PT${post.readTime}M`
          })}
        </script>
      )}
      <div className="insights-post-page">
        {/* Hero Section */}
        <section className="insights-post-hero">
          <div className="container">
            <div className="hero-content">
              <div className="hero-text">
                <h1 className="insights-post-title">{post.title}</h1>
                <div className="insights-post-meta">
                  <span className="author">{post.author}</span>
                  <span className="date">{new Date(post.publishDate).toLocaleDateString()}</span>
                  <span className="category">{post.category}</span>
                  <span className="read-time">{post.readTime} min read</span>
                </div>
              </div>
              <div className="hero-image">
                <img src={post.imageUrl} alt={post.title} />
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="insights-post-content">
          <div className="container">
            <div className="content-wrapper">
              <div className="main-content">
                {post.content && (
                  <div 
                    className="post-content"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                )}
                
                {/* Tags */}
                <div className="post-tags">
                  <h3>Tags:</h3>
                  <div className="tags">
                    {post.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>

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
                    {post.slug === 'hdp-cvd-in-depth-guide-practical-handbook' ? (
                      <>
                        <li><a href="/products/hdp-cvd">HDP-CVD Systems</a></li>
                        <li><a href="/products/pecvd">PECVD Systems</a></li>
                        <li><a href="/products/ald">ALD Systems</a></li>
                        <li><a href="/products/sputter">Sputter Systems</a></li>
                      </>
                    ) : post.slug === 'plasma-cleaning-precision-surface-preparation' ? (
                      <>
                        <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                        <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                        <li><a href="/products/pecvd">PECVD Systems</a></li>
                        <li><a href="/products/ald">ALD Systems</a></li>
                      </>
                    ) : post.slug === 'plasma-etching-explained-fundamentals-applications' ? (
                      <>
                        <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                        <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                        <li><a href="/products/striper">Striper Systems</a></li>
                        <li><a href="/products/pecvd">PECVD Systems</a></li>
                      </>
                    ) : post.slug === 'understanding-differences-pe-rie-icp-rie-plasma-etching' ? (
                      <>
                        <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                        <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                        <li><a href="/products/striper">Striper Systems</a></li>
                        <li><a href="/products/pecvd">PECVD Systems</a></li>
                      </>
                    ) : post.slug === 'plasma-etching' ? (
                      <>
                        <li><a href="/products/icp-etcher">ICP Etching Systems</a></li>
                        <li><a href="/products/rie-etcher">RIE Etching Systems</a></li>
                        <li><a href="/products/ibe-ribe">IBE/RIBE Systems</a></li>
                        <li><a href="/products/striper">Striper Systems</a></li>
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default InsightsPostPage; 