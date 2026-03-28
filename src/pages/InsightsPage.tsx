import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useInsightsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { categories, newsCategories, InsightsPost } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import { cdnUrl } from '../config/imageConfig';

function resolveCardImage(url: string): string {
  if (!url) return '';
  // If URL already has an image extension, use as-is
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url)) return cdnUrl(url);
  // Otherwise append .webp (handles both CDN and local extensionless paths)
  return cdnUrl(`${url}.webp`);
}

export const InsightsPage: React.FC = () => {
  const { posts: allPosts, loading } = useInsightsPosts();
  const newsCats = useMemo(() => new Set(newsCategories.filter(c => c !== 'All')), []);
  const rawPosts = useMemo(() => allPosts.filter(p => !newsCats.has(p.category)), [allPosts, newsCats]);
  const posts = useMemo(
    () => [...rawPosts].sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()),
    [rawPosts]
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [recommended, setRecommended] = useState<InsightsPost[]>([]);

  // Scroll to top when component mounts
  useScrollToTop();

  // Note: Page view is automatically tracked by SegmentAnalytics component
  // No need for separate TRACK event - PAGE event already includes:
  // - Full IP analysis with behavior scoring
  // - Time on site
  // - Target customer detection
  // - Pathname (which identifies this as insights page)
  // Category and search filters can be tracked via URL query params if needed

  useEffect(() => {
    // Build a pseudo base post from current selection to compute recommendations
    const base: InsightsPost | null = (() => {
      if (selectedCategory !== 'All') {
        // choose a representative post in the selected category; prefer newest
        const inCat = posts.filter(p => p.category === selectedCategory)
          .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
        return inCat[0] || null;
      }
      // For All, pick the newest overall as base
      const newest = [...posts].sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
      return newest[0] || null;
    })();

    // Exclude posts currently visible in the main grid (no duplication)
    const visibleSet = new Set(
      posts
        .filter(p => {
          const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
          const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.excerpt && p.excerpt.toLowerCase().includes(searchTerm.toLowerCase()));
          return matchesCategory && matchesSearch;
        })
        .map(p => p.slug)
    );

    if (base) {
      const candidates = posts.filter(p => !visibleSet.has(p.slug));
      setRecommended(rankRelatedInsights(candidates, base, 6));
    } else {
      setRecommended([]);
    }
  }, [posts, selectedCategory, searchTerm]);

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.excerpt && post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const renderCard = (post: InsightsPost) => (
    <article key={post.id} className="bg-surface-container-low rounded-xl overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-video bg-slate-200 overflow-hidden">
        <img
          src={resolveCardImage(post.imageUrl)}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-primary font-bold uppercase text-[10px] tracking-widest">{post.category}</span>
          <span className="text-on-surface-variant text-xs">{post.readTime} min read</span>
        </div>
        <h3 className="text-2xl font-headline font-bold mt-4 mb-4 group-hover:text-primary transition-colors">
          <Link to={`/insights/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="text-on-surface-variant mb-6">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <div className="text-on-surface-variant text-sm">
            <span>{post.author}</span>
            <span className="mx-2">&middot;</span>
            <span>{new Date(post.publishDate).toLocaleDateString()}</span>
          </div>
          <Link to={`/insights/${post.slug}`} className="text-primary font-bold flex items-center gap-2">
            Read Paper <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </div>
    </article>
  );

  return (
    <>
      <SEO
        title="Insights"
        description="NineScrolls Insights - Expert analysis and breakthrough technologies in advanced manufacturing and materials science. Explore articles on plasma etching, semiconductor manufacturing, MEMS, nanotechnology, and more."
        keywords="semiconductor insights, plasma etching, advanced manufacturing, materials science, MEMS, nanotechnology, semiconductor equipment, thin film processing"
        image="/assets/images/insights/plasma-etching-cover-optimized.png"
        url="/insights"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "NineScrolls Insights",
            "description": "Expert analysis and breakthrough technologies in advanced manufacturing and materials science",
            "url": "https://ninescrolls.com/insights",
            "publisher": {
              "@type": "Organization",
              "name": "NineScrolls",
              "logo": { "@type": "ImageObject", "url": "https://ninescrolls.com/assets/images/logo.png" }
            },
            "mainEntity": {
              "@type": "ItemList",
              "numberOfItems": posts.length,
              "itemListElement": posts.slice(0, 20).map((p, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "url": `https://ninescrolls.com/insights/${p.slug}`,
                "name": p.title
              }))
            }
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ninescrolls.com" },
              { "@type": "ListItem", "position": 2, "name": "Insights", "item": "https://ninescrolls.com/insights" }
            ]
          })}
        </script>
      </Helmet>
      <main className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-headline font-bold mb-4">Latest Insights</h1>
          <p className="text-on-surface-variant text-lg mb-16">Expert analysis and breakthrough technologies in advanced manufacturing and materials science</p>

          {/* Filters and Search */}
          <div className="mb-12 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    selectedCategory === category
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Insights Grid */}
          {loading ? (
            <div className="text-center text-on-surface-variant py-20">Loading articles...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {filteredPosts.map(renderCard)}
            </div>
          )}

          {/* More Recommendations */}
          {recommended.length > 0 && (
            <div className="mt-24">
              <h2 className="text-3xl font-headline font-bold mb-12">More Recommendations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {recommended.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default InsightsPage;
