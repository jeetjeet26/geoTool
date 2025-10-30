import OpenAI from 'openai';
import { AnswerBlockSchema, type AnswerBlock } from '../answer-block.js';
import { getConfig } from '../config.js';
import type { Connector, ConnectorContext, ConnectorResult } from './base.js';

function buildPrompt(context: ConnectorContext): string {
  const domains = context.brandDomains.join(', ');
  const competitors = context.competitors.join(', ');
  return [
    `Task: Perform a GEO audit for the following query and return ONLY the JSON object matching the schema.`,
    `Query: ${context.queryText}`,
    `Brand: ${context.brandName}`,
    `Brand domains: ${domains || '—'}`,
    `Competitors: ${competitors || '—'}`,
    `Requirements:`,
    `- Produce an ordered list of providers/brands relevant to the query (name, domain, rationale, position starting at 1).`,
    `- Include citations with absolute URLs and their domains.`,
    `- Summarize the answer in 1-2 sentences.`,
    `- If no grounded sources are available, set notes.flags to include "no_sources".`,
    `Output: Return ONLY the JSON object, no markdown, no explanations.`
  ].join('\n');
}

// Minimal JSON schema matching AnswerBlock for OpenAI structured outputs
const AnswerBlockJsonSchema = {
  $schema: 'https://json-schema.org/draft-07/schema#',
  title: 'AnswerBlock',
  type: 'object',
  required: ['ordered_entities', 'citations', 'answer_summary', 'notes'],
  properties: {
    ordered_entities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'domain', 'rationale', 'position'],
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          rationale: { type: 'string' },
          position: { type: 'integer', minimum: 1 }
        }
      }
    },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['url', 'domain'],
        properties: {
          url: { type: 'string' },
          domain: { type: 'string' },
          entity_ref: { type: 'string' }
        }
      }
    },
    answer_summary: { type: 'string' },
    notes: {
      type: 'object',
      properties: {
        flags: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'no_sources',
              'possible_hallucination',
              'outdated_info',
              'nap_mismatch',
              'conflicting_prices'
            ]
          }
        }
      }
    }
  }
} as const;

function tryParseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}$/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return null;
  }
}

export class OpenAIConnector implements Connector {
  surface = 'openai' as const;

  async invoke(context: ConnectorContext): Promise<ConnectorResult> {
    const config = getConfig();
    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const prompt = buildPrompt(context);

    // Use Chat Completions to request strict JSON output and parse/validate
    let raw: unknown = null;
    let parsed: AnswerBlock | null = null;

    try {
      const completion = await client.chat.completions.create({
        model: config.OPENAI_MODEL,
        temperature: config.TEMPERATURE,
        top_p: config.TOP_P,
        messages: [
          { role: 'system', content: 'You are a precise GEO audit assistant. Output strict JSON only.' },
          { role: 'user', content: prompt }
        ]
      });

      raw = completion;
      const content = completion.choices?.[0]?.message?.content ?? '';
      const jsonValue = tryParseJson(content);
      if (jsonValue) {
        const validated = AnswerBlockSchema.safeParse(jsonValue);
        if (validated.success) {
          parsed = validated.data;
        }
      }
    } catch (error) {
      raw = { error: String(error) };
    }

    if (!parsed) {
      return {
        answer: {
          ordered_entities: [],
          citations: [],
          answer_summary: 'No structured sources returned',
          notes: { flags: ['no_sources'] }
        },
        raw
      };
    }

    return { answer: parsed, raw };
  }
}
