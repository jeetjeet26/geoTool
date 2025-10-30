import { z } from 'zod';

export const AnswerEntitySchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  rationale: z.string().min(1),
  position: z.number().int().min(1)
});

export const AnswerCitationSchema = z.object({
  url: z.string().url(),
  domain: z.string().min(1),
  entity_ref: z.string().optional()
});

export const AnswerBlockSchema = z.object({
  ordered_entities: z.array(AnswerEntitySchema),
  citations: z.array(AnswerCitationSchema),
  answer_summary: z.string(),
  notes: z
    .object({
      flags: z
        .array(
          z.enum([
            'no_sources',
            'possible_hallucination',
            'outdated_info',
            'nap_mismatch',
            'conflicting_prices'
          ])
        )
        .default([])
    })
    .default({ flags: [] })
});

export type AnswerBlock = z.infer<typeof AnswerBlockSchema>;
