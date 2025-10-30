import type { AnswerBlock } from '../answer-block.js';
import { normalizeDomain, isBrandDomain } from '../domain.js';

export interface EvaluationContext {
  brandName: string;
  brandDomains: string[];
  competitors: string[];
}

export interface EvaluatedAnswer {
  presence: boolean;
  llmRank: number | null;
  linkRank: number | null;
  sov: number | null;
  flags: string[];
}

export interface ScoreBreakdown {
  position: number;
  link: number;
  sov: number;
  accuracy: number;
}

export interface ScoredAnswer extends EvaluatedAnswer {
  score: number;
  breakdown: ScoreBreakdown;
}

function findBrandEntityRank(answer: AnswerBlock, context: EvaluationContext): number | null {
  for (const entity of answer.ordered_entities) {
    const entityDomain = normalizeDomain(entity.domain);
    const entityName = entity.name.toLowerCase();
    if (isBrandDomain(entityDomain, context.brandDomains)) {
      return entity.position ?? null;
    }
    if (entityName.includes(context.brandName.toLowerCase())) {
      return entity.position ?? null;
    }
  }
  return null;
}

function findBrandLinkRank(answer: AnswerBlock, context: EvaluationContext): number | null {
  for (let index = 0; index < answer.citations.length; index += 1) {
    const citation = answer.citations[index];
    if (!citation) continue;
    if (isBrandDomain(citation.domain, context.brandDomains)) {
      return index + 1;
    }
  }
  return null;
}

function computeSov(answer: AnswerBlock, context: EvaluationContext): number | null {
  if (answer.citations.length === 0) {
    return null;
  }
  const brandCount = answer.citations.filter((citation) =>
    isBrandDomain(citation.domain, context.brandDomains)
  ).length;
  return brandCount / answer.citations.length;
}

function computePresence(answer: AnswerBlock, context: EvaluationContext): boolean {
  const rank = findBrandEntityRank(answer, context);
  if (rank !== null) {
    return true;
  }
  return answer.answer_summary.toLowerCase().includes(context.brandName.toLowerCase());
}

function computePositionComponent(rank: number | null): number {
  if (!rank || rank <= 0) {
    return 0;
  }
  const maxRank = 10;
  const bounded = Math.min(rank, maxRank);
  const score = ((maxRank - bounded + 1) / maxRank) * 100;
  return Math.max(0, Math.min(100, score));
}

function computeLinkComponent(rank: number | null): number {
  if (!rank || rank <= 0) {
    return 0;
  }
  const maxRank = 10;
  const bounded = Math.min(rank, maxRank);
  const score = ((maxRank - bounded + 1) / maxRank) * 100;
  return Math.max(0, Math.min(100, score));
}

function computeAccuracyComponent(flags: string[]): number {
  if (flags.length === 0) {
    return 100;
  }
  if (flags.includes('possible_hallucination')) {
    return 0;
  }
  if (flags.includes('no_sources')) {
    return 25;
  }
  return 60;
}

function computeSovComponent(sov: number | null): number {
  if (sov === null) {
    return 0;
  }
  return Math.max(0, Math.min(100, sov * 100));
}

export function evaluateAnswer(answer: AnswerBlock, context: EvaluationContext): EvaluatedAnswer {
  const flags = [...(answer.notes.flags ?? [])];
  const llmRank = findBrandEntityRank(answer, context);
  const linkRank = findBrandLinkRank(answer, context);
  const sov = computeSov(answer, context);
  const presence = computePresence(answer, context);

  return {
    presence,
    llmRank,
    linkRank,
    sov,
    flags
  };
}

export function scoreAnswer(answer: AnswerBlock, context: EvaluationContext): ScoredAnswer {
  const evaluation = evaluateAnswer(answer, context);
  const breakdown: ScoreBreakdown = {
    position: computePositionComponent(evaluation.llmRank),
    link: computeLinkComponent(evaluation.linkRank),
    sov: computeSovComponent(evaluation.sov),
    accuracy: computeAccuracyComponent(evaluation.flags)
  };

  const score =
    breakdown.position * 0.45 +
    breakdown.link * 0.25 +
    breakdown.sov * 0.2 +
    breakdown.accuracy * 0.1;

  return {
    ...evaluation,
    score,
    breakdown
  };
}

export interface AggregateScores {
  overallScore: number;
  visibilityPct: number;
}

export function aggregateScores(results: ScoredAnswer[]): AggregateScores {
  if (results.length === 0) {
    return { overallScore: 0, visibilityPct: 0 };
  }

  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const visibilityCount = results.filter((result) => result.presence).length;

  return {
    overallScore: totalScore / results.length,
    visibilityPct: (visibilityCount / results.length) * 100
  };
}
