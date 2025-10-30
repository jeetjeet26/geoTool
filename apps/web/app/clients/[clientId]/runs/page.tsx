import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import { getClientById, getRunHistory } from '@geo/db';

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

export default async function ClientRunsPage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const runs = await getRunHistory(client.id);
  const lastRun = runs[0];
  const lastRunTimestamp = lastRun ? lastRun.finishedAt ?? lastRun.startedAt : null;
  const averageScore = runs.length
    ? runs.reduce((total, run) => total + run.overallScore, 0) / runs.length
    : 0;
  const averageVisibility = runs.length
    ? runs.reduce((total, run) => total + run.visibilityPct, 0) / runs.length
    : 0;

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
          <Link
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
            href={`/clients/${client.id}/queries`}
          >
            Jump to queries workspace
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Total runs</span>
          <span className="metric-value">{runs.length}</span>
          <p className="text-sm text-slate-500">All recorded campaigns across surfaces in this workspace.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Avg. score</span>
          <span className="metric-value">{runs.length ? averageScore.toFixed(1) : '—'}</span>
          <p className="text-sm text-slate-500">Use to gauge sentiment over time when building client narratives.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Avg. visibility</span>
          <span className="metric-value">{runs.length ? `${averageVisibility.toFixed(1)}%` : '—'}</span>
          <p className="text-sm text-slate-500">Helps benchmark LLM share of voice alongside paid & organic channels.</p>
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
              {runs.map((run, index) => {
                const previousRun = index < runs.length - 1 ? runs[index + 1] : null;
                const scoreDelta = previousRun ? run.overallScore - previousRun.overallScore : null;
                const visibilityDelta = previousRun ? run.visibilityPct - previousRun.visibilityPct : null;

                return (
                  <tr key={run.runId}>
                    <td className="font-semibold text-slate-900">{formatSurface(run.surface)}</td>
                    <td className="text-slate-600">{run.modelName}</td>
                    <td className="text-slate-600">{formatDate(run.startedAt)}</td>
                    <td className="text-slate-600">{formatDate(run.finishedAt)}</td>
                    <td className="text-right">
                      <span className="font-semibold text-slate-900">{run.overallScore.toFixed(1)}</span>
                      {scoreDelta !== null && (
                        <div className={`text-xs ${scoreDelta > 0 ? 'text-green-600' : scoreDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-semibold text-slate-900">{run.visibilityPct.toFixed(1)}%</span>
                      {visibilityDelta !== null && (
                        <div className={`text-xs ${visibilityDelta > 0 ? 'text-green-600' : visibilityDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {visibilityDelta > 0 ? '+' : ''}{visibilityDelta.toFixed(1)}%
                        </div>
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
              {runs.length === 0 && (
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


