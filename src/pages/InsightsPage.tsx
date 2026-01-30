import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { insightsPosts, categories, InsightsPost } from '../types';
import { rankRelatedInsights } from '../utils/insights';
import '../styles/InsightsPage.css';

export const InsightsPage: React.FC = () => {
  const analytics = useCombinedAnalytics();
  const [posts] = useState<InsightsPost[]>(
    [...insightsPosts].sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
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
      <div className="insights-page">
      {/* Hero Section */}
      <section className="insights-hero">
        <div className="container">
          <h1>NineScrolls Insights</h1>
          <p>Expert analysis and breakthrough technologies in advanced manufacturing and materials science</p>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="insights-filters">
        <div className="container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Insights Grid */}
      <section className="insights-grid">
        <div className="container">
          <div className="posts-grid">
            {filteredPosts.map(post => (
              <article key={post.id} className="insights-card">
                <div className="insights-card-image">
                  <img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" />
                </div>
                <div className="insights-card-content">
                  <div className="insights-card-meta">
                    <span className="category">{post.category}</span>
                    <span className="read-time">{post.readTime} min read</span>
                  </div>
                  <h3 className="insights-card-title">
                    <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="insights-card-excerpt">{post.excerpt}</p>
                  <div className="insights-card-footer">
                    <span className="author">{post.author}</span>
                    <span className="date">{new Date(post.publishDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* More Recommendations */}
      {recommended.length > 0 && (
        <section className="insights-recommendations">
          <div className="container">
            <h2>More Recommendations</h2>
            <div className="posts-grid">
              {recommended.map(post => (
                <article key={post.id} className="insights-card">
                  <div className="insights-card-image">
                    <img src={post.imageUrl} alt={post.title} />
                  </div>
                  <div className="insights-card-content">
                    <div className="insights-card-meta">
                      <span className="category">{post.category}</span>
                      <span className="read-time">{post.readTime} min read</span>
                    </div>
                    <h3 className="insights-card-title">
                      <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p className="insights-card-excerpt">{post.excerpt}</p>
                    <div className="insights-card-footer">
                      <span className="author">{post.author}</span>
                      <span className="date">{new Date(post.publishDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      </div>
    </>
  );
};

export default InsightsPage; 