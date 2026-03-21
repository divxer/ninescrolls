import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useNewsPosts } from '../hooks/useInsightsPosts';
import { SEO } from '../components/common/SEO';
import { newsCategories } from '../types';
import '../styles/NewsPage.css';

function resolveCardImage(url: string): string {
  if (!url) return '';
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url)) return url;
  return `${url}.webp`;
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
      <div className="news-page">
        {/* Hero Section */}
        <section className="news-hero">
          <div className="container">
            <h1>Industry News</h1>
            <p>Latest updates in semiconductor manufacturing and plasma processing</p>
          </div>
        </section>

        {/* Filters and Search */}
        <section className="news-filters">
          <div className="container">
            <div className="news-search-box">
              <input
                type="text"
                placeholder="Search news..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="news-category-filters">
              {newsCategories.map(category => (
                <button
                  key={category}
                  className={`news-category-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* News Feed */}
        <section className="news-feed">
          <div className="container">
            {loading ? (
              <div className="loading">Loading news...</div>
            ) : filteredPosts.length === 0 ? (
              <div className="news-empty">No news articles found.</div>
            ) : (
              <div className="news-list">
                {filteredPosts.map(post => (
                  <article key={post.id} className="news-item">
                    <div className="news-item-image">
                      <Link to={`/news/${post.slug}`}>
                        <img src={resolveCardImage(post.imageUrl)} alt={post.title} loading="lazy" decoding="async" />
                      </Link>
                    </div>
                    <div className="news-item-content">
                      <div className="news-item-meta">
                        <span className="news-category-badge">{post.category}</span>
                        <time dateTime={post.publishDate}>{formatDate(post.publishDate)}</time>
                        <span className="news-read-time">{post.readTime} min</span>
                      </div>
                      <h3 className="news-item-title">
                        <Link to={`/news/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <p className="news-item-excerpt">{post.excerpt}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default NewsPage;
