import type { Prisma, QueryAnnotationTagEnum, QueryTypeEnum, SurfaceEnum, KpiUnitEnum } from '@prisma/client';

import type { Surface } from '@geo/core';
import { getConfig } from '@geo/core';

import { prisma } from './index.js';

export type RunSummary = {
  runId: string;
  clientId: string;
  surface: Surface;
  modelName: string;
  startedAt: Date;
  finishedAt: Date | null;
  overallScore: number;
  visibilityPct: number;
};

export type ClientRecord = {
  id: string;
  name: string;
  domains: string[];
  competitors: string[];
  primaryGeo: string | null;
  narrativeNotes: string | null;
  reportingCadence: string | null;
  baselineRunId: string | null;
  visibilityTarget: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientQueryRecord = {
  id: string;
  text: string;
  type: QueryType;
  geo: string | null;
  weight: number | null;
  createdAt: Date;
  updatedAt: Date;
  annotations: QueryAnnotationRecord[];
};

export type ClientWithQueries = ClientRecord & {
  queries: ClientQueryRecord[];
  kpis: ClientKpiRecord[];
};

type QueryType = QueryTypeEnum;

export type QueryRow = {
  queryId: string;
  text: string;
  type: string;
  presence: boolean;
  llmRank: number | null;
  linkRank: number | null;
  sov: number | null;
  flags: string[];
  score: number;
  breakdown: {
    position: number;
    link: number;
    sov: number;
    accuracy: number;
  };
  deltas?: QueryDelta;
  error?: {
    message: string;
    summary?: string;
  };
};

export type QueryDelta = {
  presenceDelta: number;
  llmRankDelta: number | null;
  linkRankDelta: number | null;
  sovDelta: number | null;
  scoreDelta: number | null;
};

export type RunDetail = {
  run: RunSummary;
  queries: QueryRow[];
};

export type ClientKpiRecord = {
  id: string;
  clientId: string;
  label: string;
  description: string | null;
  unit: ClientKpiUnit;
  targetValue: number | null;
  currentValue: number | null;
  visibilityLink: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientKpiUnit = 'percent' | 'number' | 'currency' | 'ratio';

export type QueryEvidenceRecord = {
  id: string;
  annotationId: string;
  label: string;
  excerpt: string | null;
  url: string | null;
  createdAt: Date;
};

export type QueryAnnotationTag = QueryAnnotationTagEnum;

export type QueryAnnotationRecord = {
  id: string;
  clientId: string;
  queryId: string;
  runId: string | null;
  surface: Surface | null;
  tags: QueryAnnotationTag[];
  note: string | null;
  evidence: QueryEvidenceRecord[];
  createdAt: Date;
  updatedAt: Date;
};

function mapClientRecord(client: any): ClientRecord {
  return {
    id: client.id,
    name: client.name,
    domains: client.domains,
    competitors: client.competitors,
    primaryGeo: client.primaryGeo ?? null,
    narrativeNotes: client.narrativeNotes ?? null,
    reportingCadence: client.reportingCadence ?? null,
    baselineRunId: client.baselineRunId ?? null,
    visibilityTarget:
      client.visibilityTarget !== null && client.visibilityTarget !== undefined
        ? Number(client.visibilityTarget)
        : null,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt
  } satisfies ClientRecord;
}

function mapQueryRecord(query: any): ClientQueryRecord {
  return {
    id: query.id,
    text: query.text,
    type: query.type,
    geo: query.geo,
    weight: query.weight !== null && query.weight !== undefined ? Number(query.weight) : null,
    createdAt: query.createdAt,
    updatedAt: query.updatedAt,
    annotations: (query.annotations ?? []).map(mapAnnotationRecord)
  } satisfies ClientQueryRecord;
}

function mapEvidenceRecord(evidence: any): QueryEvidenceRecord {
  return {
    id: evidence.id,
    annotationId: evidence.annotationId,
    label: evidence.label,
    excerpt: evidence.excerpt ?? null,
    url: evidence.url ?? null,
    createdAt: evidence.createdAt
  } satisfies QueryEvidenceRecord;
}

function mapAnnotationRecord(annotation: any): QueryAnnotationRecord {
  return {
    id: annotation.id,
    clientId: annotation.clientId,
    queryId: annotation.queryId,
    runId: annotation.runId ?? null,
    surface: annotation.surface ? (annotation.surface as Surface) : null,
    tags: (annotation.tags ?? []) as QueryAnnotationTag[],
    note: annotation.note ?? null,
    evidence: (annotation.evidence ?? []).map(mapEvidenceRecord),
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt
  } satisfies QueryAnnotationRecord;
}

function mapKpiRecord(kpi: any): ClientKpiRecord {
  return {
    id: kpi.id,
    clientId: kpi.clientId,
    label: kpi.label,
    description: kpi.description ?? null,
    unit: kpi.unit as ClientKpiUnit,
    targetValue: kpi.targetValue !== null && kpi.targetValue !== undefined ? Number(kpi.targetValue) : null,
    currentValue: kpi.currentValue !== null && kpi.currentValue !== undefined ? Number(kpi.currentValue) : null,
    visibilityLink:
      kpi.visibilityLink !== null && kpi.visibilityLink !== undefined ? Number(kpi.visibilityLink) : null,
    createdAt: kpi.createdAt,
    updatedAt: kpi.updatedAt
  } satisfies ClientKpiRecord;
}

export async function listClients(): Promise<ClientRecord[]> {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' }
  });

  return clients.map(mapClientRecord);
}

