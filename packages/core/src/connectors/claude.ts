import Anthropic from '@anthropic-ai/sdk';
import { AnswerBlockSchema, type AnswerBlock } from '../answer-block.js';
import { getConfig } from '../config.js';
import type { Connector, ConnectorContext, ConnectorResult } from './base.js';

function buildPrompt(context: ConnectorContext): string {
  const domains = context.brandDomains.join(', ');
  const competitors = context.competitors.join(', ');
  return [
    `Task: Perform a GEO audit for the following query and return ONLY valid JSON matching the exact schema.`,
    `Query: ${context.queryText}`,
    `Brand: ${context.brandName}`,
    `Brand domains: ${domains || '—'}`,
    `Competitors: ${competitors || '—'}`,
    ``,
    `Requirements:`,
    `- Produce an ordered list of providers/brands relevant to the query (name, domain, rationale, position starting at 1).`,
    `- Include citations with absolute URLs and their domains.`,
    `- Summarize the answer in 1-2 sentences.`,
    `- If no grounded sources are available, set notes.flags to include "no_sources".`,
    ``,
    `Output format - Return ONLY raw JSON (no markdown code blocks, no explanations, no text before or after):`,
    `{`,
    `  "ordered_entities": [`,
    `    {"name": "...", "domain": "...", "rationale": "...", "position": 1}`,
    `  ],`,
    `  "citations": [`,
    `    {"url": "...", "domain": "...", "entity_ref": "1"}`,
    `  ],`,
    `  "answer_summary": "...",`,
    `  "notes": {"flags": []}`,
    `}`
  ].join('\n');
}

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

function normalizeFlags(value: unknown): AnswerBlock['notes']['flags'] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedFlags = new Set<AnswerBlock['notes']['flags'][number]>([
    'no_sources',
    'possible_hallucination',
    'outdated_info',
    'nap_mismatch',
    'conflicting_prices'
  ]);
  
  const normalized: AnswerBlock['notes']['flags'] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const candidate = item as AnswerBlock['notes']['flags'][number];
    if (allowedFlags.has(candidate)) {
      normalized.push(candidate);
    }
  }

  return normalized;
}

function tryParseJson(content: string): any {
  // First, try direct JSON parse
  try {
    return JSON.parse(content);
  } catch {}

  // Strip markdown code blocks (```json ... ``` or ``` ... ```)
  let cleaned = content.trim();
  
  // Remove markdown code block fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();
  
  // Try parsing cleaned content
  try {
    return JSON.parse(cleaned);
  } catch {}
  
  // Try to extract JSON object from text (look for first { to last })
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch {}
  }
  
  // Fallback: try regex match from end
  const match = content.match(/\{[\s\S]*\}$/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  
  return null;
}

function coerceToAnswerBlock(candidate: unknown): AnswerBlock | null {
  // First, try direct validation
  const direct = AnswerBlockSchema.safeParse(candidate);
  if (direct.success) {
    return direct.data;
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const objectCandidate = candidate as Record<string, any>;

  // Try to extract ordered_entities - handle multiple possible structures
  let orderedEntities: AnswerBlock['ordered_entities'] = [];
  
  // Support both direct ordered_entities and alternative structures (results, providers)
  const entitiesSource = Array.isArray(objectCandidate.ordered_entities)
    ? objectCandidate.ordered_entities
    : Array.isArray(objectCandidate.results)
    ? objectCandidate.results
    : Array.isArray(objectCandidate.providers)
    ? objectCandidate.providers
    : null;

  if (entitiesSource) {
    orderedEntities = entitiesSource
      .map((item: any, index: number) => {
        // Support nested structures (e.g., item.provider.name)
        const name = extractString(item?.name) ?? extractString(item?.provider?.name);
        const domain = extractString(item?.domain) ?? extractString(item?.provider?.domain);
        if (!name || !domain) {
          return null;
        }
        const rationale =
          typeof item?.rationale === 'string' && item.rationale.trim().length > 0
            ? item.rationale
            : typeof item?.reason === 'string' && item.reason.trim().length > 0
            ? item.reason
            : 'Rationale not provided.';
        const position =
          typeof item?.position === 'number' && Number.isFinite(item.position) && item.position > 0
            ? item.position
            : index + 1;

        return {
          name,
          domain,
          rationale,
          position
        } satisfies AnswerBlock['ordered_entities'][number];
      })
      .filter((value): value is AnswerBlock['ordered_entities'][number] => value !== null);
  }

  // Try to extract citations - support both top-level and nested in entities
  let citations: AnswerBlock['citations'] = [];
  
  if (Array.isArray(objectCandidate.citations)) {
    // Top-level citations array
    const mappedCitations = objectCandidate.citations
      .map((citation: any): AnswerBlock['citations'][number] | null => {
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
              : undefined
        };
      });
    citations = mappedCitations.filter(
      (value): value is AnswerBlock['citations'][number] => value !== null
    );
  } else if (entitiesSource) {
    // Extract citations from nested entity structures (like OpenAI format)
    const nestedCitations = entitiesSource.flatMap((item: any, index: number) => {
      if (!Array.isArray(item?.citations)) {
        return [];
      }
      const position =
        typeof item?.position === 'number' && Number.isFinite(item.position)
          ? item.position
          : index + 1;
      const itemCitations = item.citations
        .map((citation: any): AnswerBlock['citations'][number] | null => {
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
          };
        });
      return itemCitations.filter(
        (value: AnswerBlock['citations'][number] | null): value is AnswerBlock['citations'][number] =>
          value !== null
      );
    });
    citations = nestedCitations;
  }

  // Extract answer summary
  const summary =
    typeof objectCandidate.answer_summary === 'string' && objectCandidate.answer_summary.trim().length > 0
      ? objectCandidate.answer_summary
      : typeof objectCandidate.summary === 'string' && objectCandidate.summary.trim().length > 0
      ? objectCandidate.summary
      : 'No summary provided.';

  // Extract notes/flags
  const flags = normalizeFlags(objectCandidate.notes?.flags || objectCandidate.flags || []);

  // Build normalized answer block
  const normalized = {
    ordered_entities: orderedEntities,
    citations,
    answer_summary: summary,
    notes: {
      flags
    }
  } satisfies AnswerBlock;

  // Validate the normalized structure
  const validated = AnswerBlockSchema.safeParse(normalized);
  return validated.success ? validated.data : null;
}

