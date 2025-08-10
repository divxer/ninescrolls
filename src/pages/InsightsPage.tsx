import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { SEO } from '../components/common/SEO';
import '../styles/BlogPage.css';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishDate: string;
  category: string;
  readTime: number;
  imageUrl: string;
  slug: string;
}

const samplePosts: BlogPost[] = [
  {
    id: '11',
    title: 'Understanding the Differences Between PE, RIE, and ICP-RIE in Plasma Etching',
    excerpt: 'A comprehensive comparison of Plasma Etching (PE), Reactive Ion Etching (RIE), and Inductively Coupled Plasma Reactive Ion Etching (ICP-RIE) technologies...',
    author: 'NineScrolls Team',
    publishDate: '2025-01-25',
    category: 'Materials Science',
    readTime: 15,
    imageUrl: '/assets/images/insights/plasma-etching-cover-optimized.png',
    slug: 'understanding-differences-pe-rie-icp-rie-plasma-etching'
  },
  {
    id: '1',
    title: 'Advanced Materials Processing: From Nanotechnology to Energy Applications',
    excerpt: 'Explore how NineScrolls equipment enables breakthroughs across materials science, nanotechnology, and energy technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-15',
    category: 'Materials Science',
    readTime: 8,
    imageUrl: '/assets/images/insights/advanced-materials.jpg',
    slug: 'advanced-materials-processing-nanotechnology-energy'
  },
  {
    id: '2',
    title: 'Photonics Manufacturing: Precision Engineering for Optical Devices',
    excerpt: 'Discover how precision manufacturing systems are revolutionizing photonics and optical device production...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-10',
    category: 'Photonics',
    readTime: 12,
    imageUrl: '/assets/images/insights/photonics-manufacturing.jpg',
    slug: 'photonics-manufacturing-precision-engineering'
  },
  {
    id: '3',
    title: 'Nanofabrication Techniques: Building the Nanoscale Future',
    excerpt: 'Learn about cutting-edge nanofabrication methods and their applications in next-generation technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-08',
    category: 'Nanotechnology',
    readTime: 10,
    imageUrl: '/assets/images/insights/nanofabrication.jpg',
    slug: 'nanofabrication-techniques-nanoscale-future'
  },
  {
    id: '4',
    title: 'Energy Storage Materials: Powering Tomorrow\'s Technologies',
    excerpt: 'Explore innovative energy storage solutions and their role in sustainable technology development...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-05',
    category: 'Energy',
    readTime: 9,
    imageUrl: '/assets/images/insights/energy-storage.jpg',
    slug: 'energy-storage-materials-tomorrow-technologies'
  },
  {
    id: '5',
    title: 'Biotechnology Applications: From Lab to Market',
    excerpt: 'Discover how precision manufacturing enables breakthroughs in biotechnology and medical applications...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-03',
    category: 'Biotechnology',
    readTime: 11,
    imageUrl: '/assets/images/insights/biotechnology.jpg',
    slug: 'biotechnology-applications-lab-market'
  },
  {
    id: '6',
    title: 'Fuel Cell Technology: Powering the Hydrogen Economy',
    excerpt: 'Explore how NineScrolls precision manufacturing systems are enabling breakthroughs in fuel cell technology...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-20',
    category: 'Energy',
    readTime: 10,
    imageUrl: '/assets/images/insights/fuel-cells.jpg',
    slug: 'fuel-cell-technology-hydrogen-economy'
  },
  {
    id: '7',
    title: 'Microfluidics Revolution: Lab-on-a-Chip Technologies',
    excerpt: 'Discover how microfluidics is transforming medical diagnostics and drug discovery processes...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-18',
    category: 'Biotechnology',
    readTime: 9,
    imageUrl: '/assets/images/insights/microfluidics.jpg',
    slug: 'microfluidics-revolution-lab-on-chip'
  },
  {
    id: '8',
    title: 'Optical Waveguides: Modern Communications Infrastructure',
    excerpt: 'Learn about the latest developments in optical waveguide technology for telecommunications...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-16',
    category: 'Photonics',
    readTime: 11,
    imageUrl: '/assets/images/insights/optical-waveguides.jpg',
    slug: 'optical-waveguides-modern-communications'
  },
  {
    id: '9',
    title: 'Quantum Computing: The Future of Information Processing',
    excerpt: 'Explore how quantum computing technologies are revolutionizing information processing...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-14',
    category: 'Nanotechnology',
    readTime: 12,
    imageUrl: '/assets/images/insights/quantum-computing.jpg',
    slug: 'quantum-computing-future-information-processing'
  },
  {
    id: '10',
    title: 'Solar Cell Manufacturing: Renewable Energy Solutions',
    excerpt: 'Discover advanced manufacturing techniques for next-generation solar cell technologies...',
    author: 'NineScrolls Team',
    publishDate: '2024-01-12',
    category: 'Energy',
    readTime: 8,
    imageUrl: '/assets/images/insights/solar-cells.jpg',
    slug: 'solar-cell-manufacturing-renewable-energy'
  },

];

const categories = [
  'All',
  'Materials Science',
  'Photonics',
  'Nanotechnology',
  'Energy',
  'Biotechnology'
];

export const InsightsPage: React.FC = () => {
  const analytics = useCombinedAnalytics();
  const [posts] = useState<BlogPost[]>(samplePosts);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

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
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
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
              <article key={post.id} className="blog-card">
                <div className="blog-card-image">
                  <img src={post.imageUrl} alt={post.title} />
                </div>
                <div className="blog-card-content">
                  <div className="blog-card-meta">
                    <span className="category">{post.category}</span>
                    <span className="read-time">{post.readTime} min read</span>
                  </div>
                  <h3 className="insights-card-title">
                    <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                  <div className="blog-card-footer">
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