import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import type { Surface } from '@geo/core';
import { getClientById, getRunHistory } from '@geo/db';
import TrendChart from '../../../../components/trend-chart';
import ActionBar from '../../../../components/action-bar';
import EmptyState from '../../../../components/empty-state';

function formatDate(value: Date | null | undefined) {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

const SURFACE_FILTERS: Array<{ value: 'all' | Surface; label: string }> = [
  { value: 'all', label: 'All surfaces' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' }
];

export default async function ClientRunsPage({
  params,
  searchParams
}: {
  params: { clientId: string };
  searchParams?: { surface?: string };
}) {
  const client = await getClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const runs = await getRunHistory(client.id);
  const baselineRun = client.baselineRunId
    ? runs.find((run) => run.runId === client.baselineRunId) ?? null
    : null;
  const surfaceParam = (searchParams?.surface ?? 'all').toLowerCase();
  const surfaceFilter = SURFACE_FILTERS.some((option) => option.value === surfaceParam)
    ? (surfaceParam as 'all' | Surface)
    : 'all';

  const runsFiltered = surfaceFilter === 'all' ? runs : runs.filter((run) => run.surface === surfaceFilter);

  const lastRun = runsFiltered[0] ?? runs[0];
  const lastRunTimestamp = lastRun ? lastRun.finishedAt ?? lastRun.startedAt : null;
  const averageScore = runsFiltered.length
    ? runsFiltered.reduce((total, run) => total + run.overallScore, 0) / runsFiltered.length
    : 0;
  const averageVisibility = runsFiltered.length
    ? runsFiltered.reduce((total, run) => total + run.visibilityPct, 0) / runsFiltered.length
    : 0;

  const trendPoints = runsFiltered
    .slice()
    .reverse()
    .map((run) => ({
      date: (run.finishedAt ?? run.startedAt).toISOString(),
      score: Number(run.overallScore.toFixed(2)),
      visibility: Number(run.visibilityPct.toFixed(2))
    }));

  const cadenceGaps = runsFiltered.slice(0, Math.min(runsFiltered.length, 12)).map((run, index) => {
    const next = runsFiltered[index + 1];
    if (!next) return null;
    const currentDate = run.finishedAt ?? run.startedAt;
    const nextDate = next.finishedAt ?? next.startedAt;
    const gapMs = currentDate.getTime() - nextDate.getTime();
    const gapDays = Math.max(Math.round(gapMs / (1000 * 60 * 60 * 24)), 0);
    return {
      gapDays,
      from: nextDate,
      to: currentDate,
      surface: run.surface
    };
  }).filter(Boolean) as Array<{ gapDays: number; from: Date; to: Date; surface: Surface }>;

  const longestGap = cadenceGaps.reduce<{ gapDays: number; from: Date; to: Date; surface: Surface } | null>((acc, item) => {
    if (!acc || item.gapDays > acc.gapDays) {
      return item;
    }
    return acc;
  }, null);

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">Historical record</div>
          <h1 className="page-title">{client.name} run history & trendline</h1>
          <p className="page-subtitle">
            Review every crawl across LLM surfaces, surface repeat issues, and build trend-friendly storylines for your client reports.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <span className="rounded-full bg-white/80 px-4 py-1 text-sm text-slate-600">
            {lastRunTimestamp
              ? `Most recent completion ${formatDistanceToNow(lastRunTimestamp, { addSuffix: true })}`
              : 'No runs recorded yet'}
          </span>
          <nav className="flex flex-wrap gap-2">
            {SURFACE_FILTERS.map((option) => {
              const isActive = surfaceFilter === option.value;
              const href =
                option.value === 'all'
                  ? { pathname: `/clients/${client.id}/runs` }
                  : { pathname: `/clients/${client.id}/runs`, query: { surface: option.value } };

              return (
                <Link
                  key={option.value}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-card'
                      : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
                  }`}
                  href={href}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <ActionBar clientId={client.id} page="runs" latestRunId={runsFiltered[0]?.runId} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Total runs</span>
          <span className="metric-value">{runsFiltered.length}</span>
          <p className="text-sm text-slate-500">
            {surfaceFilter === 'all'
              ? 'All recorded campaigns across surfaces in this workspace.'
              : `Completed ${formatSurface(surfaceFilter)} crawls in focus.`}
          </p>
        </div>
        <div className="metric">
          <span className="metric-label">Avg. score</span>
          <span className="metric-value">{runsFiltered.length ? averageScore.toFixed(1) : '—'}</span>
          <p className="text-sm text-slate-500">Use to gauge sentiment over time when building client narratives.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Avg. visibility</span>
          <span className="metric-value">{runsFiltered.length ? `${averageVisibility.toFixed(1)}%` : '—'}</span>
          <p className="text-sm text-slate-500">Helps benchmark LLM share of voice alongside paid & organic channels.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Trendline</h2>
              <p className="text-sm text-slate-500">
                Track score and visibility movement run-over-run for the selected surface view.
              </p>
            </div>
            {trendPoints.length >= 2 && (
              <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                {trendPoints.length} data points
              </span>
            )}
          </div>
          <div className="mt-6 overflow-x-auto">
            <TrendChart points={trendPoints} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">Cadence insights</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <strong className="text-slate-900">Reporting rhythm:</strong> {client.reportingCadence ?? 'Set cadence in client overview'}
            </li>
            <li>
              <strong className="text-slate-900">Longest gap:</strong>{' '}
              {longestGap
                ? `${longestGap.gapDays} days between ${new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric'
                  }).format(longestGap.from)} and ${new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric'
                  }).format(longestGap.to)} (${formatSurface(longestGap.surface)})`
                : 'Need multiple runs to measure gaps.'}
            </li>
            <li>
              <strong className="text-slate-900">Baseline run:</strong>{' '}
              {baselineRun
                ? `${formatDate(baselineRun.finishedAt ?? baselineRun.startedAt)} · ${formatSurface(baselineRun.surface)} (${baselineRun.overallScore.toFixed(1)} / ${baselineRun.visibilityPct.toFixed(1)}%)`
                : 'Set a baseline in the insights tab to compare future crawls.'}
            </li>
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Surface</th>
                <th>Model</th>
                <th>Started</th>
                <th>Finished</th>
                <th className="text-right">Score</th>
                <th className="text-right">Visibility</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runsFiltered.map((run, index) => {
                const previousRun = index < runsFiltered.length - 1 ? runsFiltered[index + 1] : null;
                const scoreDelta = previousRun ? run.overallScore - previousRun.overallScore : null;
                const visibilityDelta = previousRun ? run.visibilityPct - previousRun.visibilityPct : null;
                const isErrorRun = run.overallScore === 0 && run.visibilityPct === 0 && run.finishedAt !== null;

                return (
                  <tr key={run.runId} className={isErrorRun ? 'bg-rose-50/50' : ''}>
                    <td className="font-semibold text-slate-900">{formatSurface(run.surface)}</td>
                    <td className="text-slate-600">{run.modelName}</td>
                    <td className="text-slate-600">{formatDate(run.startedAt)}</td>
                    <td className="text-slate-600">{formatDate(run.finishedAt)}</td>
                    <td className="text-right">
                      {isErrorRun ? (
                        <div>
                          <span className="font-semibold text-rose-600">Error</span>
                          <div className="text-xs text-rose-500">API call failed</div>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-900">{run.overallScore.toFixed(1)}</span>
                          {scoreDelta !== null && (
                            <div className={`text-xs ${scoreDelta > 0 ? 'text-green-600' : scoreDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                              {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="text-right">
                      {isErrorRun ? (
                        <span className="font-semibold text-rose-600">—</span>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-900">{run.visibilityPct.toFixed(1)}%</span>
                          {visibilityDelta !== null && (
                            <div className={`text-xs ${visibilityDelta > 0 ? 'text-green-600' : visibilityDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                              {visibilityDelta > 0 ? '+' : ''}{visibilityDelta.toFixed(1)}%
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="text-right">
                      <Link className="inline-link" href={`/clients/${client.id}/runs/${run.runId}`}>
                        View details
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {runsFiltered.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                    No runs recorded yet. Use the client workspace to launch your first crawl.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">How to turn logs into stories</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <strong className="text-slate-900">Spot cadence gaps:</strong> ensure runs align with reporting frequency so data matches expectations.
            </li>
            <li>
              <strong className="text-slate-900">Trend the score column:</strong> highlight directional improvement or risk in your client recap slides.
            </li>
            <li>
              <strong className="text-slate-900">Jump into details:</strong> each row links directly to query-level evidence ready for screenshots or callouts.
            </li>
          </ul>
        </div>
      </section>
    </section>
  );
}


