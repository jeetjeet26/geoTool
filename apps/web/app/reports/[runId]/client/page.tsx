import { notFound } from 'next/navigation';

import {
  getClientById,
  getLatestRunDetailWithDiff,
  getRunDetailWithDiffById,
  getRunHistory,
  listClientKpis,
  listClientAnnotations,
  getLatestRunSummaries,
  type QueryRow
} from '@geo/db';
import TrendChart from '@/components/trend-chart';
import DistributionChart from '@/components/distribution-chart';
import CorrelationScatter from '@/components/correlation-scatter';
import CalendarHeatmap from '@/components/calendar-heatmap';
import RiskHeatmap from '@/components/risk-heatmap';
import DumbbellChart from '@/components/dumbbell-chart';
import FilteredQueriesTable from '@/components/filtered-queries-table';

// Helper to serialize QueryRow for client components
function serializeQueryRow(query: QueryRow): QueryRow {
  return {
    ...query,
    sov: query.sov !== null && query.sov !== undefined ? Number(query.sov) : null,
    score: Number(query.score),
    breakdown: {
      position: Number(query.breakdown.position),
      link: Number(query.breakdown.link),
      sov: Number(query.breakdown.sov),
      accuracy: Number(query.breakdown.accuracy)
    },
    deltas: query.deltas ? {
      presenceDelta: Number(query.deltas.presenceDelta),
      llmRankDelta: query.deltas.llmRankDelta !== null ? Number(query.deltas.llmRankDelta) : null,
      linkRankDelta: query.deltas.linkRankDelta !== null ? Number(query.deltas.linkRankDelta) : null,
      sovDelta: query.deltas.sovDelta !== null ? Number(query.deltas.sovDelta) : null,
      scoreDelta: query.deltas.scoreDelta !== null ? Number(query.deltas.scoreDelta) : null
    } : undefined
  };
}

// Helper to serialize annotations for client components
function serializeAnnotations(annotations: Awaited<ReturnType<typeof listClientAnnotations>>) {
  const map = new Map<string, Array<{
    id: string;
    tags: string[];
    note: string | null;
    updatedAt: string;
  }>>();
  
  annotations.forEach((annotation) => {
    const existing = map.get(annotation.queryId) || [];
    map.set(annotation.queryId, [
      ...existing,
      {
        id: annotation.id,
        tags: annotation.tags,
        note: annotation.note,
        updatedAt: annotation.updatedAt.toISOString()
      }
    ]);
  });
  
  return Object.fromEntries(map);
}

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'In progress';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

