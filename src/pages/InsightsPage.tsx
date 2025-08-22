import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { insightsPosts, categories, InsightsPost } from '../types';
import '../styles/InsightsPage.css';

export const InsightsPage: React.FC = () => {
  const analytics = useCombinedAnalytics();
  const [posts] = useState<InsightsPost[]>(insightsPosts);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Scroll to top when component mounts
  useScrollToTop();

  useEffect(() => {
    analytics.segment.trackWithSimpleIPAnalysis('Insights Page Viewed', {
      page: 'insights',
      category: selectedCategory,
      searchTerm: searchTerm
    });
  }, [analytics, selectedCategory, searchTerm]);

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
      </div>
    </>
  );
};

export default InsightsPage; 