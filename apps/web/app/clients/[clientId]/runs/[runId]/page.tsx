import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import { getRunDetail } from '@geo/db';

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export default async function ClientRunDetailPage({
  params
}: {
  params: { clientId: string; runId: string };
}) {
  const runDetail = await getRunDetail(params.runId);

  if (!runDetail || runDetail.run.clientId !== params.clientId) {
    notFound();
  }

  const flaggedQueries = runDetail.queries.filter((query) => query.flags.length > 0);
  const presenceRate = runDetail.queries.length
    ? Math.round((runDetail.queries.filter((query) => query.presence).length / runDetail.queries.length) * 100)
    : 0;
  const completionTimestamp = runDetail.run.finishedAt ?? runDetail.run.startedAt;

  return (
    <section className="flex flex-1 flex-col gap-10">
      <div className="flex items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-neutral-300 hover:text-slate-900"
          href={`/clients/${params.clientId}/runs`}
        >
          ← Back to run history
        </Link>
      </div>

      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">{formatSurface(runDetail.run.surface)} · {runDetail.run.modelName}</div>
          <h1 className="page-title">Run detail overview</h1>
          <p className="page-subtitle">
            Use this evidence to annotate your report, capture proof points, and reassure clients about coverage across priority queries.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 text-sm text-slate-500 md:items-end">
          <span>
            {completionTimestamp
              ? `Completed ${formatDistanceToNow(completionTimestamp, { addSuffix: true })}`
              : 'Run still in progress'}
          </span>
          <span>Score {runDetail.run.overallScore.toFixed(1)} • Visibility {runDetail.run.visibilityPct.toFixed(1)}%</span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Total queries</span>
          <span className="metric-value">{runDetail.queries.length}</span>
          <p className="text-sm text-slate-500">Tracked prompts included in this run for {formatSurface(runDetail.run.surface)}.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Presence coverage</span>
          <span className="metric-value">{presenceRate}%</span>
          <p className="text-sm text-slate-500">Share of monitored queries where the brand appears in the generated answer.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Flagged issues</span>
          <span className="metric-value">{flaggedQueries.length}</span>
          <p className="text-sm text-slate-500">Address these before sending your follow-up or stakeholder report.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Type</th>
                <th className="text-right">Presence</th>
                <th className="text-right">LLM Rank</th>
                <th className="text-right">Link Rank</th>
                <th className="text-right">SOV</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runDetail.queries.map((query) => (
                <tr key={query.queryId}>
                  <td>
                    <div className="font-semibold text-slate-900">{query.text}</div>
                    {query.flags.length > 0 && (
                      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
                        {query.flags.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="text-slate-600">{query.type}</td>
                  <td className={`text-right font-medium ${query.presence ? 'text-slate-900' : 'text-slate-500'}`}>
                    {query.presence ? 'Yes' : 'No'}
                  </td>
                  <td className="text-right">{query.llmRank ?? '—'}</td>
                  <td className="text-right">{query.linkRank ?? '—'}</td>
                  <td className="text-right">{query.sov !== null ? `${(query.sov * 100).toFixed(1)}%` : '—'}</td>
                  <td className="text-right font-semibold text-slate-900">{query.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">Suggested follow-up notes</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <strong className="text-slate-900">Summarize the win:</strong> call out high-scoring queries to reinforce strategic coverage.
            </li>
            <li>
              <strong className="text-slate-900">Document risks:</strong> flagged items should become action items for optimization or alignment.
            </li>
            <li>
              <strong className="text-slate-900">Capture proof:</strong> screenshot or export top answers with citations for your deliverable.
            </li>
          </ul>
        </div>
      </section>
    </section>
  );
}