export default async function ClientReportPage({
  params
}: {
  params: { runId: string };
}) {
  // Get the run detail to find the client
  const runDetail = await getRunDetailWithDiffById(params.runId);

  if (!runDetail) {
    notFound();
  }

  const client = await getClientById(runDetail.run.clientId);

  if (!client) {
    notFound();
  }

  // Get all latest run details for cross-model analysis
  const openaiDetail = await getLatestRunDetailWithDiff('openai', client.id);
  const claudeDetail = await getLatestRunDetailWithDiff('claude', client.id);
  const runHistory = await getRunHistory(client.id);
  const clientKpis = await listClientKpis(client.id);
  const annotations = await listClientAnnotations(client.id);
  const latestRuns = await getLatestRunSummaries(client.id);

  // Compute cross-model comparisons
  const openaiQueriesMap = new Map(openaiDetail?.queries.map((q) => [q.queryId, q]) ?? []);
  const claudeQueriesMap = new Map(claudeDetail?.queries.map((q) => [q.queryId, q]) ?? []);
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

  // Compute insights
  const wins = [
    ...(openaiDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) > 5) || []),
    ...(claudeDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) > 5) || [])
  ].slice(0, 10);

  const losses = [
    ...(openaiDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) < -5) || []),
    ...(claudeDetail?.queries.filter((q) => (q.deltas?.scoreDelta ?? 0) < -5) || [])
  ].slice(0, 10);

  const risks = [
    ...(openaiDetail?.queries.filter((q) => q.flags.length > 0) || []),
    ...(claudeDetail?.queries.filter((q) => q.flags.length > 0) || [])
  ];

  const trendPoints = (runHistory ?? [])
    .slice()
    .reverse()
    .map((run) => ({
      date: (run.finishedAt ?? run.startedAt).toISOString(),
      score: Number(run.overallScore.toFixed(2)),
      visibility: Number(run.visibilityPct.toFixed(2))
    }));

  const annotationsMap = serializeAnnotations(annotations);

  return (
    <div className="print-report">
      {/* Cover Page */}
      <div className="print-page-break cover-page">
        <div className="cover-content">
          <h1 className="cover-title">{client.name}</h1>
          <h2 className="cover-subtitle">LLM Visibility Report</h2>
          <div className="cover-meta">
            <p>Generated: {formatDate(new Date())}</p>
            <p>Report Period: {runHistory.length > 0 ? formatDate(runHistory[runHistory.length - 1]?.finishedAt ?? runHistory[runHistory.length - 1]?.startedAt) : 'N/A'} - {runHistory.length > 0 ? formatDate(runHistory[0]?.finishedAt ?? runHistory[0]?.startedAt) : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="print-page-break">
        <h1 className="section-title">Executive Summary</h1>
        
        <div className="summary-grid">
          <div className="summary-card">
            <h3>Overall Performance</h3>
            <div className="metric-large">
              <span className="metric-value">
                {latestRuns.length
                  ? (latestRuns.reduce((sum, r) => sum + r.overallScore, 0) / latestRuns.length).toFixed(1)
                  : '0.0'}
              </span>
              <span className="metric-label">Average Score</span>
            </div>
            <div className="metric-large">
              <span className="metric-value">
                {latestRuns.length
                  ? (latestRuns.reduce((sum, r) => sum + r.visibilityPct, 0) / latestRuns.length).toFixed(1)
                  : '0.0'}%
              </span>
              <span className="metric-label">Average Visibility</span>
            </div>
          </div>

          <div className="summary-card">
            <h3>Key Highlights</h3>
            <ul className="insights-list">
              {wins.slice(0, 5).map((query, idx) => (
                <li key={idx}>
                  <strong>✅ Win:</strong> {query.text} (+{query.deltas?.scoreDelta?.toFixed(1) ?? 0} pts)
                </li>
              ))}
            </ul>
          </div>

          <div className="summary-card">
            <h3>Areas of Concern</h3>
            <ul className="insights-list">
              {losses.slice(0, 5).map((query, idx) => (
                <li key={idx}>
                  <strong>⚠️ Decline:</strong> {query.text} ({query.deltas?.scoreDelta?.toFixed(1) ?? 0} pts)
                </li>
              ))}
              {losses.length === 0 && <li>No significant declines detected.</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Single Model Deep Dives */}
      {openaiDetail && (
        <div className="print-page-break">
          <h1 className="section-title">OpenAI Performance Analysis</h1>
          
          <div className="model-header">
            <div className="model-metrics">
              <div className="metric">
                <span className="metric-label">Overall Score</span>
                <span className="metric-value">{openaiDetail.run.overallScore.toFixed(1)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Visibility</span>
                <span className="metric-value">{openaiDetail.run.visibilityPct.toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Model</span>
                <span className="metric-value">{openaiDetail.run.modelName}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Completed</span>
                <span className="metric-value">{formatDate(openaiDetail.run.finishedAt)}</span>
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h2>Score Distribution</h2>
            {openaiDetail.queries.length > 0 ? (
              <DistributionChart
                values={openaiDetail.queries.map((q) => q.score)}
                label="Query scores"
                bins={15}
              />
            ) : (
              <p className="text-sm text-slate-500">No data available</p>
            )}
          </div>

          <div className="chart-section">
            <h2>Top Performing Queries</h2>
            <FilteredQueriesTable queries={openaiDetail.queries.slice(0, 15).map(serializeQueryRow)} annotations={annotationsMap} />
          </div>

          {openaiDetail.queries.filter((q) => q.flags.length > 0).length > 0 && (
            <div className="chart-section">
              <h2>Risk Analysis</h2>
              <RiskHeatmap
                data={openaiDetail.queries
                  .filter((q) => q.flags.length > 0)
                  .flatMap((q) =>
                    q.flags.map((flag) => ({
                      flag,
                      queryType: q.type,
                      count: 1,
                      severity: ((flag.includes('critical') || flag.includes('high')
                        ? 'high'
                        : flag.includes('medium')
                          ? 'medium'
                          : 'low') as 'low' | 'medium' | 'high')
                    }))
                  )
                  .reduce((acc, item) => {
                    const existing = acc.find((i) => i.flag === item.flag && i.queryType === item.queryType);
                    if (existing) {
                      existing.count++;
                    } else {
                      acc.push(item);
                    }
                    return acc;
                  }, [] as Array<{ flag: string; queryType: string; count: number; severity: 'low' | 'medium' | 'high' }>)}
              />
            </div>
          )}
        </div>
      )}

      {claudeDetail && (
        <div className="print-page-break">
          <h1 className="section-title">Claude Performance Analysis</h1>
          
          <div className="model-header">
            <div className="model-metrics">
              <div className="metric">
                <span className="metric-label">Overall Score</span>
                <span className="metric-value">{claudeDetail.run.overallScore.toFixed(1)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Visibility</span>
                <span className="metric-value">{claudeDetail.run.visibilityPct.toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Model</span>
                <span className="metric-value">{claudeDetail.run.modelName}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Completed</span>
                <span className="metric-value">{formatDate(claudeDetail.run.finishedAt)}</span>
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h2>Score Distribution</h2>
            {claudeDetail.queries.length > 0 ? (
              <DistributionChart
                values={claudeDetail.queries.map((q) => q.score)}
                label="Query scores"
                bins={15}
              />
            ) : (
              <p className="text-sm text-slate-500">No data available</p>
            )}
          </div>

          <div className="chart-section">
            <h2>Top Performing Queries</h2>
            <FilteredQueriesTable queries={claudeDetail.queries.slice(0, 15).map(serializeQueryRow)} annotations={annotationsMap} />
          </div>

          {claudeDetail.queries.filter((q) => q.flags.length > 0).length > 0 && (
            <div className="chart-section">
              <h2>Risk Analysis</h2>
              <RiskHeatmap
                data={claudeDetail.queries
                  .filter((q) => q.flags.length > 0)
                  .flatMap((q) =>
                    q.flags.map((flag) => ({
                      flag,
                      queryType: q.type,
                      count: 1,
                      severity: ((flag.includes('critical') || flag.includes('high')
                        ? 'high'
                        : flag.includes('medium')
                          ? 'medium'
                          : 'low') as 'low' | 'medium' | 'high')
                    }))
                  )
                  .reduce((acc, item) => {
                    const existing = acc.find((i) => i.flag === item.flag && i.queryType === item.queryType);
                    if (existing) {
                      existing.count++;
                    } else {
                      acc.push(item);
                    }
                    return acc;
                  }, [] as Array<{ flag: string; queryType: string; count: number; severity: 'low' | 'medium' | 'high' }>)}
              />
            </div>
          )}
        </div>
      )}

      {/* Cross-Model Analysis */}
      {openaiDetail && claudeDetail && (
        <div className="print-page-break">
          <h1 className="section-title">Cross-Model Comparison</h1>

          <div className="comparison-summary">
            <div className="comparison-metric">
              <span className="comparison-label">Score Difference</span>
              <span className="comparison-value">
                {Math.abs(openaiDetail.run.overallScore - claudeDetail.run.overallScore).toFixed(1)}
              </span>
              <span className="comparison-detail">
                {openaiDetail.run.overallScore > claudeDetail.run.overallScore
                  ? 'OpenAI leads'
                  : 'Claude leads'}
              </span>
            </div>
            <div className="comparison-metric">
              <span className="comparison-label">Visibility Difference</span>
              <span className="comparison-value">
                {Math.abs(openaiDetail.run.visibilityPct - claudeDetail.run.visibilityPct).toFixed(1)}%
              </span>
              <span className="comparison-detail">
                {openaiDetail.run.visibilityPct > claudeDetail.run.visibilityPct
                  ? 'OpenAI higher'
                  : 'Claude higher'}
              </span>
            </div>
            <div className="comparison-metric">
              <span className="comparison-label">Disagreements</span>
              <span className="comparison-value">{disagreements.length}</span>
              <span className="comparison-detail">Queries with different presence or rank</span>
            </div>
          </div>

          <div className="chart-section">
            <h2>Score Comparison by Query</h2>
            {comparisons.filter((comp) => comp.openai && comp.claude).length > 0 ? (
              <DumbbellChart
                data={comparisons
                  .filter((comp) => comp.openai && comp.claude)
                  .slice(0, 20)
                  .map((comp) => ({
                    id: comp.queryId,
                    label: comp.text.length > 45 ? comp.text.substring(0, 45) + '...' : comp.text,
                    fullLabel: comp.text,
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
            ) : (
              <p className="text-sm text-slate-500">No comparison data available</p>
            )}
          </div>

          {disagreements.length > 0 && (
            <div className="chart-section">
              <h2>Priority Disagreements</h2>
              <div className="disagreements-list">
                {disagreements.slice(0, 10).map((comp) => (
                  <div key={comp.queryId} className="disagreement-item">
                    <p className="disagreement-query">{comp.text}</p>
                    <div className="disagreement-details">
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
            </div>
          )}
        </div>
      )}

      {/* Trend Analysis */}
      {trendPoints && trendPoints.length > 0 && (
        <div className="print-page-break">
          <h1 className="section-title">Historical Trends</h1>
          <div className="chart-section">
            <h2>Score & Visibility Over Time</h2>
            <TrendChart points={trendPoints} />
          </div>

          <div className="chart-section">
            <h2>Run Cadence</h2>
            {runHistory.filter((run) => run.finishedAt).length > 0 ? (
              <CalendarHeatmap
                data={runHistory
                  .filter((run) => run.finishedAt)
                  .map((run) => ({
                    date: run.finishedAt!.toISOString(),
                    value: run.overallScore,
                    label: `${run.surface} - Score: ${run.overallScore.toFixed(1)}`
                  }))}
                days={90}
                colorScheme="blue"
              />
            ) : (
              <p className="text-sm text-slate-500">No run history available</p>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="print-page-break">
        <h1 className="section-title">Recommendations</h1>
        
        <div className="recommendations-list">
          {wins.length > 0 && (
            <div className="recommendation-card">
              <h3>✅ Strengths to Leverage</h3>
              <ul>
                {wins.slice(0, 5).map((query, idx) => (
                  <li key={idx}>
                    Continue optimizing content for "{query.text}" which shows strong performance (+{query.deltas?.scoreDelta?.toFixed(1) ?? 0} pts)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {losses.length > 0 && (
            <div className="recommendation-card">
              <h3>⚠️ Areas Requiring Attention</h3>
              <ul>
                {losses.slice(0, 5).map((query, idx) => (
                  <li key={idx}>
                    Review and improve visibility for "{query.text}" which shows decline ({query.deltas?.scoreDelta?.toFixed(1) ?? 0} pts)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {disagreements.length > 0 && (
            <div className="recommendation-card">
              <h3>🔄 Cross-Model Alignment</h3>
              <ul>
                <li>
                  {disagreements.length} queries show disagreement between OpenAI and Claude. Investigate why these queries perform differently across models.
                </li>
                <li>
                  Focus on queries where presence differs or rank gaps exceed 2 positions.
                </li>
              </ul>
            </div>
          )}

          {risks.length > 0 && (
            <div className="recommendation-card">
              <h3>🚨 Risk Mitigation</h3>
              <ul>
                <li>
                  {risks.length} queries have been flagged for review. Address critical and high-severity flags promptly.
                </li>
                <li>
                  Review flagged queries in the risk heatmap to identify patterns and prioritize remediation.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Appendix */}
      <div className="print-page-break">
        <h1 className="section-title">Appendix</h1>
        
        <div className="appendix-section">
          <h2>Methodology</h2>
          <p>
            This report analyzes LLM visibility across OpenAI and Claude surfaces. Data is collected through
            automated crawls that query both surfaces with a standardized set of queries. Scores are calculated
            based on presence, rank position, and share of voice metrics.
          </p>
        </div>

        <div className="appendix-section">
          <h2>Data Sources</h2>
          <ul>
            <li>OpenAI Surface: {openaiDetail?.run.modelName ?? 'N/A'}</li>
            <li>Claude Surface: {claudeDetail?.run.modelName ?? 'N/A'}</li>
            <li>Total Queries Tracked: {allQueryIds.size}</li>
            <li>Total Runs Analyzed: {runHistory.length}</li>
          </ul>
        </div>

        {client.narrativeNotes && (
          <div className="appendix-section">
            <h2>Client Context</h2>
            <p>{client.narrativeNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

