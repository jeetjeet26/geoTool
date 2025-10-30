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
  additionalProperties: false,
  properties: {
    ordered_entities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'domain', 'rationale', 'position'],
        additionalProperties: false,
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
        required: ['url', 'domain', 'entity_ref'],
        additionalProperties: false,
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
      required: ['flags'],
      additionalProperties: false,
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

const AllowedFlags = new Set<AnswerBlock['notes']['flags'][number]>(
  AnswerBlockJsonSchema.properties.notes.properties.flags.items.enum
);

function extractString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return first ?? null;
  }

  return null;
}

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

function normalizeFlags(value: unknown): AnswerBlock['notes']['flags'] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: AnswerBlock['notes']['flags'] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const candidate = item as AnswerBlock['notes']['flags'][number];
    if (AllowedFlags.has(candidate)) {
      normalized.push(candidate);
    }
  }

  return normalized;
}

function coerceToAnswerBlock(candidate: unknown): AnswerBlock | null {
  const direct = AnswerBlockSchema.safeParse(candidate);
  if (direct.success) {
    return direct.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const objectCandidate = candidate as Record<string, any>;

  const results = Array.isArray(objectCandidate.results)
    ? objectCandidate.results
    : Array.isArray(objectCandidate.providers)
    ? objectCandidate.providers
    : null;

  if (!results) {
    return null;
  }

  const orderedEntities = results
    .map((item: any, index: number) => {
      const name = extractString(item?.name) ?? extractString(item?.provider?.name);
      const domain = extractString(item?.domain) ?? extractString(item?.provider?.domain);
      if (!name || !domain) {
        return null;
      }
      const rationaleSource =
        typeof item?.rationale === 'string' && item.rationale.trim().length > 0
          ? item.rationale
          : typeof item?.reason === 'string' && item.reason.trim().length > 0
          ? item.reason
          : 'Rationale not provided.';
      const position =
        typeof item?.position === 'number' && Number.isFinite(item.position)
          ? item.position
          : index + 1;

      return {
        name,
        domain,
        rationale: rationaleSource,
        position
      } satisfies AnswerBlock['ordered_entities'][number];
    })
    .filter((value): value is AnswerBlock['ordered_entities'][number] => value !== null);

  if (orderedEntities.length === 0) {
    return null;
  }

  const citations = results.flatMap((item: any, index: number) => {
    if (!Array.isArray(item?.citations)) {
      return [];
    }
    const position =
      typeof item?.position === 'number' && Number.isFinite(item.position)
        ? item.position
        : index + 1;
    return item.citations
      .map((citation: any) => {
        const url = extractString(citation?.url);
        const domain = extractString(citation?.domain);

        if (!url || !domain) {
          return null;
        }
        return {
          url,
          domain,
          entity_ref:
            typeof citation?.entity_ref === 'string' && citation.entity_ref.trim().length > 0
              ? citation.entity_ref
              : String(position)
        } satisfies AnswerBlock['citations'][number];
      })
      .filter(
        (value: AnswerBlock['citations'][number] | null): value is AnswerBlock['citations'][number] =>
          value !== null
      );
  });

  const summary =
    typeof objectCandidate.answer_summary === 'string' && objectCandidate.answer_summary.trim().length > 0
      ? objectCandidate.answer_summary
      : typeof objectCandidate.summary === 'string' && objectCandidate.summary.trim().length > 0
      ? objectCandidate.summary
      : 'No summary provided.';

  const normalized = {
    ordered_entities: orderedEntities,
    citations,
    answer_summary: summary,
    notes: {
      flags: normalizeFlags(objectCandidate.notes?.flags)
    }
  } satisfies AnswerBlock;

  const validated = AnswerBlockSchema.safeParse(normalized);
  return validated.success ? validated.data : null;
}

export class OpenAIConnector implements Connector {
  surface = 'openai' as const;

  async invoke(context: ConnectorContext): Promise<ConnectorResult> {
    const config = getConfig();
    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const prompt = buildPrompt(context);

    const requiresDefaultSampling = /^gpt-5/i.test(config.OPENAI_MODEL) || /^gpt-4\.1/i.test(config.OPENAI_MODEL);
    const requestOptions: Parameters<typeof client.chat.completions.create>[0] = {
      model: config.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a precise GEO audit assistant. Output strict JSON only.' },
        { role: 'user', content: prompt }
      ]
    };

    requestOptions.stream = false;

    requestOptions.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'AnswerBlock',
        strict: true,
        schema: AnswerBlockJsonSchema
      }
    };

    if (!requiresDefaultSampling) {
      requestOptions.temperature = config.TEMPERATURE;
      requestOptions.top_p = config.TOP_P;
    } else {
      if (config.TEMPERATURE !== 1 || config.TOP_P !== 1) {
        console.warn(
          `[openai] Model ${config.OPENAI_MODEL} requires default sampling; ignoring temperature/top_p overrides.`
        );
      }
    }

    // Use Chat Completions to request strict JSON output and parse/validate
    let raw: unknown = null;
    let parsed: AnswerBlock | null = null;

    try {
      const completion = await client.chat.completions.create(requestOptions);

      raw = completion;

      if (!('choices' in completion)) {
        throw new Error('Unexpected streaming response from OpenAI API');
      }

      const content = completion.choices?.[0]?.message?.content ?? '';
      const jsonValue = tryParseJson(content);
      if (jsonValue) {
        const normalized = coerceToAnswerBlock(jsonValue);
        if (normalized) {
          parsed = normalized;
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
