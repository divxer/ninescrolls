import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPost, useNewsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import type { InsightsPost } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import '../styles/NewsPostPage.css';

// ─── Helper Components ───────────────────────────────────────────────────────

function hasValidImage(url: string): boolean {
  return Boolean(url) && !url.startsWith('/assets/images/news/');
}

function NewsHeroImage({ post }: { post: InsightsPost }) {
  const url = post.imageUrl;

  // CDN URLs (e.g. https://cdn/insights/slug/cover-lg): render responsive <picture>
  if (url.startsWith('http') && url.endsWith('-lg')) {
    const base = url.slice(0, -3);
    return (
      <picture>
        <source srcSet={`${base}-xl.webp`} media="(min-width: 1280px)" type="image/webp" />
        <source srcSet={`${base}-lg.webp`} media="(min-width: 1024px)" type="image/webp" />
        <source srcSet={`${base}-md.webp`} media="(min-width: 768px)" type="image/webp" />
        <source srcSet={`${base}-sm.webp`} media="(max-width: 767px)" type="image/webp" />
        <img src={`${base}-lg.webp`} alt={post.title} loading="eager" fetchPriority="high" decoding="sync" />
      </picture>
    );
  }

  return <img src={url} alt={post.title} loading="eager" fetchPriority="high" />;
}

function RelatedNewsSidebar({ post, allPosts }: { post: InsightsPost; allPosts: InsightsPost[] }) {
  const related = rankRelatedInsights(allPosts, post, 4);
  if (related.length === 0) return null;
  return (
    <div className="news-related">
      <h3>Related News</h3>
      <div className="news-related-list">
        {related.map(rp => (
          <a key={rp.slug} href={`/news/${rp.slug}`} className="news-related-item">
            <span className="news-related-title">{rp.title}</span>
            <time dateTime={rp.publishDate}>
              {new Date(rp.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </time>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const NewsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  useScrollToTop([slug]);

  const { post, loading } = useInsightsPost(slug);
  const { posts: allNewsPosts } = useNewsPosts();

  if (loading) {
    return (
      <div className="news-post-page">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="news-post-page">
        <div className="container">
          <div className="error">Article not found</div>
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
        url={`/news/${post.slug}`}
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
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
            "dateModified": post.lastModifiedDate || post.publishDate,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://ninescrolls.com/news/${post.slug}`
            },
            "articleSection": post.category,
            "timeRequired": `PT${post.readTime}M`
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ninescrolls.com/" },
              { "@type": "ListItem", "position": 2, "name": "News", "item": "https://ninescrolls.com/news" },
              { "@type": "ListItem", "position": 3, "name": post.title }
            ]
          })}
        </script>
      </Helmet>
      <div className="news-post-page">
        {/* Breadcrumb */}
        <nav className="news-breadcrumb" aria-label="Breadcrumb">
          <div className="container">
            <ol>
              <li><a href="/">Home</a></li>
              <li><a href="/news">News</a></li>
              <li aria-current="page">{post.title}</li>
            </ol>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="news-post-hero">
          <div className="container">
            <div className={`news-hero-content ${hasValidImage(post.imageUrl) ? '' : 'news-hero-no-image'}`}>
              <div className="news-hero-text">
                <div className="news-post-meta-top">
                  <span className="news-post-category">{post.category}</span>
                  <time dateTime={post.publishDate}>
                    {new Date(post.publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </time>
                </div>
                <h1 className="news-post-title">{post.title}</h1>
                <div className="news-post-meta">
                  <span className="author">{post.author}</span>
                  <span className="read-time">{post.readTime} min read</span>
                </div>
              </div>
              {hasValidImage(post.imageUrl) && (
                <div className="news-hero-image">
                  <NewsHeroImage post={post} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="news-post-content">
          <div className="news-content-wrapper">
            <div className="news-main-content">
              {post.content ? (
                <div
                  className="post-content"
                  dangerouslySetInnerHTML={{ __html: post.content.replace(/&nbsp;|\u00a0/g, ' ') }}
                />
              ) : null}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="post-tags">
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
          </div>

          {/* Related News */}
          <div className="news-content-wrapper">
            <RelatedNewsSidebar post={post} allPosts={allNewsPosts} />
          </div>
        </section>
      </div>
    </>
  );
};

export default NewsPostPage;
