import { describe, expect, it } from 'vitest';

import { scoreAnswer } from './index.js';

const baseAnswer = {
  ordered_entities: [
    {
      name: 'Acme Dental',
      domain: 'https://acmedental.com',
      rationale: 'Leading provider',
      position: 1
    }
  ],
  citations: [
    {
      url: 'https://acmedental.com/about',
      domain: 'acmedental.com'
    },
    {
      url: 'https://smileco.com/reviews',
      domain: 'smileco.com'
    }
  ],
  answer_summary: 'Acme Dental is a trusted clinic.',
  notes: {
    flags: []
  }
} as const;

const context = {
  brandName: 'Acme Dental',
  brandDomains: ['acmedental.com'],
  competitors: ['smileco.com']
} as const;

describe('scoreAnswer', () => {
  it('computes scores with presence and links', () => {
    const scored = scoreAnswer(baseAnswer, context);
    expect(scored.presence).toBe(true);
    expect(scored.llmRank).toBe(1);
    expect(scored.linkRank).toBe(1);
    expect(scored.sov).toBeCloseTo(0.5, 2);
    expect(scored.score).toBeGreaterThan(0);
  });

  it('handles missing citations', () => {
    const answer = {
      ...baseAnswer,
      citations: []
    };
    const scored = scoreAnswer(answer, context);
    expect(scored.linkRank).toBeNull();
    expect(scored.sov).toBeNull();
  });

  it('penalizes hallucination flags', () => {
    const answer = {
      ...baseAnswer,
      notes: {
        flags: ['possible_hallucination']
      }
    };
    const scored = scoreAnswer(answer, context);
    expect(scored.breakdown.accuracy).toBe(0);
  });
});
