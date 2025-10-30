import Anthropic from '@anthropic-ai/sdk';
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

export class ClaudeConnector implements Connector {
  surface = 'claude' as const;

  async invoke(context: ConnectorContext): Promise<ConnectorResult> {
    const config = getConfig();
    const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    const prompt = buildPrompt(context);

    let raw: unknown = null;
    let parsed: AnswerBlock | null = null;

    try {
      const response = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 1200,
        temperature: config.TEMPERATURE,
        system: 'You are a precise GEO audit assistant. Output strict JSON only.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      raw = response;

      const textBlocks = ((response.content ?? []).filter((b: any) => b.type === 'text')) as Array<{
        type: 'text';
        text: string;
      }>;
      const contentText = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('\n') : '';
      const jsonValue = tryParseJson(contentText);
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
