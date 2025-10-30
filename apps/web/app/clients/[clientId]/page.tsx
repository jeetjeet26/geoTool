import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatDistanceToNow } from 'date-fns';

import type { Surface } from '@geo/core';
import { getClientById, getLatestRunSummaries, runClientOnce, getConfigInfo, getLatestRunDetailWithDiff } from '@geo/db';
import RunStatusIndicator from '../../../components/run-status-indicator';

const SUPPORTED_SURFACES: Surface[] = ['openai', 'claude'];

async function triggerRunAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();

  if (!clientId) {
    throw new Error('Missing client ID');
  }

  // Start the run asynchronously - don't await, let it run in background
  runClientOnce({
    clientId,
    surfaces: SUPPORTED_SURFACES
  }).catch((error) => {
    console.error('[server action] Run failed:', error);
  });

  // Revalidate immediately and then periodically
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/runs`);
  revalidatePath(`/clients/${clientId}/queries`);
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

  return (
    <section className="flex flex-1 flex-col gap-10">
      <RunStatusIndicator clientId={client.id} />
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

        <div className="flex flex-col items-start gap-4 md:items-end">
          <span className="rounded-full bg-white/80 px-4 py-1 text-sm text-slate-600">
            {lastTouchpoint
              ? `Last synced ${formatDistanceToNow(lastTouchpoint, { addSuffix: true })}`
              : 'No runs recorded yet'}
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form action={triggerRunAction} className="inline-flex">
              <input type="hidden" name="clientId" value={client.id} />
              <button
                className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                type="submit"
              >
                Run crawl
              </button>
            </form>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-neutral-300 hover:text-slate-900"
              href={`/clients/${client.id}/queries`}
            >
              Deep-dive queries
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
              href={`/clients/${client.id}/runs`}
            >
              Review run history
            </Link>
          </div>
        </div>
      </header>

      {/* Executive Summary - Wins/Losses/Risks */}
      {(wins.length > 0 || losses.length > 0 || risks.length > 0) && (
        <section className="rounded-2xl border border-neutral-200 bg-white/95 p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">What changed since last run</h2>
          <div className="flex flex-wrap gap-3">
            {wins.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-green-700">Top wins</span>
                <div className="flex flex-wrap gap-2">
                  {wins.map((query) => (
                    <Link
                      key={query.queryId}
                      href={`/clients/${client.id}/queries?surface=${openaiDetail?.run.surface === 'openai' ? 'openai' : 'claude'}`}
                      className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
                    >
                      {query.text.substring(0, 40)}... +{query.deltas?.scoreDelta?.toFixed(1)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {losses.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-red-700">Declines</span>
                <div className="flex flex-wrap gap-2">
                  {losses.map((query) => (
                    <Link
                      key={query.queryId}
                      href={`/clients/${client.id}/queries?surface=${openaiDetail?.run.surface === 'openai' ? 'openai' : 'claude'}`}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                      {query.text.substring(0, 40)}... {query.deltas?.scoreDelta?.toFixed(1)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {risks.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Flags to resolve</span>
                <div className="flex flex-wrap gap-2">
                  {risks.map((query) => (
                    <Link
                      key={query.queryId}
                      href={`/clients/${client.id}/queries?surface=${openaiDetail?.run.surface === 'openai' ? 'openai' : 'claude'}`}
                      className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      {query.text.substring(0, 40)}... {query.flags.join(', ')}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Avg. visibility score</span>
          <span className="metric-value">{runs.length ? averageScore.toFixed(1) : '—'}</span>
          <p className="text-sm text-slate-500">A blended score across recent OpenAI and Claude crawls.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Share of voice</span>
          <span className="metric-value">{runs.length ? `${averageVisibility.toFixed(1)}%` : '—'}</span>
          <p className="text-sm text-slate-500">Average visibility percentage based on the latest crawl.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Surfaces monitored</span>
          <span className="metric-value">{surfacesTracked}</span>
          <p className="text-sm text-slate-500">OpenAI, Claude, and any additional LLMs onboarded for the client.</p>
        </div>
      </section>

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
              <div className="empty-state">
                <strong className="text-sm text-slate-600">No runs yet</strong>
                <span>
                  Launch a crawl to start tracking LLM visibility for this client.
                </span>
              </div>
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
                <strong className="text-slate-900">1. Review top surfaces.</strong> Confirm visibility scores and ensure coverage trends match the client narrative.
              </li>
              <li>
                <strong className="text-slate-900">2. Audit flagged queries.</strong> Jump into the query workspace to annotate wins, risks, and missing citations.
              </li>
              <li>
                <strong className="text-slate-900">3. Package the story.</strong> Export highlights into your deck or recap email with evidence from the run detail pages.
              </li>
            </ul>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-slate-900">Reporting shortcuts</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                • Use <span className="font-medium text-slate-900">Run history</span> for trend charts and cadence planning.
              </p>
              <p>
                • Capture <span className="font-medium text-slate-900">query-level context</span> directly in the workspace before presenting.
              </p>
              <p>
                • Pair visibility % with <span className="font-medium text-slate-900">client KPIs</span> to translate LLM rankings into business outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

