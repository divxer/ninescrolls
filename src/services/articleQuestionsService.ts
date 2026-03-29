import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { ArticleQuestion, ArticleQuestionAdmin, QuestionStatus } from '../types';

const client = generateClient<Schema>();

type DynamoQuestion = Schema['ArticleQuestion']['type'];

function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

function mapToArticleQuestion(item: DynamoQuestion): ArticleQuestion {
  return {
    id: item.id,
    articleSlug: item.articleSlug,
    name: item.name,
    question: item.question,
    answer: item.answer ?? undefined,
    status: (item.status as QuestionStatus) ?? 'pending',
    submittedAt: item.submittedAt,
    answeredAt: item.answeredAt ?? undefined,
    answeredBy: item.answeredBy ?? undefined,
  };
}

function mapToArticleQuestionAdmin(item: DynamoQuestion): ArticleQuestionAdmin {
  return {
    ...mapToArticleQuestion(item),
    email: item.email,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch approved questions for an article (public, no email exposed) */
export async function fetchApprovedQuestions(articleSlug: string): Promise<ArticleQuestion[]> {
  // Use .list() with filter — the GSI method (listArticleQuestionByArticleSlug)
  // will be available after `npx ampx sandbox` regenerates amplify_outputs.json
  const allItems: DynamoQuestion[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const page: { data: DynamoQuestion[]; nextToken?: string | null } = await client.models.ArticleQuestion.list({
      filter: {
        articleSlug: { eq: articleSlug },
        status: { eq: 'approved' },
      },
      limit: 100,
      ...(nextToken ? { nextToken } : {}),
    });
    allItems.push(...page.data);
    nextToken = page.nextToken;
  } while (nextToken);

  return allItems
    .filter((q) => q.answer)
    .map(mapToArticleQuestion)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
}

/** Submit a new question via REST Lambda (with Turnstile) */
export async function submitQuestion(payload: {
  articleSlug: string;
  name: string;
  email: string;
  question: string;
  turnstileToken: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getApiUrl()}/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

/** List all questions, optionally filtered by status (admin) */
export async function fetchAllQuestions(status?: QuestionStatus): Promise<ArticleQuestionAdmin[]> {
  const allItems: DynamoQuestion[] = [];
  let nextToken: string | null | undefined = undefined;

  const filter = status ? { status: { eq: status } } : undefined;

  do {
    const page: { data: DynamoQuestion[]; nextToken?: string | null } = await client.models.ArticleQuestion.list({
      limit: 100,
      authMode: 'userPool',
      ...(filter ? { filter } : {}),
      ...(nextToken ? { nextToken } : {}),
    });
    allItems.push(...page.data);
    nextToken = page.nextToken;
  } while (nextToken);

  return allItems
    .map(mapToArticleQuestionAdmin)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/** Answer a question and set status to approved (admin) */
export async function answerQuestion(
  id: string,
  answer: string,
  answeredBy: string,
): Promise<void> {
  await client.models.ArticleQuestion.update(
    {
      id,
      answer,
      answeredBy,
      answeredAt: new Date().toISOString(),
      status: 'approved',
    },
    { authMode: 'userPool' },
  );
}

/** Reject a question (admin) */
export async function rejectQuestion(id: string): Promise<void> {
  await client.models.ArticleQuestion.update(
    { id, status: 'rejected' },
    { authMode: 'userPool' },
  );
}

/** Revert a question back to pending (admin) */
export async function revertToPending(id: string): Promise<void> {
  await client.models.ArticleQuestion.update(
    { id, status: 'pending' },
    { authMode: 'userPool' },
  );
}

/** Delete a question (admin) */
export async function deleteQuestion(id: string): Promise<void> {
  await client.models.ArticleQuestion.delete(
    { id },
    { authMode: 'userPool' },
  );
}