export async function getClientById(clientId: string): Promise<ClientRecord | null> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });

  return client ? mapClientRecord(client) : null;
}

interface GenerateQueryOptions {
  brandName: string;
  primaryGeo: string | null;
  competitors: string[];
}

function generateDefaultQueries({ brandName, primaryGeo, competitors }: GenerateQueryOptions) {
  const locationLabel = primaryGeo?.trim() || 'the area';
  const shortLocation = primaryGeo?.split(',')[0]?.trim() ?? primaryGeo ?? 'the area';
  const primaryCompetitor = competitors[0]?.trim();
  const comparisonTarget = primaryCompetitor || 'other nearby apartments';

  const queries: Array<{
    text: string;
    type: QueryType;
    geo?: string | null;
    weight?: number;
  }> = [
    {
      text: `What amenities does ${brandName} offer?`,
      type: 'branded'
    },
    {
      text: `Is ${brandName} pet-friendly for renters?`,
      type: 'faq'
    },
    {
      text: `Are there floor plans with in-unit laundry at ${brandName}?`,
      type: 'faq'
    },
    {
      text: `Top luxury apartments in ${locationLabel}`,
      type: 'category',
      geo: primaryGeo ?? null
    },
    {
      text: `Two-bedroom apartments in ${locationLabel} with parking`,
      type: 'category',
      geo: primaryGeo ?? null
    },
    {
      text: `${brandName} vs ${comparisonTarget}`,
      type: 'comparison',
      geo: primaryGeo ?? null
    },
    {
      text: `Apartments near ${shortLocation} with resort-style pool`,
      type: 'local',
      geo: primaryGeo ?? null
    },
    {
      text: `Resident reviews of ${brandName}`,
      type: 'branded'
    },
    {
      text: `Move-in specials at ${brandName}`,
      type: 'branded'
    }
  ];

  return queries;
}

export async function createClient(input: {
  name: string;
  domains: string[];
  competitors: string[];
  primaryGeo?: string | null;
}): Promise<ClientRecord> {
  const defaultQueries = generateDefaultQueries({
    brandName: input.name,
    primaryGeo: input.primaryGeo ?? null,
    competitors: input.competitors
  });

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        name: input.name,
        domains: input.domains,
        competitors: input.competitors,
        primaryGeo: input.primaryGeo ?? null
      }
    });

    if (defaultQueries.length > 0) {
      await tx.query.createMany({
        data: defaultQueries.map((query) => ({
          clientId: created.id,
          text: query.text,
          type: query.type,
          geo: query.geo ?? null,
          weight: query.weight ?? 1
        }) satisfies Prisma.QueryCreateManyInput)
      });
    }

    return created;
  });

  return mapClientRecord(client);
}

