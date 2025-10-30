import pLimit from 'p-limit';

import type { Prisma } from '@prisma/client';

import {
  ClaudeConnector,
  OpenAIConnector,
  aggregateScores,
  getConfig,
  scoreAnswer,
  type AnswerBlock,
  type Connector,
  type ScoredAnswer,
  type Surface,
  isBrandDomain
} from '@geo/core';

import { prisma } from './index.js';

export interface RunOptions {
  clientId: string;
  surfaces: Surface[];
  limit?: number;
}

interface QueryTaskResult {
  queryId: string;
  scored: ScoredAnswer;
}

function serializeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function getConnector(surface: Surface): Connector {
  switch (surface) {
    case 'openai':
      return new OpenAIConnector();
    case 'claude':
      return new ClaudeConnector();
    default:
      throw new Error(`Unsupported surface: ${surface}`);
  }
}

function fallbackAnswer(summary: string): AnswerBlock {
  return {
    ordered_entities: [],
    citations: [],
    answer_summary: summary,
    notes: {
      flags: ['no_sources']
    }
  };
}

async function persistQueryResult({
  runId,
  queryId,
  answer,
  scored,
  raw,
  brandDomains
}: {
  runId: string;
  queryId: string;
  answer: AnswerBlock;
  scored: ScoredAnswer;
  raw: unknown;
  brandDomains: string[];
}) {
  const rawPayload = {
    answer,
    score: scored,
    raw
  } as const;

  const answerRecord = await prisma.answer.create({
    data: {
      runId,
      queryId,
      presence: scored.presence,
      llmRank: scored.llmRank,
      linkRank: scored.linkRank,
      sov: scored.sov,
      flags: scored.flags,
      rawJson: rawPayload as unknown as Prisma.InputJsonValue
    }
  });

  if (answer.citations.length > 0) {
    await prisma.citation.createMany({
      data: answer.citations.map((citation) => ({
        answerId: answerRecord.id,
        url: citation.url,
        domain: citation.domain,
        isBrandDomain: isBrandDomain(citation.domain, brandDomains)
      }))
    });
  }
}

export async function runSurface(options: RunOptions, surface: Surface, connector: Connector) {
  const config = getConfig();
  const surfaceStart = Date.now();
  const surfaceContext = {
    clientId: options.clientId,
    surface,
    connector: connector.constructor.name
  } as const;

  console.info('[run] Starting surface crawl', surfaceContext);

  const client = await prisma.client.findUnique({
    where: { id: options.clientId },
    select: {
      id: true,
      name: true,
      domains: true,
      competitors: true
    }
  });

  if (!client) {
    console.error('[run] Client not found', surfaceContext);
    throw new Error(`Client ${options.clientId} not found`);
  }

  const queries = await prisma.query.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'asc' }
  });

  console.info('[run] Loaded client queries', {
    ...surfaceContext,
    clientName: client.name,
    queryCount: queries.length,
    limit: options.limit ?? null
  });

  if (queries.length === 0) {
    console.warn('[run] Client has no queries configured', surfaceContext);
    throw new Error('No queries configured for this client');
  }

  const limitedQueries = options.limit ? queries.slice(0, options.limit) : queries;

  console.info('[run] Creating run record', {
    ...surfaceContext,
    totalQueries: limitedQueries.length,
    concurrency: config.RUN_DEFAULT_BATCH
  });

  const run = await prisma.run.create({
    data: {
      clientId: client.id,
      surface,
      modelName: surface === 'openai' ? config.OPENAI_MODEL : config.ANTHROPIC_MODEL
    }
  });

  const limit = pLimit(config.RUN_DEFAULT_BATCH);

  const queryResults = (await Promise.all(
    limitedQueries.map((query) =>
      limit(async () => {
        const taskStart = Date.now();
        const queryContext = {
          ...surfaceContext,
          runId: run.id,
          queryId: query.id,
          queryText: query.text
        } as const;

        console.info('[run] Query dispatched', queryContext);

        const evaluationContext = {
          brandName: client.name,
          brandDomains: client.domains,
          competitors: client.competitors
        } as const;

        try {
          const result = await connector.invoke({
            queryId: query.id,
            queryText: query.text,
            brandName: client.name,
            brandDomains: client.domains,
            competitors: client.competitors
          });

          const scored = scoreAnswer(result.answer, evaluationContext);

          await persistQueryResult({
            runId: run.id,
            queryId: query.id,
            answer: result.answer,
            scored,
            raw: result.raw,
            brandDomains: client.domains
          });

          console.info('[run] Query completed', {
            ...queryContext,
            presence: scored.presence,
            llmRank: scored.llmRank,
            linkRank: scored.linkRank,
            sov: scored.sov,
            score: scored.score,
            durationMs: Date.now() - taskStart
          });

          return {
            queryId: query.id,
            scored
          } satisfies QueryTaskResult;
        } catch (error) {
          const serialized = serializeError(error);
          console.error('[run] Query failed, persisting fallback answer', {
            ...queryContext,
            error: serialized,
            durationMs: Date.now() - taskStart
          });

          const answer = fallbackAnswer('Connector error');
          const scored = scoreAnswer(answer, evaluationContext);
          scored.flags = [...new Set([...scored.flags, 'connector_error'])];

          await persistQueryResult({
            runId: run.id,
            queryId: query.id,
            answer,
            scored,
            raw: { error: String(error) },
            brandDomains: client.domains
          });

          console.info('[run] Query recorded with fallback', {
            ...queryContext,
            flags: scored.flags,
            durationMs: Date.now() - taskStart
          });

          return {
            queryId: query.id,
            scored
          } satisfies QueryTaskResult;
        }
      })
    )
  )) as QueryTaskResult[];

  const aggregate = aggregateScores(queryResults.map((result) => result.scored));

  await prisma.score.create({
    data: {
      runId: run.id,
      overallScore: aggregate.overallScore,
      visibilityPct: aggregate.visibilityPct,
      details: {
        breakdown: queryResults.map((result) => ({
          queryId: result.queryId,
          score: result.scored.score,
          breakdown: result.scored.breakdown,
          presence: result.scored.presence
        }))
      } as unknown as Prisma.InputJsonValue
    }
  });

  await prisma.run.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date()
    }
  });

  console.info('[run] Surface crawl completed', {
    ...surfaceContext,
    runId: run.id,
    aggregate,
    durationMs: Date.now() - surfaceStart
  });

  return aggregate;
}

export async function runClientOnce(options: RunOptions) {
  getConfig();

  const runStart = Date.now();
  console.info('[run] Starting client crawl', {
    clientId: options.clientId,
    surfaces: options.surfaces,
    limit: options.limit ?? null
  });

  for (const surface of options.surfaces) {
    const connector = getConnector(surface);
    await runSurface(options, surface, connector);
  }

  console.info('[run] Completed client crawl', {
    clientId: options.clientId,
    surfaces: options.surfaces,
    durationMs: Date.now() - runStart
  });
}

export async function runAllClients({
  surfaces,
  limit
}: {
  surfaces: Surface[];
  limit?: number;
}) {
  const clients = await prisma.client.findMany({
    select: {
      id: true
    }
  });

  for (const client of clients) {
    await runClientOnce({ clientId: client.id, surfaces, limit });
  }
}

