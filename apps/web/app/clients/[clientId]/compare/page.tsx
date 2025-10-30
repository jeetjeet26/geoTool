import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientById, getLatestRunDetailWithDiff } from '@geo/db';
import ActionBar from '@/components/action-bar';
import EmptyState from '@/components/empty-state';
import DumbbellChart from '@/components/dumbbell-chart';

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export default async function ComparePage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const openaiDetail = await getLatestRunDetailWithDiff('openai', client.id);
  const claudeDetail = await getLatestRunDetailWithDiff('claude', client.id);

  if (!openaiDetail || !claudeDetail) {
    return (
      <section className="flex flex-1 flex-col gap-10">
        <header className="page-header">
          <div className="space-y-3">
            <div className="badge">Compare</div>
            <h1 className="page-title">Surface comparison</h1>
            <p className="page-subtitle">
              Compare OpenAI and Claude performance side-by-side to spot discrepancies and prioritize actions.
            </p>
          </div>
        </header>

        <EmptyState
          title="Insufficient data"
          message="Run crawls for both surfaces to enable comparison."
          icon="📊"
        />
      </section>
    );
  }

  // Find queries that exist in both surfaces
  const openaiQueriesMap = new Map(openaiDetail.queries.map((q) => [q.queryId, q]));
  const claudeQueriesMap = new Map(claudeDetail.queries.map((q) => [q.queryId, q]));
  const allQueryIds = new Set([...openaiQueriesMap.keys(), ...claudeQueriesMap.keys()]);

  const comparisons = Array.from(allQueryIds).map((queryId) => {
    const openai = openaiQueriesMap.get(queryId);
    const claude = claudeQueriesMap.get(queryId);
    return {
      queryId,
      text: openai?.text || claude?.text || '',
      openai,
      claude
    };
  });

  // Compute disagreements
  const disagreements = comparisons.filter((comp) => {
    if (!comp.openai || !comp.claude) return false;
    const openaiPresence = comp.openai.presence;
    const claudePresence = comp.claude.presence;
    const openaiRank = comp.openai.llmRank;
    const claudeRank = comp.claude.llmRank;
    return (
      openaiPresence !== claudePresence ||
      (openaiRank !== null && claudeRank !== null && Math.abs(openaiRank - claudeRank) > 2)
    );
  });

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">Compare</div>
          <h1 className="page-title">Surface comparison</h1>
          <p className="page-subtitle">
            Compare OpenAI and Claude performance side-by-side to spot discrepancies and prioritize actions.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 text-sm text-slate-500 md:items-end">
          <div className="flex flex-wrap gap-4">
            <span>
              OpenAI: Score {openaiDetail.run.overallScore.toFixed(1)} • Visibility{' '}
              {openaiDetail.run.visibilityPct.toFixed(1)}%
            </span>
            <span>
              Claude: Score {claudeDetail.run.overallScore.toFixed(1)} • Visibility{' '}
              {claudeDetail.run.visibilityPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </header>

      <ActionBar clientId={client.id} page="compare" latestRunId={openaiDetail.run.runId} />

      {/* Summary Metrics */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="metric">
          <span className="metric-label">Score difference</span>
          <span className="metric-value">
            {Math.abs(openaiDetail.run.overallScore - claudeDetail.run.overallScore).toFixed(1)}
          </span>
          <p className="text-sm text-slate-500">
            {openaiDetail.run.overallScore > claudeDetail.run.overallScore
              ? 'OpenAI leads'
              : 'Claude leads'}
          </p>
        </div>
        <div className="metric">
          <span className="metric-label">Visibility difference</span>
          <span className="metric-value">
            {Math.abs(openaiDetail.run.visibilityPct - claudeDetail.run.visibilityPct).toFixed(1)}%
          </span>
          <p className="text-sm text-slate-500">
            {openaiDetail.run.visibilityPct > claudeDetail.run.visibilityPct
              ? 'OpenAI higher'
              : 'Claude higher'}
          </p>
        </div>
        <div className="metric">
          <span className="metric-label">Disagreements</span>
          <span className="metric-value">{disagreements.length}</span>
          <p className="text-sm text-slate-500">Queries with different presence or rank</p>
        </div>
        <div className="metric">
          <span className="metric-label">Total queries</span>
          <span className="metric-value">{comparisons.length}</span>
          <p className="text-sm text-slate-500">Compared across both surfaces</p>
        </div>
      </section>

      {/* Dumbbell Comparison Chart */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Score comparison by query</h2>
        <p className="mb-4 text-sm text-slate-500">
          Visual comparison of OpenAI vs Claude scores across queries. Green indicates improvement, red indicates decline. Hover over queries to see full text and delta values.
        </p>
        <DumbbellChart
          data={comparisons
            .filter((comp) => comp.openai && comp.claude)
            .slice(0, 20)
            .map((comp) => ({
              id: comp.queryId,
              label: comp.text.length > 45 ? comp.text.substring(0, 45) + '...' : comp.text,
              fullLabel: comp.text, // Full text for tooltip
              left: comp.openai!.score,
              right: comp.claude!.score,
              leftLabel: `${comp.openai!.score.toFixed(1)}`,
              rightLabel: `${comp.claude!.score.toFixed(1)}`
            }))}
          leftLabel="OpenAI Score"
          rightLabel="Claude Score"
          height={Math.min(comparisons.length * 20, 400)}
          sortBy="delta"
        />
      </section>

      {/* Comparison Table */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Query-by-query comparison</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Query</th>
                <th className="text-center">OpenAI Presence</th>
                <th className="text-center">OpenAI Rank</th>
                <th className="text-center">OpenAI Score</th>
                <th className="text-center">Claude Presence</th>
                <th className="text-center">Claude Rank</th>
                <th className="text-center">Claude Score</th>
                <th className="text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {comparisons.map((comp) => {
                const openaiPresence = comp.openai?.presence ?? false;
                const claudePresence = comp.claude?.presence ?? false;
                const openaiRank = comp.openai?.llmRank ?? null;
                const claudeRank = comp.claude?.llmRank ?? null;
                const openaiScore = comp.openai?.score ?? 0;
                const claudeScore = comp.claude?.score ?? 0;
                const scoreGap = Math.abs(openaiScore - claudeScore);
                const hasDisagreement = openaiPresence !== claudePresence || scoreGap > 10;

                return (
                  <tr
                    key={comp.queryId}
                    className={hasDisagreement ? 'bg-amber-50/50' : ''}
                  >
                    <td className="font-medium text-slate-900">{comp.text}</td>
                    <td className="text-center">
                      <span
                        className={openaiPresence ? 'font-semibold text-green-700' : 'text-slate-500'}
                      >
                        {openaiPresence ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="text-center">{openaiRank ?? '—'}</td>
                    <td className="text-center font-semibold text-slate-900">{openaiScore.toFixed(1)}</td>
                    <td className="text-center">
                      <span
                        className={claudePresence ? 'font-semibold text-green-700' : 'text-slate-500'}
                      >
                        {claudePresence ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="text-center">{claudeRank ?? '—'}</td>
                    <td className="text-center font-semibold text-slate-900">{claudeScore.toFixed(1)}</td>
                    <td className="text-right font-semibold text-slate-900">{scoreGap.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Disagreements Highlight */}
      {disagreements.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Priority disagreements</h2>
          <div className="space-y-3">
            {disagreements.slice(0, 5).map((comp) => (
              <div key={comp.queryId} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-slate-900">{comp.text}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                  <span>
                    OpenAI: {comp.openai?.presence ? 'Present' : 'Absent'} • Rank{' '}
                    {comp.openai?.llmRank ?? '—'} • Score {comp.openai?.score.toFixed(1)}
                  </span>
                  <span>
                    Claude: {comp.claude?.presence ? 'Present' : 'Absent'} • Rank{' '}
                    {comp.claude?.llmRank ?? '—'} • Score {comp.claude?.score.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}