export async function getClientWithQueries(clientId: string): Promise<ClientWithQueries | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      queries: {
        orderBy: { createdAt: 'asc' },
        include: {
          annotations: {
            include: {
              evidence: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      kpis: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!client) {
    return null;
  }

  return {
    ...mapClientRecord(client),
    queries: client.queries.map(mapQueryRecord),
    kpis: client.kpis.map(mapKpiRecord)
  } satisfies ClientWithQueries;
}

export async function createClientQuery(input: {
  clientId: string;
  text: string;
  type: QueryType;
  geo?: string | null;
  weight?: number | null;
}): Promise<ClientQueryRecord> {
  const query = await prisma.query.create({
    data: {
      clientId: input.clientId,
      text: input.text,
      type: input.type,
      geo: input.geo ?? null,
      weight: input.weight ?? 1
    }
  });

  return mapQueryRecord(query);
}

export async function deleteClientQuery(queryId: string): Promise<void> {
  await prisma.query.delete({ where: { id: queryId } });
}

export async function getLatestRunSummaries(clientId: string): Promise<RunSummary[]> {
  if (!clientId) {
    return [];
  }

  const surfaces: Surface[] = ['openai', 'claude'];

  const runs = await Promise.all(
    surfaces.map((surface) =>
      prisma.run.findFirst({
        where: { clientId, surface },
        orderBy: { startedAt: 'desc' },
        include: {
          scores: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    )
  );

  return runs
    .filter((run): run is NonNullable<typeof run> => Boolean(run))
    .map((run) => {
      const score = run.scores[0];
      return {
        runId: run.id,
        clientId: run.clientId,
        surface: run.surface as Surface,
        modelName: run.modelName,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        overallScore: Number(score?.overallScore ?? 0),
        visibilityPct: Number(score?.visibilityPct ?? 0)
      } satisfies RunSummary;
    });
}

function buildQueryRows(raw: any[]): QueryRow[] {
  return raw.map((item) => {
    const rawJson = item.rawJson as any;
    const hasError = rawJson?.error !== undefined;
    const errorInfo = hasError && typeof rawJson.error === 'object' 
      ? {
          message: rawJson.error.message || 'API error occurred',
          summary: rawJson.error.summary || rawJson.error.apiError
        }
      : undefined;

    return {
      queryId: item.queryId,
      text: item.query.text,
      type: item.query.type,
      presence: item.presence,
      llmRank: item.llmRank,
      linkRank: item.linkRank,
      sov: item.sov,
      flags: item.flags ?? [],
      score: rawJson?.score?.score ?? 0,
      breakdown: rawJson?.score?.breakdown ?? {
        position: 0,
        link: 0,
        sov: 0,
        accuracy: 0
      },
      error: errorInfo
    };
  });
}

function attachDeltas(current: QueryRow[], previous: QueryRow[]): QueryRow[] {
  const previousMap = new Map(previous.map((row) => [row.queryId, row]));

  return current.map((row) => {
    const prev = previousMap.get(row.queryId);
    if (!prev) {
      return {
        ...row,
        deltas: {
          presenceDelta: row.presence ? 1 : 0,
          llmRankDelta: row.llmRank !== null ? -row.llmRank : null,
          linkRankDelta: row.linkRank !== null ? -row.linkRank : null,
          sovDelta: row.sov,
          scoreDelta: row.score
        }
      };
    }

    return {
      ...row,
      deltas: {
        presenceDelta: Number(row.presence) - Number(prev.presence),
        llmRankDelta:
          row.llmRank !== null && prev.llmRank !== null
            ? prev.llmRank - row.llmRank
            : row.llmRank !== null && prev.llmRank === null
            ? row.llmRank
            : null,
        linkRankDelta:
          row.linkRank !== null && prev.linkRank !== null
            ? prev.linkRank - row.linkRank
            : row.linkRank !== null && prev.linkRank === null
            ? row.linkRank
            : null,
        sovDelta:
          row.sov !== null && prev.sov !== null
            ? row.sov - prev.sov
            : row.sov !== null && prev.sov === null
            ? row.sov
            : null,
        scoreDelta:
          row.score !== null && prev.score !== null
            ? row.score - prev.score
            : row.score
      }
    };
  });
}

function toRunSummary(run: any): RunSummary {
  return {
    runId: run.id,
    clientId: run.clientId,
    surface: run.surface as Surface,
    modelName: run.modelName,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    overallScore: Number(run.scores?.[0]?.overallScore ?? 0),
    visibilityPct: Number(run.scores?.[0]?.visibilityPct ?? 0)
  };
}

export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      answers: {
        include: {
          query: true
        },
        orderBy: {
          query: {
            text: 'asc'
          }
        }
      }
    }
  });

  if (!run) {
    return null;
  }

  const queries = buildQueryRows(run.answers);

  return {
    run: toRunSummary(run),
    queries
  };
}

export async function getRunDetailWithDiffById(runId: string): Promise<RunDetail | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      answers: {
        include: { query: true },
        orderBy: {
          query: {
            text: 'asc'
          }
        }
      }
    }
  });

  if (!run) {
    return null;
  }

  const previous = await prisma.run.findFirst({
    where: {
      clientId: run.clientId,
      surface: run.surface,
      startedAt: {
        lt: run.startedAt
      }
    },
    orderBy: { startedAt: 'desc' },
    include: {
      answers: {
        include: { query: true }
      }
    }
  });

  const currentRows = buildQueryRows(run.answers);
  const previousRows = previous ? buildQueryRows(previous.answers) : [];
  const queries = attachDeltas(currentRows, previousRows);

  return {
    run: toRunSummary(run),
    queries
  };
}

