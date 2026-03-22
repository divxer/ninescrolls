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
    return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading articles...</div>;
  }

  if (error) {
    return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">
            {contentTypeFilter === 'News' ? 'News' : contentTypeFilter === 'Insights' ? 'Insights' : 'All Content'}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-lg">Manage articles, insights, and news posts across the site.</p>
        </div>
        <Link
          to={contentTypeFilter === 'News' ? '/admin/insights/new?type=news' : '/admin/insights/new'}
          className="bg-secondary text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-secondary/20 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Create New Article
        </Link>
      </div>

      {/* Filters area */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-8 bg-surface-container-low p-6 rounded-xl">
          <div className="flex items-center gap-4">
            {/* Content Type filters */}
            <div className="flex items-center gap-1">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    contentTypeFilter === ct
                      ? 'bg-surface-container-lowest border border-outline-variant/30 text-secondary'
                      : 'hover:bg-surface-container-lowest text-on-surface-variant'
                  }`}
                  onClick={() => { setContentTypeFilter(ct); setCategoryFilter('All'); }}
                >
                  {ct === 'All' ? 'All Types' : ct}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-outline-variant/20" />

            {/* Status filters */}
            <div className="flex items-center gap-1">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === status
                      ? 'bg-surface-container-lowest border border-outline-variant/30 text-secondary'
                      : 'hover:bg-surface-container-lowest text-on-surface-variant'
                  }`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                  {status === 'Drafts' && (
                    <span className="bg-surface-container text-on-surface-variant text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {posts.filter((p) => p.isDraft).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-outline-variant/20" />

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/30 px-3 py-2 rounded-lg text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Velocity stat card */}
        <div className="col-span-4 bg-primary-container p-6 rounded-xl">
          <p className="text-xs text-on-primary-container uppercase tracking-widest mb-1">Total Articles</p>
          <p className="text-3xl font-bold font-headline text-on-primary-container">{filteredPosts.length}</p>
          <p className="text-xs text-on-primary-container/70 mt-1">{posts.length} across all filters</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input
          type="text"
          placeholder="Search by title, slug, or excerpt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-container-low pl-12 pr-4 py-3 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {deleteError && <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-6">{deleteError}</div>}

      {/* Article table */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card mb-12">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low">
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Title</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Author</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Date</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Type</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Status</th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((post) => (
              <tr key={post.id} className="border-t border-outline-variant/10 hover:bg-primary-fixed/30 transition-colors group">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-on-surface">{post.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">/{post.slug}</p>
                </td>
                <td className="px-4 py-3 text-sm text-on-surface">{post.author}</td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">{post.publishDate}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold bg-surface-container-high rounded px-2 py-1 text-on-surface-variant uppercase">
                    {post.contentType === 'news' ? 'News' : 'Insight'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {post.isDraft ? (
                    <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <span className="w-2 h-2 rounded-full bg-outline-variant inline-block" />
                      Draft
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-secondary">
                      <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
                      Published
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/insights/${post.id}/edit`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </Link>
                    <a
                      href={`/${(post.contentType ?? 'insight') === 'news' ? 'news' : 'insights'}/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </a>
                    <div className="relative" ref={openMenu === post.id ? menuRef : undefined}>
                      <button
                        className="text-on-surface-variant hover:text-on-surface transition-colors"
                        onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)}
                      >
                        <span className="material-symbols-outlined text-xl">more_vert</span>
                      </button>
                      {openMenu === post.id && (
                        <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/10 p-1 z-10 min-w-[140px]">
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-container rounded transition-colors"
                            onClick={() => {
                              setOpenMenu(null);
                              navigate(`/admin/insights/new?from=${post.id}`);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-container rounded transition-colors"
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
                  </div>
                </td>
              </tr>
            ))}
            {filteredPosts.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-on-surface-variant text-sm">
                  No articles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
