import { InsightsPost } from '../types';

export interface RankingWeights {
  sameCategory: number;
  perTagOverlap: number;
  recencyMaxBonusMonths: number; // up to N months recent gets small bonus
}

export const defaultRankingWeights: RankingWeights = {
  sameCategory: 100,
  perTagOverlap: 10,
  recencyMaxBonusMonths: 5
};

export function computeRelatedScore(
  candidate: InsightsPost,
  base: InsightsPost,
  weights: RankingWeights = defaultRankingWeights
): number {
  const sameCategoryBonus = candidate.category === base.category ? weights.sameCategory : 0;
  const tagOverlapCount = candidate.tags.filter(t => base.tags.includes(t)).length;
  const tagBonus = tagOverlapCount * weights.perTagOverlap;

  const msPerMonth = 1000 * 60 * 60 * 24 * 30;
  const monthsSince = Math.floor((Date.now() - new Date(candidate.publishDate).getTime()) / msPerMonth);
  const recencyBonus = Math.max(0, weights.recencyMaxBonusMonths - Math.max(monthsSince, 0));

  return sameCategoryBonus + tagBonus + recencyBonus;
}

export function rankRelatedInsights(
  allPosts: InsightsPost[],
  base: InsightsPost,
  limit: number = 4,
  weights: RankingWeights = defaultRankingWeights
): InsightsPost[] {
  const baseType = base.contentType ?? 'insight';

  // Prefer same contentType
  const sameType = allPosts
    .filter(p => p.slug !== base.slug && (p.contentType ?? 'insight') === baseType)
    .map(p => ({ post: p, score: computeRelatedScore(p, base, weights) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post }) => post);

  // Fallback: fill from other contentType if not enough same-type results
  if (sameType.length < limit) {
    const sameTypeSlugs = new Set(sameType.map(p => p.slug));
    const otherType = allPosts
      .filter(p => p.slug !== base.slug && !sameTypeSlugs.has(p.slug))
      .map(p => ({ post: p, score: computeRelatedScore(p, base, weights) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit - sameType.length)
      .map(({ post }) => post);
    return [...sameType, ...otherType];
  }

  return sameType;
}