export class ClaudeConnector implements Connector {
  surface = 'claude' as const;

  async invoke(context: ConnectorContext): Promise<ConnectorResult> {
    const requestStart = Date.now();
    const config = getConfig();
    const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    const prompt = buildPrompt(context);

    console.log('[claude] ===== API Request Started =====');
    console.log('[claude] Query ID:', context.queryId);
    console.log('[claude] Query Text:', context.queryText);
    console.log('[claude] Brand Name:', context.brandName);
    console.log('[claude] Brand Domains:', context.brandDomains.join(', ') || '(none)');
    console.log('[claude] Competitors:', context.competitors.join(', ') || '(none)');
    console.log('[claude] Model:', config.ANTHROPIC_MODEL);
    console.log('[claude] Temperature:', config.TEMPERATURE);
    console.log('[claude] Max Tokens: 1200');
    console.log('[claude] Prompt Length:', prompt.length, 'characters');

    let raw: unknown = null;
    let parsed: AnswerBlock | null = null;

    try {
      console.log('[claude] Sending request to Anthropic API...');
      const apiRequestStart = Date.now();
      
      const response = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 1200,
        temperature: config.TEMPERATURE,
        system: 'You are a precise GEO audit assistant. You must output ONLY valid JSON without any markdown formatting, code blocks, or explanatory text. Return raw JSON that can be directly parsed.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const apiRequestDuration = Date.now() - apiRequestStart;
      raw = response;

      console.log('[claude] ===== API Response Received =====');
      console.log('[claude] API Request Duration:', apiRequestDuration, 'ms');
      console.log('[claude] Response ID:', (response as any).id || 'N/A');
      console.log('[claude] Response Type:', (response as any).type || 'N/A');
      console.log('[claude] Response Model:', (response as any).model || config.ANTHROPIC_MODEL);
      console.log('[claude] Stop Reason:', (response as any).stop_reason || 'N/A');
      console.log('[claude] Stop Sequence:', (response as any).stop_sequence || 'N/A');
      console.log('[claude] Usage - Input Tokens:', (response as any).usage?.input_tokens || 'N/A');
      console.log('[claude] Usage - Output Tokens:', (response as any).usage?.output_tokens || 'N/A');
      console.log('[claude] Content Blocks Count:', Array.isArray((response as any).content) ? (response as any).content.length : 0);

      const textBlocks = ((response.content ?? []).filter((b: any) => b.type === 'text')) as Array<{
        type: 'text';
        text: string;
      }>;
      
      console.log('[claude] Text Blocks Found:', textBlocks.length);
      
      const contentText = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('\n') : '';
      console.log('[claude] Extracted Content Length:', contentText.length, 'characters');
      console.log('[claude] Content Preview:', contentText.substring(0, 200), contentText.length > 200 ? '...' : '');

      console.log('[claude] Attempting to parse JSON from response...');
      const jsonValue = tryParseJson(contentText);
      
      if (jsonValue) {
        console.log('[claude] JSON parsed successfully');
        console.log('[claude] Parsed JSON Keys:', Object.keys(jsonValue).join(', '));
        console.log('[claude] Ordered Entities Count:', Array.isArray(jsonValue.ordered_entities) ? jsonValue.ordered_entities.length : 0);
        console.log('[claude] Citations Count:', Array.isArray(jsonValue.citations) ? jsonValue.citations.length : 0);
        console.log('[claude] Answer Summary Length:', jsonValue.answer_summary?.length || 0);
        console.log('[claude] Flags:', jsonValue.notes?.flags || []);

        console.log('[claude] Attempting to coerce/validate AnswerBlock...');
        const coerced = coerceToAnswerBlock(jsonValue);
        
        if (coerced) {
          parsed = coerced;
          console.log('[claude] ✓ Coercion/validation successful');
          console.log('[claude] Validated Entities:', parsed.ordered_entities.length);
          console.log('[claude] Validated Citations:', parsed.citations.length);
          console.log('[claude] Validated Flags:', parsed.notes.flags.join(', ') || '(none)');
          console.log('[claude] Answer Summary:', parsed.answer_summary.substring(0, 100) + (parsed.answer_summary.length > 100 ? '...' : ''));
          
          // Log entity details
          if (parsed.ordered_entities.length > 0) {
            console.log('[claude] Entity Details:');
            parsed.ordered_entities.forEach((entity, idx) => {
              console.log(`[claude]   [${idx + 1}] ${entity.name} (${entity.domain}) - Position: ${entity.position}`);
            });
          }
          
          // Log citation details
          if (parsed.citations.length > 0) {
            console.log('[claude] Citation Details:');
            parsed.citations.slice(0, 5).forEach((citation, idx) => {
              console.log(`[claude]   [${idx + 1}] ${citation.domain} - ${citation.url.substring(0, 60)}${citation.url.length > 60 ? '...' : ''}`);
            });
            if (parsed.citations.length > 5) {
              console.log(`[claude]   ... and ${parsed.citations.length - 5} more citations`);
            }
          }
        } else {
          console.error('[claude] ✗ Coercion failed - JSON structure not recognized');
          console.error('[claude] Original JSON Value:', JSON.stringify(jsonValue, null, 2));
        }
      } else {
        console.warn('[claude] ✗ Failed to parse JSON from content');
        console.warn('[claude] Content Text:', contentText);
      }
    } catch (error) {
      const errorDuration = Date.now() - requestStart;
      console.error('[claude] ===== API Request Failed =====');
      console.error('[claude] Error Duration:', errorDuration, 'ms');
      
      // Extract detailed error information for better debugging
      let errorDetails: any = { message: String(error) };
      
      if (error instanceof Error) {
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
        
        console.error('[claude] Error Name:', error.name);
        console.error('[claude] Error Message:', error.message);
        
        // Try to extract API error details if available
        if (error.message.includes('404') || error.message.includes('not_found')) {
          errorDetails.apiError = 'Model not found - check model name format';
          console.error('[claude] Error Type: Model not found (404)');
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorDetails.apiError = 'Authentication failed - check API key';
          console.error('[claude] Error Type: Authentication failed (401)');
        } else if (error.message.includes('429') || error.message.includes('rate_limit')) {
          errorDetails.apiError = 'Rate limit exceeded';
          console.error('[claude] Error Type: Rate limit exceeded (429)');
        } else {
          console.error('[claude] Error Type: Unknown');
        }
      }
      
      // Try to parse JSON error if present
      try {
        const jsonMatch = error instanceof Error ? error.message.match(/\{[\s\S]*\}/) : null;
        if (jsonMatch) {
          errorDetails.parsedError = JSON.parse(jsonMatch[0]);
          console.error('[claude] Parsed Error JSON:', JSON.stringify(errorDetails.parsedError, null, 2));
        }
      } catch {}
      
      console.error('[claude] Full Error Details:', JSON.stringify(errorDetails, null, 2));
      
      raw = { error: errorDetails };
      
      console.error('[claude] API call failed', {
        model: config.ANTHROPIC_MODEL,
        queryId: context.queryId,
        error: errorDetails
      });
    }

    const totalDuration = Date.now() - requestStart;
    console.log('[claude] ===== Request Complete =====');
    console.log('[claude] Total Duration:', totalDuration, 'ms');
    console.log('[claude] Success:', parsed !== null ? 'Yes' : 'No');
    console.log('[claude] Parsed Result:', parsed ? 'Valid AnswerBlock' : 'Fallback/Error');

    if (!parsed) {
      const errorMessage = raw && typeof raw === 'object' && 'error' in raw 
        ? (raw.error as any)?.message || 'No structured sources returned'
        : 'No structured sources returned';
        
      console.warn('[claude] Returning fallback answer');
      console.warn('[claude] Fallback Message:', errorMessage);
      
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

    console.log('[claude] Returning parsed answer with', parsed.ordered_entities.length, 'entities and', parsed.citations.length, 'citations');
    return { answer: parsed, raw };
  }
}