export async function getLatestRunDetailWithDiff(surface: Surface, clientId: string): Promise<RunDetail | null> {
  if (!clientId) {
    return null;
  }

  const runs = await prisma.run.findMany({
    where: { clientId, surface },
    orderBy: { startedAt: 'desc' },
    take: 2,
    include: {
      answers: {
        include: { query: true },
        orderBy: {
          query: {
            text: 'asc'
          }
        }
      },
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (runs.length === 0) {
    return null;
  }

  const current = runs[0]!;
  const previous = runs[1];

  const currentRows = buildQueryRows(current.answers);
  const previousRows = previous ? buildQueryRows(previous.answers) : [];
  const queries = attachDeltas(currentRows, previousRows);

  return {
    run: toRunSummary(current),
    queries
  };
}

export async function getRunHistory(clientId: string): Promise<RunSummary[]> {
  if (!clientId) {
    return [];
  }

  const runs = await prisma.run.findMany({
    where: { clientId },
    orderBy: { startedAt: 'desc' },
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  return runs.map((run) => toRunSummary(run));
}

export async function getActiveRuns(clientId: string): Promise<RunSummary[]> {
  if (!clientId) {
    return [];
  }

  const runs = await prisma.run.findMany({
    where: {
      clientId,
      finishedAt: null
    },
    orderBy: { startedAt: 'desc' },
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  return runs.map((run) => toRunSummary(run));
}

export function getConfigInfo() {
  const config = getConfig();
  return {
    openaiModel: config.OPENAI_MODEL,
    anthropicModel: config.ANTHROPIC_MODEL
  };
}

function toSurfaceEnum(surface: Surface | null | undefined): SurfaceEnum | null {
  if (!surface) {
    return null;
  }
  return surface as SurfaceEnum;
}

export async function updateClientProfile(input: {
  clientId: string;
  narrativeNotes?: string | null;
  reportingCadence?: string | null;
  visibilityTarget?: number | null;
  baselineRunId?: string | null;
}): Promise<ClientRecord> {
  const { clientId, narrativeNotes, reportingCadence, visibilityTarget, baselineRunId } = input;

  const data: Prisma.ClientUpdateInput = {};
  if (narrativeNotes !== undefined) {
    data.narrativeNotes = narrativeNotes;
  }
  if (reportingCadence !== undefined) {
    data.reportingCadence = reportingCadence;
  }
  if (visibilityTarget !== undefined) {
    data.visibilityTarget = visibilityTarget;
  }
  if (baselineRunId !== undefined) {
    data.baselineRun = baselineRunId
      ? {
          connect: { id: baselineRunId }
        }
      : { disconnect: true };
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data,
    include: {
      baselineRun: true
    }
  });

  return mapClientRecord(client);
}

export async function upsertClientKpi(input: {
  id?: string;
  clientId: string;
  label: string;
  description?: string | null;
  unit: ClientKpiUnit;
  targetValue?: number | null;
  currentValue?: number | null;
  visibilityLink?: number | null;
}): Promise<ClientKpiRecord> {
  const createData: Prisma.ClientKpiCreateInput = {
    client: {
      connect: { id: input.clientId }
    },
    label: input.label,
    description: input.description ?? null,
    unit: input.unit as KpiUnitEnum,
    targetValue: input.targetValue ?? null,
    currentValue: input.currentValue ?? null,
    visibilityLink: input.visibilityLink ?? null
  };

  if (input.id) {
    const updated = await prisma.clientKpi.update({
      where: { id: input.id },
      data: {
        label: input.label,
        description: input.description ?? null,
        unit: input.unit as KpiUnitEnum,
        targetValue: input.targetValue ?? null,
        currentValue: input.currentValue ?? null,
        visibilityLink: input.visibilityLink ?? null
      }
    });
    return mapKpiRecord(updated);
  }

  const created = await prisma.clientKpi.create({
    data: createData
  });
  return mapKpiRecord(created);
}

export async function deleteClientKpi(kpiId: string): Promise<void> {
  await prisma.clientKpi.delete({ where: { id: kpiId } });
}

export async function listClientKpis(clientId: string): Promise<ClientKpiRecord[]> {
  const kpis = await prisma.clientKpi.findMany({
    where: { clientId },
    orderBy: { createdAt: 'asc' }
  });

  return kpis.map(mapKpiRecord);
}

export async function listClientAnnotations(clientId: string): Promise<QueryAnnotationRecord[]> {
  const annotations = await prisma.queryAnnotation.findMany({
    where: { clientId },
    include: {
      evidence: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return annotations.map(mapAnnotationRecord);
}

export async function createQueryAnnotation(input: {
  clientId: string;
  queryId: string;
  runId?: string | null;
  surface?: Surface | null;
  tags: QueryAnnotationTag[];
  note?: string | null;
  evidence?: Array<{
    label: string;
    excerpt?: string | null;
    url?: string | null;
  }>;
}): Promise<QueryAnnotationRecord> {
  const annotation = await prisma.queryAnnotation.create({
    data: {
      client: { connect: { id: input.clientId } },
      query: { connect: { id: input.queryId } },
      run: input.runId ? { connect: { id: input.runId } } : undefined,
      surface: toSurfaceEnum(input.surface) ?? undefined,
      tags: input.tags as unknown as QueryAnnotationTagEnum[],
      note: input.note ?? null,
      evidence:
        input.evidence && input.evidence.length > 0
          ? {
              create: input.evidence.map((item) => ({
                label: item.label,
                excerpt: item.excerpt ?? null,
                url: item.url ?? null
              }))
            }
          : undefined
    },
    include: {
      evidence: true
    }
  });

  return mapAnnotationRecord(annotation);
}

export async function updateQueryAnnotation(input: {
  annotationId: string;
  tags?: QueryAnnotationTag[];
  note?: string | null;
  runId?: string | null;
  surface?: Surface | null;
}): Promise<QueryAnnotationRecord> {
  const data: Prisma.QueryAnnotationUpdateInput = {};
  if (input.tags !== undefined) {
    data.tags = input.tags as unknown as QueryAnnotationTagEnum[];
  }
  if (input.note !== undefined) {
    data.note = input.note;
  }
  if (input.runId !== undefined) {
    data.run = input.runId
      ? {
          connect: { id: input.runId }
        }
      : { disconnect: true };
  }
  if (input.surface !== undefined) {
    const surfaceEnum = toSurfaceEnum(input.surface);
    data.surface = surfaceEnum ?? null;
  }

  const annotation = await prisma.queryAnnotation.update({
    where: { id: input.annotationId },
    data,
    include: {
      evidence: true
    }
  });

  return mapAnnotationRecord(annotation);
}

export async function deleteQueryAnnotation(annotationId: string): Promise<void> {
  await prisma.queryAnnotation.delete({ where: { id: annotationId } });
}

export async function addAnnotationEvidence(input: {
  annotationId: string;
  label: string;
  excerpt?: string | null;
  url?: string | null;
}): Promise<QueryAnnotationRecord> {
  await prisma.queryEvidence.create({
    data: {
      annotation: {
        connect: { id: input.annotationId }
      },
      label: input.label,
      excerpt: input.excerpt ?? null,
      url: input.url ?? null
    }
  });

  return await getAnnotationById(input.annotationId);
}

export async function deleteAnnotationEvidence(evidenceId: string): Promise<QueryAnnotationRecord | null> {
  const evidence = await prisma.queryEvidence.delete({
    where: { id: evidenceId },
    include: {
      annotation: true
    }
  });

  if (!evidence.annotationId) {
    return null;
  }

  return await getAnnotationById(evidence.annotationId);
}

async function getAnnotationById(annotationId: string): Promise<QueryAnnotationRecord> {
  const annotation = await prisma.queryAnnotation.findUniqueOrThrow({
    where: { id: annotationId },
    include: {
      evidence: true
    }
  });

  return mapAnnotationRecord(annotation);
}
