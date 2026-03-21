import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInsightsPosts } from '../../hooks/useInsightsPosts';
import { deleteInsightsPost } from '../../services/insightsAdminService';
import { deleteInsightsImages } from '../../services/insightsImageService';
import { insightCategories, newsCategories } from '../../types';

const STATUS_FILTERS = ['All', 'Published', 'Drafts'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const CONTENT_TYPES = ['All', 'Insights', 'News'] as const;
type ContentTypeFilter = (typeof CONTENT_TYPES)[number];

const INCLUDE_DRAFTS = { includeDrafts: true };

export function AdminInsightsListPage() {
  const { posts, loading, error } = useInsightsPosts(INCLUDE_DRAFTS);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('All');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const CATEGORIES = contentTypeFilter === 'News'
    ? newsCategories
    : contentTypeFilter === 'Insights'
    ? insightCategories
    : ['All', ...new Set([
        ...insightCategories.filter(c => c !== 'All'),
        ...newsCategories.filter(c => c !== 'All'),
      ])];

  const filteredPosts = useMemo(() => {
    let result = [...posts].sort(
      (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    // Content type filter
    if (contentTypeFilter === 'Insights') {
      result = result.filter((p) => (p.contentType ?? 'insight') === 'insight');
    } else if (contentTypeFilter === 'News') {
      result = result.filter((p) => p.contentType === 'news');
    }

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
  }, [posts, search, categoryFilter, statusFilter, contentTypeFilter]);

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
        <h1>
          {contentTypeFilter === 'News' ? 'News' : contentTypeFilter === 'Insights' ? 'Insights' : 'All Content'}
          {' '}({filteredPosts.length})
        </h1>
        <Link
          to={contentTypeFilter === 'News' ? '/admin/insights/new?type=news' : '/admin/insights/new'}
          className="admin-btn-primary"
        >
          + New {contentTypeFilter === 'News' ? 'News' : 'Article'}
        </Link>
      </div>

      <div className="admin-content-type-tabs">
        {CONTENT_TYPES.map((ct) => (
          <button
            key={ct}
            className={`admin-content-type-tab ${contentTypeFilter === ct ? 'active' : ''}`}
            onClick={() => { setContentTypeFilter(ct); setCategoryFilter('All'); }}
          >
            {ct}
          </button>
        ))}
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
                <a
                  href={`/${(post.contentType ?? 'insight') === 'news' ? 'news' : 'insights'}/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-sm admin-btn-outline"
                >
                  View
                </a>
                <div className="admin-actions-menu" ref={openMenu === post.id ? menuRef : undefined}>
                  <button
                    className="admin-btn-sm admin-btn-outline admin-btn-more"
                    onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)}
                  >
                    ···
                  </button>
                  {openMenu === post.id && (
                    <div className="admin-actions-dropdown">
                      <button
                        className="admin-dropdown-item"
                        onClick={() => {
                          setOpenMenu(null);
                          navigate(`/admin/insights/new?from=${post.id}`);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="admin-dropdown-item admin-dropdown-item-danger"
                        onClick={() => {
                          setOpenMenu(null);
                          handleDelete(post.id, post.title, post.slug);
                        }}
                        disabled={deleting === post.id}
                      >
                        {deleting === post.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
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
