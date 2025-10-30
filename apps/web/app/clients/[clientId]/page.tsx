import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import type { Surface } from '@geo/core';
import {
  deleteClientKpi,
  getClientById,
  getConfigInfo,
  getLatestRunDetailWithDiff,
  getLatestRunSummaries,
  getRunHistory,
  listClientAnnotations,
  listClientKpis,
  updateClientProfile,
  upsertClientKpi,
  type ClientKpiUnit
} from '@geo/db';
import TrendChart from '../../../components/trend-chart';
import EmptyState from '../../../components/empty-state';
import ActionBar from '../../../components/action-bar';

const SUPPORTED_SURFACES: Surface[] = ['openai', 'claude'];

async function updateClientProfileAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  if (!clientId) {
    throw new Error('Missing client ID');
  }

  const narrativeNotes = formData.get('narrativeNotes')?.toString() ?? null;
  const reportingCadence = formData.get('reportingCadence')?.toString() ?? null;
  const visibilityTargetRaw = formData.get('visibilityTarget')?.toString();
  const baselineRunId = formData.get('baselineRunId')?.toString();

  const visibilityTarget = visibilityTargetRaw && visibilityTargetRaw.length > 0 ? Number(visibilityTargetRaw) : null;

  await updateClientProfile({
    clientId,
    narrativeNotes,
    reportingCadence,
    visibilityTarget,
    baselineRunId: baselineRunId && baselineRunId.length > 0 ? baselineRunId : null
  });

  revalidatePath(`/clients/${clientId}`);
}

const KPI_UNITS: Array<{ value: ClientKpiUnit; label: string; suffix?: string }> = [
  { value: 'percent', label: 'Percent', suffix: '%' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Revenue', suffix: '$' },
  { value: 'ratio', label: 'Ratio' }
];

async function saveKpiAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  if (!clientId) {
    throw new Error('Missing client ID');
  }

  const id = formData.get('kpiId')?.toString();
  const label = formData.get('label')?.toString();
  const unit = formData.get('unit')?.toString() as ClientKpiUnit | undefined;
  const description = formData.get('description')?.toString() ?? null;
  const targetValueRaw = formData.get('targetValue')?.toString();
  const currentValueRaw = formData.get('currentValue')?.toString();
  const visibilityLinkRaw = formData.get('visibilityLink')?.toString();

  if (!label || !unit) {
    throw new Error('Label and unit are required');
  }

  const parseNumber = (value: string | undefined | null) => {
    if (!value || value.length === 0) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  await upsertClientKpi({
    id: id && id.length > 0 ? id : undefined,
    clientId,
    label,
    description,
    unit,
    targetValue: parseNumber(targetValueRaw),
    currentValue: parseNumber(currentValueRaw),
    visibilityLink: parseNumber(visibilityLinkRaw)
  });

  revalidatePath(`/clients/${clientId}`);
}

async function deleteKpiAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  const kpiId = formData.get('kpiId')?.toString();

  if (!clientId || !kpiId) {
    throw new Error('Missing identifiers');
  }

  await deleteClientKpi(kpiId);
  revalidatePath(`/clients/${clientId}`);
}

