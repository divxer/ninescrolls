import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { cdnUrl, CDN_BASE_URL } from '../config/imageConfig';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPost, useNewsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { TableOfContents } from '../components/common/TableOfContents';
import type { InsightsPost } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import { ArticleQASection, FloatingAskButton } from '../components/insights/ArticleQASection';
import '../styles/article-content.css';

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Rewrite /assets/images/ paths in HTML content to CDN URLs */
function rewriteContentImages(html: string): string {
  if (!CDN_BASE_URL) return html;
  return html.replace(
    /((?:src|srcSet)\s*=\s*")\/assets\/images\//g,
    `$1${CDN_BASE_URL}/`,
  );
}

/** Strip inline "Table of Contents" heading + its following <ul> from HTML content */
function stripInlineToc(html: string): string {
  return html.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
}

// ─── Helper Components ───────────────────────────────────────────────────────

function hasValidImage(url: string): boolean {
  if (!url) return false;
  // Placeholder paths like /assets/images/news/some-slug have no file extension
  if (url.startsWith('/assets/images/news/') && !/\.\w+$/.test(url)) return false;
  return true;
}

function NewsHeroImage({ post }: { post: InsightsPost }) {
  // Prefer heroImages metadata when available (authoritative responsive config)
  if (post.heroImages?.prefix) {
    const { prefix, fallbackExt } = post.heroImages;
    return (
      <picture>
        <source srcSet={`${prefix}-xl.webp`} media="(min-width: 1280px)" type="image/webp" />
        <source srcSet={`${prefix}-lg.webp`} media="(min-width: 1024px)" type="image/webp" />
        <source srcSet={`${prefix}-md.webp`} media="(min-width: 768px)" type="image/webp" />
        <source srcSet={`${prefix}-sm.webp`} media="(max-width: 767px)" type="image/webp" />
        <img src={`${prefix}-lg.${fallbackExt || 'webp'}`} alt={post.title} loading="eager" fetchPriority="high" decoding="sync" />
      </picture>
    );
  }

  const url = post.imageUrl;

  // Fallback: infer responsive variants from CDN URL shape (e.g. .../cover-lg)
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

  return <img src={cdnUrl(url)} alt={post.title} loading="eager" fetchPriority="high" />;
}

function RelatedNewsSidebar({ post, allPosts }: { post: InsightsPost; allPosts: InsightsPost[] }) {
  const related = rankRelatedInsights(allPosts, post, 4);
  if (related.length === 0) return null;
  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-5">
      <h3 className="text-base font-semibold text-on-surface mb-3">Related News</h3>
      <div className="flex flex-col gap-2">
        {related.map(rp => (
          <a
            key={rp.slug}
            href={`/news/${rp.slug}`}
            className="flex flex-col gap-1 p-2.5 px-3 bg-surface-container-lowest rounded-md border-l-[3px] border-teal-500 no-underline hover:bg-slate-100 transition-colors"
          >
            <span className="text-on-surface font-medium text-sm leading-snug">{rp.title}</span>
            <time className="text-slate-400 text-xs" dateTime={rp.publishDate}>
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
      <div className="min-h-screen bg-surface-container-lowest">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-surface-container-lowest">
        <div className="max-w-[1200px] mx-auto px-5">
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
      <div className="min-h-screen bg-surface-container-lowest">
        {/* Breadcrumb */}
        <nav className="bg-slate-800 py-3" aria-label="Breadcrumb">
          <div className="max-w-[1200px] mx-auto px-5">
            <ol className="list-none m-0 p-0 flex items-center text-sm">
              <li className="flex items-center text-slate-400">
                <a href="/" className="text-slate-300 no-underline hover:text-white transition-colors">Home</a>
                <span className="mx-2.5 text-slate-500">&rsaquo;</span>
              </li>
              <li className="flex items-center text-slate-400">
                <a href="/news" className="text-slate-300 no-underline hover:text-white transition-colors">News</a>
                <span className="mx-2.5 text-slate-500">&rsaquo;</span>
              </li>
              <li className="flex items-center text-slate-200 font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-[400px]" aria-current="page">
                {post.title}
              </li>
            </ol>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="bg-white border-b border-outline-variant/20 py-10">
          <div className="max-w-[1200px] mx-auto px-5">
            <div className={`grid gap-10 items-center ${hasValidImage(post.imageUrl) ? 'grid-cols-2 max-md:grid-cols-1' : 'grid-cols-1'}`}>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-xl font-semibold text-xs uppercase tracking-wide">{post.category}</span>
                  <time className="text-on-surface-variant text-sm" dateTime={post.publishDate}>
                    {new Date(post.publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </time>
                </div>
                <h1 className="text-3xl font-bold text-on-surface leading-snug mb-4">{post.title}</h1>
                <div className="flex gap-5 text-on-surface-variant text-sm">
                  <span>{post.author}</span>
                  <span>{post.readTime} min read</span>
                </div>
              </div>
              {hasValidImage(post.imageUrl) && (
                <div className="rounded-lg overflow-hidden">
                  <NewsHeroImage post={post} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-10 pb-20">
          <div className="grid grid-cols-[2.5fr_1fr] gap-10 max-w-[1280px] mx-auto px-5 max-lg:grid-cols-1">
            <div className="bg-white rounded-lg p-10 shadow-sm max-md:p-6 min-w-0 overflow-x-hidden">
              {post.content ? (
                <div
                  className="post-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rewriteContentImages(stripInlineToc(post.content.replace(/&nbsp;|\u00a0/g, ' '))), { ADD_TAGS: ['picture', 'source'], ADD_ATTR: ['srcset', 'media', 'loading', 'decoding', 'fetchpriority'] }) }}
                />
              ) : null}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="mt-8 pt-5 border-t border-outline-variant/20">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map(tag => (
                      <span key={tag} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Share Buttons */}
              <div className="mt-8 pt-5 border-t border-outline-variant/20">
                <h3 className="text-sm mb-3 text-on-surface-variant">Share this article:</h3>
                <div className="flex gap-2.5">
                  <button className="px-4 py-1.5 border border-slate-300 rounded-md bg-white text-on-surface cursor-pointer text-sm hover:border-teal-500 hover:text-teal-500 transition-all">Twitter</button>
                  <button className="px-4 py-1.5 border border-slate-300 rounded-md bg-white text-on-surface cursor-pointer text-sm hover:border-teal-500 hover:text-teal-500 transition-all">LinkedIn</button>
                  <button className="px-4 py-1.5 border border-slate-300 rounded-md bg-white text-on-surface cursor-pointer text-sm hover:border-teal-500 hover:text-teal-500 transition-all">Email</button>
                </div>
              </div>

              {/* Q&A Section */}
              <ArticleQASection slug={post.slug} />
            </div>

            {/* Sidebar: Related News (static) + TOC (sticky) */}
            <div className="max-lg:[&_.toc-nav]:hidden">
              <RelatedNewsSidebar post={post} allPosts={allNewsPosts} />
              <TableOfContents />
            </div>
          </div>
        </section>
      </div>
      <FloatingAskButton slug={post.slug} />
    </>
  );
};

export default NewsPostPage;
