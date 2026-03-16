import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
  const related = rankRelatedInsights(allPosts, post, 3);
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

function PostSidebar({ post, allPosts }: { post: InsightsPost; allPosts?: InsightsPost[] }) {
  return (
    <div className="sidebar-column">
      <div className="sidebar-info">
        <RelatedProductsSidebar products={post.relatedProducts} />
        {allPosts && <RelatedArticlesSidebar post={post} allPosts={allPosts} />}
      </div>
      <TableOfContents />
    </div>
  );
}

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const tocListRef = useRef<HTMLUListElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Build TOC items from headings and assign IDs
  useEffect(() => {
    const headings = document.querySelectorAll('.post-content h2, .post-content h3');
    if (headings.length === 0) return;

    const usedIds = new Set<string>();
    const tocItems: TocItem[] = [];

    headings.forEach(h => {
      let id = h.id || slugify(h.textContent || '');
      if (usedIds.has(id)) {
        let i = 2;
        while (usedIds.has(`${id}-${i}`)) i++;
        id = `${id}-${i}`;
      }
      usedIds.add(id);
      h.id = id;

      tocItems.push({
        id,
        text: h.textContent || '',
        level: h.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(tocItems);
  }, []);

  // Track active section on scroll — find the last heading above the viewport top
  // Listens to both window and nearest scrollable ancestor (for modal previews)
  useEffect(() => {
    if (items.length === 0) return;

    const onScroll = () => {
      const offset = 150;
      let current = '';
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < offset) {
          current = item.id;
        }
      }
      setActiveId(current);
    };

    // Find nearest scrollable ancestor (for modal contexts)
    let scrollParent: Element | null = null;
    let el = navRef.current?.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParent = el;
        break;
      }
      el = el.parentElement;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    if (scrollParent) {
      scrollParent.addEventListener('scroll', onScroll, { passive: true });
    }
    onScroll(); // set initial state
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', onScroll);
      }
    };
  }, [items]);

  // Auto-scroll the TOC list so the active item stays visible
  useEffect(() => {
    if (!activeId || !tocListRef.current) return;
    const activeEl = tocListRef.current.querySelector('.toc-active') as HTMLElement | null;
    if (!activeEl) return;

    const listRect = tocListRef.current.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    if (activeRect.bottom > listRect.bottom - 10) {
      tocListRef.current.scrollTop += activeRect.bottom - listRect.bottom + 30;
    } else if (activeRect.top < listRect.top + 10) {
      tocListRef.current.scrollTop += activeRect.top - listRect.top - 30;
    }
  }, [activeId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    // Find nearest scrollable ancestor for modal contexts
    let scrollContainer: Element | Window = window;
    let parent = navRef.current?.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (scrollContainer instanceof Window) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      const y = target.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - 100;
      scrollContainer.scrollTo({ top: y, behavior: 'smooth' });
    }
    setActiveId(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className="toc-nav" ref={navRef}>
      <h3>Table of Contents</h3>
      <ul ref={tocListRef}>
        {items.map(item => (
          <li key={item.id} className={`toc-item toc-h${item.level}${activeId === item.id ? ' toc-active' : ''}`}>
            <a href={`#${item.id}`} onClick={e => handleClick(e, item.id)}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.excerpt || post.title,
            "image": `https://ninescrolls.com${post.imageUrl}`,
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
            }
          })}
        </script>
      </Helmet>
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
                <PostSidebar post={post} allPosts={allPosts} />
              </div>
            </div>
          ) : (
            /* Standard single-column layout for regular posts */
            <div className="content-wrapper">
              <div className="main-content">
                {post.content ? (
                  <div
                    className="post-content"
                    dangerouslySetInnerHTML={{ __html: post.content.replace(/&nbsp;|\u00a0/g, ' ') }}
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

              <PostSidebar post={post} allPosts={allPosts} />
            </div>
          )}
        </section>
      </div>
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
    <div className="insights-post-page">
      <section className="insights-post-hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="insights-post-title">{post.title || 'Untitled Article'}</h1>
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

      <section className="insights-post-content">
        <div className="content-wrapper">
          <div className="main-content">
            {post.content ? (
              <div
                className="post-content"
                dangerouslySetInnerHTML={{ __html: post.content.replace(/&nbsp;|\u00a0/g, ' ') }}
              />
            ) : (
              <p style={{ color: '#999' }}>No content yet.</p>
            )}

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
          </div>

          <PostSidebar post={post} />
        </div>
      </section>
    </div>
  );
}
