import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPost, useInsightsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { TableOfContents } from '../components/common/TableOfContents';
import type { InsightsPost, RelatedProduct } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import { PlasmaCleanerComparisonPage } from './PlasmaCleanerComparisonPage';
import { cdnUrl, CDN_BASE_URL } from '../config/imageConfig';
import { ArticleQASection, FloatingAskButton } from '../components/insights/ArticleQASection';
import '../styles/article-content.css';

/**
 * Rewrite /assets/images/ paths inside HTML content to CDN URLs.
 * Only active when VITE_CDN_BASE_URL is set; otherwise returns content as-is.
 */
function rewriteContentImages(html: string): string {
  if (!CDN_BASE_URL) return html;
  // Match src="..." and srcSet="..." attributes containing /assets/images/
  return html.replace(
    /((?:src|srcSet)\s*=\s*")\/assets\/images\//g,
    `$1${CDN_BASE_URL}/`,
  );
}

// Consolidated article redirects: weaker → stronger article
const ARTICLE_REDIRECTS: Record<string, string> = {
  'plasma-etching': 'plasma-etching-explained-fundamentals-applications',
  'plasma-cleaning-precision-surface-preparation': 'what-is-plasma-cleaner-principles-types',
};

// ─── Helper Components ───────────────────────────────────────────────────────

function InsightsHeroImage({ post }: { post: InsightsPost }) {
  const url = post.imageUrl;

  // CDN URLs (e.g. https://cdn/insights/slug/cover-lg): render responsive <picture>
  if (url.startsWith('http') && url.endsWith('-lg')) {
    const base = url.slice(0, -3); // strip "-lg"
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

  // Local paths: use imageUrl directly
  return <img src={url} alt={post.title} loading="eager" fetchPriority="high" />;
}

function RelatedProductsSidebar({ products }: { products?: RelatedProduct[] }) {
  if (!products || products.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2.5 text-on-surface text-lg font-semibold">Related Products</h3>
      <ul className="list-none p-0 m-0">
        {products.map(p => (
          <li key={p.href} className="mb-2 p-2 px-2.5 bg-surface-container-lowest rounded-md border-l-[3px] border-primary">
            <a href={p.href} className="text-blue-700 no-underline font-medium text-sm block hover:text-blue-500 transition-colors">{p.label}</a>
            {p.subtitle && <span className="block text-xs text-on-surface-variant mt-1 font-normal">{p.subtitle}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelatedArticlesSidebar({ post, allPosts }: { post: InsightsPost; allPosts: InsightsPost[] }) {
  const related = rankRelatedInsights(allPosts, post, 3);
  if (related.length === 0) return null;
  return (
    <div className="mt-5 pt-4 border-t border-outline-variant/20">
      <h3 className="mb-2.5 text-on-surface text-lg">Related Articles</h3>
      <ul className="list-none p-0">
        {related.map(rp => (
          <li key={rp.slug} className="mb-2">
            <a href={`/insights/${rp.slug}`} className="text-blue-700 no-underline text-sm leading-snug hover:text-blue-500 transition-colors">{rp.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function resolveCardImage(url: string): string {
  if (!url) return '';
  const resolved = /\.(png|jpe?g|webp|gif|svg)$/i.test(url) ? url : `${url}.webp`;
  return cdnUrl(resolved);
}

function RelatedArticlesBottom({ post, allPosts }: { post: InsightsPost; allPosts: InsightsPost[] }) {
  const related = rankRelatedInsights(allPosts, post, 4);
  if (related.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="text-3xl font-headline font-bold mb-8">You May Also Like</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {related.map(rp => (
          <Link
            key={rp.slug}
            to={`/insights/${rp.slug}`}
            className="related-article-card group flex gap-5 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 no-underline"
          >
            <div className="w-36 min-h-[120px] flex-shrink-0 bg-slate-200 overflow-hidden">
              <img
                src={resolveCardImage(rp.imageUrl)}
                alt={rp.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="py-4 pr-4 flex flex-col justify-center min-w-0">
              <span className="text-primary font-bold uppercase text-[10px] tracking-widest mb-1">{rp.category}</span>
              <h3 className="text-base font-semibold text-on-surface leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">{rp.title}</h3>
              <span className="text-on-surface-variant text-xs">{rp.readTime} min read</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PostSidebar({ post, allPosts }: { post: InsightsPost; allPosts?: InsightsPost[] }) {
  return (
    <div>
      <div className="bg-white p-6 rounded-xl shadow-md mb-5">
        <RelatedProductsSidebar products={post.relatedProducts} />
        {allPosts && <RelatedArticlesSidebar post={post} allPosts={allPosts} />}
      </div>
      <TableOfContents />
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
      <div className="min-h-screen bg-surface-container-lowest">
        <div className="text-center py-16 px-5 text-lg text-on-surface-variant">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-surface-container-lowest">
        <div className="text-center py-16 px-5 text-lg text-red-500">Post not found</div>
      </div>
    );
  }

  const heroImageUrl = post.imageUrl?.startsWith('http') ? post.imageUrl : cdnUrl(post.imageUrl || '');
  const jsonLdImageUrl = heroImageUrl.startsWith('http') ? heroImageUrl : `https://ninescrolls.com${heroImageUrl}`;

  return (
    <>
      <SEO
        title={post.title}
        description={post.excerpt || post.title}
        keywords={post.tags?.join(', ') || ''}
        image={heroImageUrl}
        url={`/insights/${post.slug}`}
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.excerpt || post.title,
            "image": jsonLdImageUrl,
            "author": {
              "@type": "Organization",
              "name": "NineScrolls Engineering",
              "url": "https://ninescrolls.com/about",
              "knowsAbout": ["semiconductor manufacturing", "plasma etching", "thin film deposition", "plasma cleaning", "surface preparation"]
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
              "@id": `https://ninescrolls.com/insights/${post.slug}`
            },
            "keywords": post.tags?.join(', ') || '',
            "articleSection": post.category,
            "timeRequired": `PT${post.readTime}M`,
            "speakable": {
              "@type": "SpeakableSpecification",
              "cssSelector": [".insights-post-title", ".insights-post-meta"]
            },
            ...(allPosts.length > 0 ? {
              "relatedLink": rankRelatedInsights(allPosts, post, 4)
                .map(rp => `https://ninescrolls.com/insights/${rp.slug}`)
            } : {})
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ninescrolls.com" },
              { "@type": "ListItem", "position": 2, "name": "Insights", "item": "https://ninescrolls.com/insights" },
              { "@type": "ListItem", "position": 3, "name": post.title, "item": `https://ninescrolls.com/insights/${post.slug}` }
            ]
          })}
        </script>
      </Helmet>
      <div className="min-h-screen bg-surface-container-lowest">
        {/* Hero Section */}
        <section className="hero-gradient relative py-20 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/hero-cleanroom.jpg')} alt="" />
          </div>
          <div className="max-w-[1200px] mx-auto px-5 relative z-10 flex items-center min-h-[400px]">
            <div className="flex items-center w-full gap-10 md:flex-row flex-col">
              <div className="flex-1">
                <nav aria-label="Breadcrumb" className="mb-4 relative z-10">
                  <ol className="flex items-center gap-1.5 text-sm text-white/70 list-none p-0 m-0">
                    <li><Link to="/" className="text-white/70 hover:text-white no-underline transition-colors">Home</Link></li>
                    <li className="text-white/40">/</li>
                    <li><Link to="/insights" className="text-white/70 hover:text-white no-underline transition-colors">Insights</Link></li>
                    <li className="text-white/40">/</li>
                    <li className="text-white truncate max-w-[300px]">{post.title}</li>
                  </ol>
                </nav>
                <h1 className="insights-post-title text-4xl font-bold mb-5 leading-tight relative z-10">{post.title}</h1>
                <div className="insights-post-meta flex flex-wrap gap-5 mb-8 text-base opacity-90 relative z-10">
                  <span className="flex items-center gap-1.5 font-semibold">{post.author}</span>
                  <span className="flex items-center gap-1.5">{new Date(post.publishDate).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5 bg-white/20 px-4 py-1 rounded-full">{post.category}</span>
                  <span className="flex items-center gap-1.5 opacity-80">{post.readTime} min read</span>
                </div>
              </div>
              <div className="flex-1 max-w-[400px]">
                <InsightsHeroImage post={{ ...post, imageUrl: heroImageUrl }} />
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16">
          {isStandaloneComponent ? (
            /* Two-stage layout with unified alignment */
            <div className="max-w-6xl mx-auto px-6 md:px-6">
              <div className="grid grid-cols-[2.5fr_1fr] gap-10 mb-8 max-md:grid-cols-1">
                <div className="bg-white p-10 rounded-xl shadow-md min-w-0 overflow-x-hidden max-md:p-5">
                  <PlasmaCleanerComparisonPage />
                </div>
                <PostSidebar post={post} allPosts={allPosts} />
              </div>
            </div>
          ) : (
            /* Standard single-column layout for regular posts */
            <div className="grid grid-cols-[2.5fr_1fr] gap-10 max-w-[1280px] mx-auto px-5 max-md:grid-cols-1">
              <div className="bg-white p-10 rounded-xl shadow-md min-w-0 overflow-x-hidden max-md:p-5">
                {post.content ? (
                  <div
                    className="post-content"
                    dangerouslySetInnerHTML={{ __html: rewriteContentImages(post.content.replace(/&nbsp;|\u00a0/g, ' ')) }}
                  />
                ) : null}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-outline-variant/20">
                    <h3>Tags:</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {post.tags.map(tag => (
                        <span key={tag} className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share Buttons */}
                <div className="mt-10 pt-8 border-t border-outline-variant/20">
                  <h3>Share this article:</h3>
                  <div className="flex gap-2.5">
                    <button className="px-5 py-2.5 border-none rounded-full cursor-pointer font-medium bg-[#1da1f2] text-white hover:-translate-y-0.5 hover:shadow-md transition-all">Twitter</button>
                    <button className="px-5 py-2.5 border-none rounded-full cursor-pointer font-medium bg-[#0077b5] text-white hover:-translate-y-0.5 hover:shadow-md transition-all">LinkedIn</button>
                    <button className="px-5 py-2.5 border-none rounded-full cursor-pointer font-medium bg-slate-500 text-white hover:-translate-y-0.5 hover:shadow-md transition-all">Email</button>
                  </div>
                </div>

                {/* Q&A Section */}
                <ArticleQASection slug={post.slug} />

                {/* Related Articles */}
                {allPosts.length > 0 && <RelatedArticlesBottom post={post} allPosts={allPosts} />}
              </div>

              <PostSidebar post={post} allPosts={allPosts} />
            </div>
          )}
        </section>
      </div>
      <FloatingAskButton targetId="article-qa-section" />
    </>
  );
};

export default InsightsPostPage;

/**
 * Standalone preview component reusing the real article layout.
 * Used by the admin edit form's Preview modal.
 */
export function InsightsPostPreview({ post }: { post: InsightsPost }) {
  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <section className="hero-gradient relative py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/hero-cleanroom.jpg')} alt="" />
        </div>
        <div className="max-w-[1200px] mx-auto px-5 relative z-10 flex items-center min-h-[400px]">
          <div className="flex items-center w-full gap-10 md:flex-row flex-col">
            <div className="flex-1">
              <h1 className="insights-post-title text-4xl font-bold mb-5 leading-tight relative z-10">{post.title || 'Untitled Article'}</h1>
              <div className="insights-post-meta flex flex-wrap gap-5 mb-8 text-base opacity-90 relative z-10">
                <span className="flex items-center gap-1.5 font-semibold">{post.author}</span>
                <span className="flex items-center gap-1.5">{new Date(post.publishDate).toLocaleDateString()}</span>
                <span className="flex items-center gap-1.5 bg-white/20 px-4 py-1 rounded-full">{post.category}</span>
                <span className="flex items-center gap-1.5 opacity-80">{post.readTime} min read</span>
              </div>
            </div>
            <div className="flex-1 max-w-[400px]">
              <InsightsHeroImage post={{ ...post, imageUrl: cdnUrl(post.imageUrl || '') }} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="grid grid-cols-[2.5fr_1fr] gap-10 max-w-[1280px] mx-auto px-5 max-md:grid-cols-1">
          <div className="bg-white p-10 rounded-xl shadow-md min-w-0 overflow-x-hidden max-md:p-5">
            {post.content ? (
              <div
                className="post-content"
                dangerouslySetInnerHTML={{ __html: rewriteContentImages(post.content.replace(/&nbsp;|\u00a0/g, ' ')) }}
              />
            ) : (
              <p style={{ color: '#999' }}>No content yet.</p>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="mt-10 pt-8 border-t border-outline-variant/20">
                <h3>Tags:</h3>
                <div className="flex flex-wrap gap-2.5">
                  {post.tags.map(tag => (
                    <span key={tag} className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <PostSidebar post={post} />
        </div>
      </section>
    </div>
  );
}
