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
    const requestStart = Date.now();
    const config = getConfig();
    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const prompt = buildPrompt(context);

    console.log('[openai] ===== API Request Started =====');
    console.log('[openai] Query ID:', context.queryId);
    console.log('[openai] Query Text:', context.queryText);
    console.log('[openai] Brand Name:', context.brandName);
    console.log('[openai] Brand Domains:', context.brandDomains.join(', ') || '(none)');
    console.log('[openai] Competitors:', context.competitors.join(', ') || '(none)');
    console.log('[openai] Model:', config.OPENAI_MODEL);
    console.log('[openai] Temperature:', config.TEMPERATURE);
    console.log('[openai] Top P:', config.TOP_P);
    console.log('[openai] Prompt Length:', prompt.length, 'characters');

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

    console.log('[openai] Request Options:', {
      model: requestOptions.model,
      stream: requestOptions.stream,
      response_format: 'json_schema (strict)',
      has_system_message: true,
      user_message_length: prompt.length
    });

    if (!requiresDefaultSampling) {
      requestOptions.temperature = config.TEMPERATURE;
      requestOptions.top_p = config.TOP_P;
      console.log('[openai] Using custom sampling - Temperature:', config.TEMPERATURE, 'Top P:', config.TOP_P);
    } else {
      if (config.TEMPERATURE !== 1 || config.TOP_P !== 1) {
        console.warn(
          `[openai] Model ${config.OPENAI_MODEL} requires default sampling; ignoring temperature/top_p overrides.`
        );
      }
      console.log('[openai] Using default sampling (model requirement)');
    }

    // Use Chat Completions to request strict JSON output and parse/validate
    let raw: unknown = null;
    let parsed: AnswerBlock | null = null;

    try {
      console.log('[openai] Sending request to OpenAI API...');
      const apiRequestStart = Date.now();
      
      const completion = await client.chat.completions.create(requestOptions);
      
      const apiRequestDuration = Date.now() - apiRequestStart;
      raw = completion;

      if (!('choices' in completion)) {
        throw new Error('Unexpected streaming response from OpenAI API');
      }

      // Type narrowing: now TypeScript knows completion is ChatCompletion, not a Stream
      console.log('[openai] ===== API Response Received =====');
      console.log('[openai] API Request Duration:', apiRequestDuration, 'ms');
      console.log('[openai] Response ID:', completion.id || 'N/A');
      console.log('[openai] Response Model:', completion.model || config.OPENAI_MODEL);
      console.log('[openai] Response Object:', completion.object || 'N/A');
      console.log('[openai] Created:', completion.created || 'N/A');
      console.log('[openai] Choices Count:', Array.isArray(completion.choices) ? completion.choices.length : 0);
      
      if (completion.usage) {
        console.log('[openai] Usage - Prompt Tokens:', completion.usage.prompt_tokens || 'N/A');
        console.log('[openai] Usage - Completion Tokens:', completion.usage.completion_tokens || 'N/A');
        console.log('[openai] Usage - Total Tokens:', completion.usage.total_tokens || 'N/A');
      }

      const choice = completion.choices?.[0];
      if (choice) {
        console.log('[openai] Finish Reason:', choice.finish_reason || 'N/A');
        console.log('[openai] Index:', choice.index || 'N/A');
      }

      const content = completion.choices?.[0]?.message?.content ?? '';
      console.log('[openai] Extracted Content Length:', content.length, 'characters');
      console.log('[openai] Content Preview:', content.substring(0, 200), content.length > 200 ? '...' : '');

      console.log('[openai] Attempting to parse JSON from response...');
      const jsonValue = tryParseJson(content);
      
      if (jsonValue) {
        console.log('[openai] JSON parsed successfully');
        console.log('[openai] Parsed JSON Keys:', Object.keys(jsonValue).join(', '));
        console.log('[openai] Ordered Entities Count:', Array.isArray(jsonValue.ordered_entities) ? jsonValue.ordered_entities.length : 0);
        console.log('[openai] Citations Count:', Array.isArray(jsonValue.citations) ? jsonValue.citations.length : 0);
        console.log('[openai] Answer Summary Length:', jsonValue.answer_summary?.length || 0);
        console.log('[openai] Flags:', jsonValue.notes?.flags || []);

        console.log('[openai] Attempting to coerce/validate AnswerBlock...');
        const normalized = coerceToAnswerBlock(jsonValue);
        
        if (normalized) {
          parsed = normalized;
          console.log('[openai] ✓ Coercion successful');
          console.log('[openai] Validated Entities:', parsed.ordered_entities.length);
          console.log('[openai] Validated Citations:', parsed.citations.length);
          console.log('[openai] Validated Flags:', parsed.notes.flags.join(', ') || '(none)');
          console.log('[openai] Answer Summary:', parsed.answer_summary.substring(0, 100) + (parsed.answer_summary.length > 100 ? '...' : ''));
          
          // Log entity details
          if (parsed.ordered_entities.length > 0) {
            console.log('[openai] Entity Details:');
            parsed.ordered_entities.forEach((entity, idx) => {
              console.log(`[openai]   [${idx + 1}] ${entity.name} (${entity.domain}) - Position: ${entity.position}`);
            });
          }
          
          // Log citation details
          if (parsed.citations.length > 0) {
            console.log('[openai] Citation Details:');
            parsed.citations.slice(0, 5).forEach((citation, idx) => {
              console.log(`[openai]   [${idx + 1}] ${citation.domain} - ${citation.url.substring(0, 60)}${citation.url.length > 60 ? '...' : ''}`);
            });
            if (parsed.citations.length > 5) {
              console.log(`[openai]   ... and ${parsed.citations.length - 5} more citations`);
            }
          }
        } else {
          console.error('[openai] ✗ Coercion failed - JSON structure not recognized');
          console.error('[openai] Original JSON Value:', JSON.stringify(jsonValue, null, 2));
        }
      } else {
        console.warn('[openai] ✗ Failed to parse JSON from content');
        console.warn('[openai] Content Text:', content);
      }
    } catch (error) {
      const errorDuration = Date.now() - requestStart;
      console.error('[openai] ===== API Request Failed =====');
      console.error('[openai] Error Duration:', errorDuration, 'ms');
      
      // Extract detailed error information for better debugging
      let errorDetails: any = { message: String(error) };
      
      if (error instanceof Error) {
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
        
        console.error('[openai] Error Name:', error.name);
        console.error('[openai] Error Message:', error.message);
        
        // Try to extract API error details if available
        if (error.message.includes('404') || error.message.includes('not_found')) {
          errorDetails.apiError = 'Model not found - check model name format';
          console.error('[openai] Error Type: Model not found (404)');
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorDetails.apiError = 'Authentication failed - check API key';
          console.error('[openai] Error Type: Authentication failed (401)');
        } else if (error.message.includes('429') || error.message.includes('rate_limit')) {
          errorDetails.apiError = 'Rate limit exceeded';
          console.error('[openai] Error Type: Rate limit exceeded (429)');
        } else {
          console.error('[openai] Error Type: Unknown');
        }
      }
      
      // Try to parse JSON error if present
      try {
        const jsonMatch = error instanceof Error ? error.message.match(/\{[\s\S]*\}/) : null;
        if (jsonMatch) {
          errorDetails.parsedError = JSON.parse(jsonMatch[0]);
          console.error('[openai] Parsed Error JSON:', JSON.stringify(errorDetails.parsedError, null, 2));
        }
      } catch {}
      
      console.error('[openai] Full Error Details:', JSON.stringify(errorDetails, null, 2));
      
      raw = { error: errorDetails };
      
      console.error('[openai] API call failed', {
        model: config.OPENAI_MODEL,
        queryId: context.queryId,
        error: errorDetails
      });
    }

    const totalDuration = Date.now() - requestStart;
    console.log('[openai] ===== Request Complete =====');
    console.log('[openai] Total Duration:', totalDuration, 'ms');
    console.log('[openai] Success:', parsed !== null ? 'Yes' : 'No');
    console.log('[openai] Parsed Result:', parsed ? 'Valid AnswerBlock' : 'Fallback/Error');

    if (!parsed) {
      const errorMessage = raw && typeof raw === 'object' && 'error' in raw 
        ? (raw.error as any)?.message || 'No structured sources returned'
        : 'No structured sources returned';
        
      console.warn('[openai] Returning fallback answer');
      console.warn('[openai] Fallback Message:', errorMessage);
      
      return {
        answer: {
          ordered_entities: [],
          citations: [],
          answer_summary: errorMessage,
          notes: { flags: ['no_sources'] }
        },
        raw
      };
    }

    console.log('[openai] Returning parsed answer with', parsed.ordered_entities.length, 'entities and', parsed.citations.length, 'citations');
    return { answer: parsed, raw };
  }
}
