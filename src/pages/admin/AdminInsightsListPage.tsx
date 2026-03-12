import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInsightsPosts } from '../../hooks/useInsightsPosts';
import { deleteInsightsPost } from '../../services/insightsAdminService';
import { deleteInsightsImages } from '../../services/insightsImageService';

const CATEGORIES = ['All', 'Materials Science', 'Photonics', 'Nanotechnology', 'Energy'];
const STATUS_FILTERS = ['All', 'Published', 'Drafts'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const INCLUDE_DRAFTS = { includeDrafts: true };

export function AdminInsightsListPage() {
  const { posts, loading, error } = useInsightsPosts(INCLUDE_DRAFTS);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const filteredPosts = useMemo(() => {
    let result = [...posts].sort(
      (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    if (statusFilter === 'Published') {
      result = result.filter((p) => !p.isDraft);
    } else if (statusFilter === 'Drafts') {
      result = result.filter((p) => p.isDraft);
    }

    if (categoryFilter !== 'All') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.excerpt && p.excerpt.toLowerCase().includes(q))
      );
    }

    return result;
  }, [posts, search, categoryFilter, statusFilter]);

  async function handleDelete(id: string, title: string, slug: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeleting(id);
    setDeleteError('');
    try {
      await deleteInsightsPost(id);
      // Best-effort cleanup of S3 images (don't block on failure)
      deleteInsightsImages(slug).catch((err) =>
        console.warn('Failed to cleanup S3 images:', err)
      );
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <div className="admin-loading">Loading articles...</div>;
  }

  if (error) {
    return <div className="admin-error">Error: {error.message}</div>;
  }

  return (
    <div className="admin-insights-list">
      <div className="admin-list-header">
        <h1>Insights Articles ({posts.length})</h1>
        <Link to="/admin/insights/new" className="admin-btn-primary">
          + New Article
        </Link>
      </div>

      <div className="admin-status-tabs">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            className={`admin-status-tab ${statusFilter === status ? 'admin-status-tab-active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
            {status === 'Drafts' && (
              <span className="admin-status-tab-count">
                {posts.filter((p) => p.isDraft).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="admin-list-filters">
        <input
          type="text"
          placeholder="Search by title, slug, or excerpt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="admin-filter-select"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {deleteError && <div className="admin-error">{deleteError}</div>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Author</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPosts.map((post) => (
            <tr key={post.id}>
              <td>
                <div className="admin-post-title">
                  {post.title}
                  {post.isDraft && <span className="draft-badge">Draft</span>}
                </div>
                <div className="admin-post-slug">/{post.slug}</div>
              </td>
              <td>{post.category}</td>
              <td>{post.author}</td>
              <td>{post.publishDate}</td>
              <td className="admin-actions">
                <Link
                  to={`/admin/insights/${post.id}/edit`}
                  className="admin-btn-sm"
                >
                  Edit
                </Link>
                <button
                  onClick={() => navigate(`/admin/insights/new?from=${post.id}`)}
                  className="admin-btn-sm admin-btn-outline"
                >
                  Duplicate
                </button>
                <a
                  href={`/insights/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-sm admin-btn-outline"
                >
                  View
                </a>
                <button
                  onClick={() => handleDelete(post.id, post.title, post.slug)}
                  disabled={deleting === post.id}
                  className="admin-btn-sm admin-btn-danger"
                >
                  {deleting === post.id ? '...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
          {filteredPosts.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-no-results">
                No articles found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
