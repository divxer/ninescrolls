import { useState, useMemo } from 'react';
import { useAdminQuestions } from '../../hooks/useArticleQuestions';
import { answerQuestion, rejectQuestion, revertToPending, deleteQuestion } from '../../services/articleQuestionsService';
import type { ArticleQuestionAdmin, QuestionStatus } from '../../types';

const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusToQuery: Record<StatusFilter, QuestionStatus | undefined> = {
  All: undefined,
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
};

const statusBadge: Record<QuestionStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
};

export function AdminQuestionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Pending');
  const { questions, loading, error, refetch } = useAdminQuestions(statusToQuery[statusFilter]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return questions;
    const q = search.toLowerCase();
    return questions.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.articleSlug.toLowerCase().includes(q),
    );
  }, [questions, search]);

  const handleExpand = (item: ArticleQuestionAdmin) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setAnswerText('');
    } else {
      setExpandedId(item.id);
      setAnswerText(item.answer || '');
    }
  };

  const handleAnswer = async (id: string) => {
    if (!answerText.trim()) return;
    setActionLoading(id);
    setActionError('');
    try {
      await answerQuestion(id, answerText.trim(), 'admin');
      setExpandedId(null);
      setAnswerText('');
      refetch();
    } catch (err) {
      setActionError(`Failed to save answer: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this question?')) return;
    setActionLoading(id);
    try {
      await rejectQuestion(id);
      refetch();
    } catch (err) {
      setActionError(`Failed to reject: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevert = async (id: string) => {
    setActionLoading(id);
    try {
      await revertToPending(id);
      refetch();
    } catch (err) {
      setActionError(`Failed to revert: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this question?')) return;
    setActionLoading(id);
    try {
      await deleteQuestion(id);
      refetch();
    } catch (err) {
      setActionError(`Failed to delete: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const q of questions) {
      if (q.status in c) c[q.status as keyof typeof c]++;
    }
    return c;
  }, [questions]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Article Q&A</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage questions from article readers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-amber-600' },
          { label: 'Approved', count: counts.approved, color: 'text-green-600' },
          { label: 'Rejected', count: counts.rejected, color: 'text-red-600' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-surface-container-low rounded-xl p-4">
            <p className="text-sm text-on-surface-variant">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-surface-container-low rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-1 focus:ring-secondary/20 placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      {/* Error */}
      {(error || actionError) && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error?.message || actionError}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">Loading questions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          {search ? 'No questions match your search.' : 'No questions found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const badge = statusBadge[item.status];
            const isExpanded = expandedId === item.id;
            const isLoading = actionLoading === item.id;

            return (
              <div
                key={item.id}
                className="bg-surface-container-low rounded-xl overflow-hidden"
              >
                {/* Question Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-surface-container-lowest/50 transition-colors"
                  onClick={() => handleExpand(item)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {item.articleSlug}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-on-surface font-medium text-sm leading-relaxed">
                        {item.question}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {item.name} &lt;{item.email}&gt;
                      </p>
                      {item.answer && !isExpanded && (
                        <p className="text-xs text-on-surface-variant mt-2 italic truncate">
                          Answer: {item.answer}
                        </p>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant shrink-0">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* Expanded: Answer Form + Actions */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-outline-variant/10 pt-4">
                    <label className="block text-sm font-medium text-on-surface mb-2">
                      {item.status === 'approved' ? 'Edit Answer' : 'Write Answer'}
                    </label>
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y mb-3"
                      placeholder="Type your answer here..."
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleAnswer(item.id)}
                        disabled={isLoading || !answerText.trim()}
                        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : item.status === 'approved' ? 'Update & Approve' : 'Answer & Approve'}
                      </button>
                      {item.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={isLoading}
                          className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      {item.status !== 'pending' && (
                        <button
                          onClick={() => handleRevert(item.id)}
                          disabled={isLoading}
                          className="px-4 py-2 border border-outline-variant/30 text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-lowest transition-colors disabled:opacity-50"
                        >
                          Revert to Pending
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isLoading}
                        className="px-4 py-2 text-red-500 text-sm font-medium hover:text-red-700 transition-colors disabled:opacity-50 ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
