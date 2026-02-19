import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPost, useInsightsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import type { InsightsPost, RelatedProduct } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import { PlasmaCleanerComparisonPage } from './PlasmaCleanerComparisonPage';
import '../styles/InsightsPostPage.css';

// Consolidated article redirects: weaker → stronger article
const ARTICLE_REDIRECTS: Record<string, string> = {
  'plasma-etching': 'plasma-etching-explained-fundamentals-applications',
  'plasma-cleaning-precision-surface-preparation': 'what-is-plasma-cleaner-principles-types',
};

// ─── Helper Components ───────────────────────────────────────────────────────

function InsightsHeroImage({ post }: { post: InsightsPost }) {
  if (post.heroImages) {
    const { prefix, fallbackExt } = post.heroImages;
    return (
      <picture>
        <source srcSet={`/assets/images/insights/${prefix}-xl.webp`} media="(min-width: 1280px)" type="image/webp" />
        <source srcSet={`/assets/images/insights/${prefix}-lg.webp`} media="(min-width: 1024px)" type="image/webp" />
        <source srcSet={`/assets/images/insights/${prefix}-md.webp`} media="(min-width: 768px)" type="image/webp" />
        <source srcSet={`/assets/images/insights/${prefix}-sm.webp`} media="(max-width: 767px)" type="image/webp" />
        <img src={`/assets/images/insights/${prefix}-lg.${fallbackExt}`} alt={post.title} loading="eager" fetchPriority="high" decoding="sync" />
      </picture>
    );
  }
  return <img src={post.imageUrl} alt={post.title} loading="eager" fetchPriority="high" />;
}

function RelatedProductsSidebar({ products }: { products?: RelatedProduct[] }) {
  if (!products || products.length === 0) return null;
  return (
    <div className="related-products">
      <h3>Related Products</h3>
      <ul>
        {products.map(p => (
          <li key={p.href}>
            <a href={p.href}>{p.label}</a>
            {p.subtitle && <span className="product-mini">{p.subtitle}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelatedArticlesSidebar({ post, allPosts }: { post: InsightsPost; allPosts: InsightsPost[] }) {
  const related = rankRelatedInsights(allPosts, post, 4);
  if (related.length === 0) return null;
  return (
    <div className="related-articles">
      <h3>Related Articles</h3>
      <ul>
        {related.map(rp => (
          <li key={rp.slug}><a href={`/insights/${rp.slug}`}>{rp.title}</a></li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const InsightsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // Resolve redirect slug to avoid fetching redirect entries
  const resolvedSlug = slug && ARTICLE_REDIRECTS[slug] ? undefined : slug;
  const isRedirect = slug ? !!ARTICLE_REDIRECTS[slug] : false;

  // Scroll to top when component mounts or slug changes
  useScrollToTop([slug]);

  const { post, loading } = useInsightsPost(resolvedSlug);
  const { posts: allPosts } = useInsightsPosts();

  // Handle consolidated article redirects (client-side)
  if (isRedirect && slug) {
    return <Navigate to={`/insights/${ARTICLE_REDIRECTS[slug]}`} replace />;
  }

  const isStandaloneComponent = post?.isStandaloneComponent ?? false;

  // Note: Page view is automatically tracked by SegmentAnalytics component

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
        description={post.excerpt || post.title}
        keywords={post.tags?.join(', ') || ''}
        image={post.imageUrl}
        url={`/insights/${post.slug}`}
        type="article"
      />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": post.excerpt || post.title,
          "image": `https://ninescrolls.com${post.imageUrl}`,
          "author": {
            "@type": "Organization",
            "name": "NineScrolls",
            "url": "https://ninescrolls.com/about"
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
          "keywords": post.tags?.join(', ') || '',
          "articleSection": post.category,
          "timeRequired": `PT${post.readTime}M`
        })}
      </script>
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
                <InsightsHeroImage post={post} />
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="insights-post-content">
          {isStandaloneComponent ? (
            /* Two-stage layout with unified alignment */
            <div className="content-container-unified">
              <div className="content-wrapper-top">
                <div className="main-content">
                  <PlasmaCleanerComparisonPage />
                </div>
                <div className="sidebar">
                  <RelatedProductsSidebar products={post.relatedProducts} />
                  <RelatedArticlesSidebar post={post} allPosts={allPosts} />
                </div>
              </div>
            </div>
          ) : (
            /* Standard single-column layout for regular posts */
            <div className="content-wrapper">
              <div className="main-content">
                {post.content ? (
                  <div
                    className="post-content"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                ) : null}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="post-tags">
                    <h3>Tags:</h3>
                    <div className="tags">
                      {post.tags.map(tag => (
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
                <RelatedProductsSidebar products={post.relatedProducts} />
                <RelatedArticlesSidebar post={post} allPosts={allPosts} />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default InsightsPostPage;
