import { useState, useEffect, useCallback } from 'react';
import type { ArticleQuestion, ArticleQuestionAdmin, QuestionStatus } from '../types';
import { fetchApprovedQuestions, fetchAllQuestions } from '../services/articleQuestionsService';

/** Public hook: fetch approved Q&A for an article */
export function useArticleQuestions(articleSlug: string | undefined) {
  const [questions, setQuestions] = useState<ArticleQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    if (!articleSlug) return;
    setLoading(true);
    fetchApprovedQuestions(articleSlug)
      .then(setQuestions)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [articleSlug]);

  useEffect(() => {
    if (!articleSlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchApprovedQuestions(articleSlug)
      .then((data) => {
        if (!cancelled) {
          setQuestions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [articleSlug]);

  return { questions, loading, error, refetch };
}

/** Admin hook: fetch all questions with optional status filter */
export function useAdminQuestions(status?: QuestionStatus) {
  const [questions, setQuestions] = useState<ArticleQuestionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchAllQuestions(status)
      .then(setQuestions)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    fetchAllQuestions(status)
      .then((data) => {
        if (!cancelled) {
          setQuestions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [status]);

  return { questions, loading, error, refetch };
}
