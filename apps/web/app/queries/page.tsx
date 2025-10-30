import Link from 'next/link';

import type { Surface } from '@geo/core';
import { getLatestRunDetailWithDiff } from '@geo/db';

const SURFACES: Surface[] = ['openai', 'claude'];

function formatDelta(value: number | null | undefined, { percent = false } = {}) {
  if (value === null || value === undefined) return '—';
  const precision = percent ? 1 : Number.isInteger(value) ? 0 : 1;
  const formatted = value.toFixed(precision);
  if (value > 0) return `+${formatted}`;
  if (percent) return formatted;
  return formatted;
}

function formatSurface(surface: Surface) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export default async function QueriesPage({
  searchParams
}: {
  searchParams?: { surface?: Surface; clientId?: string };
}) {
  const surface = (searchParams?.surface as Surface) ?? 'openai';
  const clientId = searchParams?.clientId;
  const runDetail = await getLatestRunDetailWithDiff(surface, clientId);

  const queryCount = runDetail?.queries.length ?? 0;
  const presenceRate = runDetail && queryCount
    ? Math.round((runDetail.queries.filter((query) => query.presence).length / queryCount) * 100)
    : 0;
  const flaggedQueries = runDetail ? runDetail.queries.filter((query) => query.flags.length > 0) : [];
  const movers = runDetail
    ? runDetail.queries
        .filter((query) => typeof query.deltas?.scoreDelta === 'number')
        .sort((a, b) => (b.deltas?.scoreDelta ?? 0) - (a.deltas?.scoreDelta ?? 0))
        .slice(0, 3)
    : [];

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">{formatSurface(surface)} surface</div>
          <h1 className="page-title">Query performance workspace</h1>
          <p className="page-subtitle">
            Audit presence, ranking, and share-of-voice shifts to prep talking points before delivering your client report.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <nav className="flex flex-wrap gap-2">
            {SURFACES.map((item) => {
              const isActive = item === surface;
              return (
                <Link
                  key={item}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-card'
                      : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
                  }`}
                  href={{ pathname: '/queries', query: { surface: item, clientId } } as any}
                >
                  {formatSurface(item)}
                </Link>
              );
            })}
          </nav>

          {runDetail && (
            <div className="text-sm text-slate-500">
              Latest run · Score {runDetail.run.overallScore.toFixed(1)} • Visibility {runDetail.run.visibilityPct.toFixed(1)}%
            </div>
          )}
        </div>
      </header>

      {!runDetail && (
        <div className="empty-state">
          <strong className="text-sm text-slate-600">No runs for {formatSurface(surface)} yet</strong>
          <span>Launch a crawl from the client workspace to populate the query table and unlock comparison deltas.</span>
        </div>
      )}

      {runDetail && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric">
              <span className="metric-label">Overall score</span>
              <span className="metric-value">{runDetail.run.overallScore.toFixed(1)}</span>
              <p className="text-sm text-slate-500">Blended query performance for the latest {formatSurface(surface)} run.</p>
            </div>
            <div className="metric">
              <span className="metric-label">Share of voice</span>
              <span className="metric-value">{runDetail.run.visibilityPct.toFixed(1)}%</span>
              <p className="text-sm text-slate-500">Percentage of answers where the brand secured meaningful inclusion.</p>
            </div>
            <div className="metric">
              <span className="metric-label">Presence coverage</span>
              <span className="metric-value">{queryCount ? `${presenceRate}%` : '—'}</span>
              <p className="text-sm text-slate-500">Queries with brand mentions vs total tracked in this workspace.</p>
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
                    <th className="text-right">Δ Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {runDetail.queries.map((query) => (
                    <tr key={query.queryId}>
                      <td>
                        <div className="font-medium text-slate-900">{query.text}</div>
                        {query.flags.length > 0 && (
                          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
                            {query.flags.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="text-slate-500">{query.type}</td>
                      <td className="text-right">
                        <span className={query.presence ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                          {query.presence ? 'Yes' : 'No'}
                        </span>
                        {query.deltas && (
                          <div className="text-xs text-slate-500">{formatDelta(query.deltas.presenceDelta)}</div>
                        )}
                      </td>
                      <td className="text-right">
                        {query.llmRank ?? '—'}
                        {query.deltas?.llmRankDelta !== null && query.deltas?.llmRankDelta !== undefined && (
                          <div className="text-xs text-slate-500">{formatDelta(query.deltas.llmRankDelta)}</div>
                        )}
                      </td>
                      <td className="text-right">
                        {query.linkRank ?? '—'}
                        {query.deltas?.linkRankDelta !== null && query.deltas?.linkRankDelta !== undefined && (
                          <div className="text-xs text-slate-500">{formatDelta(query.deltas.linkRankDelta)}</div>
                        )}
                      </td>
                      <td className="text-right">
                        {query.sov !== null ? `${(query.sov * 100).toFixed(1)}%` : '—'}
                        {query.deltas?.sovDelta !== null && query.deltas?.sovDelta !== undefined && (
                          <div className="text-xs text-slate-500">{formatDelta((query.deltas.sovDelta ?? 0) * 100, { percent: true })}%</div>
                        )}
                      </td>
                      <td className="text-right">
                        {query.score.toFixed(1)}
                        <div className="text-xs text-slate-500">
                          Pos {query.breakdown.position.toFixed(0)} · Link {query.breakdown.link.toFixed(0)} · SOV {query.breakdown.sov.toFixed(0)} · Acc {query.breakdown.accuracy.toFixed(0)}
                        </div>
                      </td>
                      <td className="text-right font-semibold text-slate-900">
                        {formatDelta(query.deltas?.scoreDelta ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-6">
              <div className="card">
                <h2 className="text-base font-semibold text-slate-900">Opportunity highlights</h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {movers.length === 0 && <li>No score movement detected vs the previous run.</li>}
                  {movers.map((query) => {
                    const delta = query.deltas?.scoreDelta ?? 0;
                    const direction = delta > 0 ? 'improved by' : delta < 0 ? 'declined by' : 'held steady at';
                    const detail = delta !== 0 ? `${formatDelta(delta)} pts` : `${query.score.toFixed(1)} pts`;
                    return (
                      <li key={query.queryId}>
                        <span className="font-semibold text-slate-900">{query.text}</span> {direction} {detail}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-slate-900">Flags to resolve</h2>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {flaggedQueries.length === 0 && <li>All queries are clear—no flags from the latest crawl.</li>}
                  {flaggedQueries.map((query) => (
                    <li key={query.queryId}>
                      <span className="font-semibold text-slate-900">{query.text}:</span> {query.flags.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
