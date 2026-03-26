import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useNewsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { newsCategories } from '../types';

function resolveCardImage(url: string): string {
  if (!url) return '';
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url)) return url;
  return `${url}.webp`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Industry: '#0d9488',
  Product: '#3b82f6',
  Event: '#8b5cf6',
  Partnership: '#f59e0b',
};

function hasValidImage(url: string): boolean {
  return Boolean(url) && !url.startsWith('/assets/images/news/');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const NewsPage: React.FC = () => {
  const { posts: rawPosts, loading } = useNewsPosts();
  const posts = useMemo(
    () => [...rawPosts].sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()),
    [rawPosts]
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useScrollToTop();

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.excerpt && post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <SEO
        title="News"
        description="NineScrolls News - Latest industry updates, product announcements, and events in advanced semiconductor manufacturing and plasma processing."
        keywords="semiconductor news, plasma processing, advanced manufacturing, industry updates, NineScrolls"
        url="/news"
        type="website"
      />
      <main className="py-24 px-8 max-w-7xl mx-auto">
        <h1 className="text-5xl font-headline font-bold mb-4">Newsroom</h1>
        <p className="text-on-surface-variant text-lg mb-16">Latest updates in semiconductor manufacturing and plasma processing</p>

        {/* Filters and Search */}
        <div className="mb-12 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
            <input
              type="text"
              placeholder="Search news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Show category filters only when 2+ categories have posts */}
          {new Set(posts.map(p => p.category)).size >= 2 && (
            <div className="flex flex-wrap gap-2">
              {newsCategories.map(category => (
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
          )}
        </div>

        {/* News Feed */}
        {loading ? (
          <div className="text-center text-on-surface-variant py-20">Loading news...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center text-on-surface-variant py-20">No news articles found.</div>
        ) : (
          <div className="space-y-12">
            {filteredPosts.map(post => (
              <div key={post.id} className="border-b border-outline-variant pb-12 flex gap-12 flex-col md:flex-row transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <div className="w-32 shrink-0">
                  <time className="font-headline font-bold text-primary" dateTime={post.publishDate}>{formatDate(post.publishDate)}</time>
                  <span className="block mt-2 text-[10px] uppercase font-black text-on-surface-variant tracking-widest">{post.category}</span>
                  <span className="block mt-1 text-xs text-on-surface-variant">{post.readTime} min</span>
                </div>
                <div className="flex-1">
                  {hasValidImage(post.imageUrl) && (
                    <Link to={`/news/${post.slug}`} className="block mb-6 rounded-lg overflow-hidden">
                      <img
                        src={resolveCardImage(post.imageUrl)}
                        alt={post.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-48 object-cover"
                      />
                    </Link>
                  )}
                  {!hasValidImage(post.imageUrl) && (
                    <Link
                      to={`/news/${post.slug}`}
                      className="block mb-6 rounded-lg overflow-hidden h-48 flex items-center justify-center text-white font-headline font-bold text-lg"
                      style={{ background: CATEGORY_COLORS[post.category] || '#0d9488' }}
                    >
                      {post.category}
                    </Link>
                  )}
                  <h3 className="text-3xl font-headline font-bold hover:text-primary cursor-pointer transition-colors">
                    <Link to={`/news/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="text-on-surface-variant mt-4">{post.excerpt}</p>
                  <Link to={`/news/${post.slug}`} className="mt-6 inline-flex items-center gap-2 font-bold text-sm uppercase tracking-widest text-primary">
                    Read Full Release <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default NewsPage;