function formatTimestamp(value: Date | null | undefined) {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export default async function ClientInsightsPage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const runs = await getLatestRunSummaries(client.id);
  const runHistory = await getRunHistory(client.id);
  const clientKpis = await listClientKpis(client.id);
  const annotations = await listClientAnnotations(client.id);

  // Get latest run details for each surface to compute wins/losses
  const openaiDetail = await getLatestRunDetailWithDiff('openai', client.id);
  const claudeDetail = await getLatestRunDetailWithDiff('claude', client.id);

  // Compute wins/losses from deltas
  const wins = [
    ...(openaiDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) > 5) || []),
    ...(claudeDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) > 5) || [])
  ].slice(0, 3);

  const losses = [
    ...(openaiDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) < -5) || []),
    ...(claudeDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) < -5) || [])
  ].slice(0, 3);

  const risks = [
    ...(openaiDetail?.queries.filter((q) => q.flags.length > 0) || []),
    ...(claudeDetail?.queries.filter((q) => q.flags.length > 0) || [])
  ].slice(0, 3);

  const config = getConfigInfo();
  const isUsingDefaults = config.openaiModel === 'gpt-4o-mini' || config.anthropicModel === 'claude-3-haiku-20240307';

  const lastTouchpoint = runs.reduce<Date | null>((latest, run) => {
    const reference = run.finishedAt ?? run.startedAt;
    if (!reference) return latest;
    return !latest || reference > latest ? reference : latest;
  }, null);

  const averageScore = runs.length
    ? runs.reduce((total, run) => total + run.overallScore, 0) / runs.length
    : 0;
  const averageVisibility = runs.length
    ? runs.reduce((total, run) => total + run.visibilityPct, 0) / runs.length
    : 0;
  const surfacesTracked = new Set(runs.map((run) => run.surface)).size;

  const trendPoints = runHistory
    .slice()
    .reverse()
    .map((run) => ({
      date: (run.finishedAt ?? run.startedAt).toISOString(),
      score: Number(run.overallScore.toFixed(2)),
      visibility: Number(run.visibilityPct.toFixed(2))
    }));

  const latestFinishedRun = runHistory.find((run) => run.finishedAt);

  const flaggedAnnotations = annotations.filter((annotation) =>
    annotation.tags.some((tag) => ['risk', 'gap', 'missing_citation'].includes(tag))
  );
  const winAnnotations = annotations.filter((annotation) => annotation.tags.includes('win'));

  const surfacesSorted = [...runs].sort((a, b) => b.visibilityPct - a.visibilityPct);

  const baselineRun = client.baselineRunId
    ? runHistory.find((run) => run.runId === client.baselineRunId) ?? null
    : null;

  const additionalSurfaces = surfacesSorted
    .slice(1)
    .map((surface) => `${formatSurface(surface.surface)} (${surface.visibilityPct.toFixed(1)}%)`)
    .join(', ');

  const topSurfaceSummary = surfacesSorted.length > 0
    ? `Start with ${formatSurface(surfacesSorted[0]!.surface)} at ${surfacesSorted[0]!.visibilityPct.toFixed(1)}% visibility${
        additionalSurfaces ? `, then compare ${additionalSurfaces} to spot gaps.` : ' to spot gaps.'
      }`
    : 'Launch a crawl to populate surface performance.';

  const flaggedSummary =
    flaggedAnnotations.length > 0
      ? `There are ${flaggedAnnotations.length} open risks/gaps tagged in the query workspace.`
      : 'No flagged annotations—log wins or gaps from the latest crawl.';

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">Insights</div>
          <h2 className="page-title">Visibility command center</h2>
          <p className="page-subtitle">
            Track performance across surfaces, spot risks, and translate crawl data into client-ready narratives.
          </p>
          {isUsingDefaults && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <strong>Config note:</strong> Using default models ({config.openaiModel} / {config.anthropicModel}). Set OPENAI_MODEL and ANTHROPIC_MODEL in .env to customize.
            </div>
          )}
        </div>
      </header>

      <ActionBar clientId={client.id} page="insights" latestRunId={runs[0]?.runId} />

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Latest surface performance</h2>
              <p className="text-sm text-slate-500">
                Compare models, visibility, and completeness before delivering your update.
              </p>
            </div>
            <Link className="inline-link" href={`/clients/${client.id}/runs`}>
              View full history
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {runs.length === 0 && (
              <EmptyState
                title="No runs yet"
                message="Launch a crawl to start tracking LLM visibility for this client."
                icon="📊"
              />
            )}

            {runs.map((run) => (
              <div
                key={run.runId}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white/90 p-5 transition hover:border-neutral-300 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-3">
                  <div className="surface-chip">
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                    {formatSurface(run.surface)}
                    <span className="text-xs text-slate-400">{run.modelName}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-900">{run.overallScore.toFixed(1)}</span>
                    <span className="text-sm text-slate-500">visibility score</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Updated {formatTimestamp(run.finishedAt ?? run.startedAt)} • Share of voice {run.visibilityPct.toFixed(1)}%
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                    {run.finishedAt ? 'Completed' : 'In progress'}
                  </span>
                  <Link className="inline-link" href={`/clients/${client.id}/runs/${run.runId}`}>
                    View run detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900">Team workflow</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                <strong className="text-slate-900">1. Review top surfaces.</strong> {topSurfaceSummary}
              </li>
              <li>
                <strong className="text-slate-900">2. Audit flagged queries.</strong> {flaggedSummary}
              </li>
              <li>
                <strong className="text-slate-900">3. Package the story.</strong>{' '}
                {latestFinishedRun ? (
                  <>
                    Export a recap with evidence from the{' '}
                    <Link className="inline-link" href={`/clients/${client.id}/runs`}>
                      runs page
                    </Link>{' '}
                    before sending the client email.
                  </>
                ) : (
                  'Run history exports unlock after your first completed crawl.'
                )}
              </li>
            </ul>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-slate-900">Reporting shortcuts</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                • Compare <span className="font-medium text-slate-900">run cadence</span> against your reporting rhythm ({client.reportingCadence || 'set cadence above'}).
              </p>
              <p>
                • Attach <span className="font-medium text-slate-900">annotations</span> to highlight wins ({winAnnotations.length}) and active risks ({flaggedAnnotations.length}).
              </p>
              <p>
                • Pair <span className="font-medium text-slate-900">visibility %</span> with <span className="font-medium text-slate-900">KPIs</span> ({clientKpis.length}) to translate LLM rankings into business outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
