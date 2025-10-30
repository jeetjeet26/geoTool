import { NextResponse } from 'next/server';

import { getClientById, getRunDetailWithDiffById } from '@geo/db';

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

export async function GET(
  _request: Request,
  context: {
    params: {
      runId: string;
    };
  }
) {
  const { runId } = context.params;

  if (!runId) {
    return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
  }

  const runDetail = await getRunDetailWithDiffById(runId);

  if (!runDetail) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const client = await getClientById(runDetail.run.clientId);
  const clientName = client?.name ?? 'Unknown client';

  const wins = runDetail.queries
    .filter((query) => (query.deltas?.scoreDelta ?? 0) > 4)
    .slice(0, 5);
  const declines = runDetail.queries
    .filter((query) => (query.deltas?.scoreDelta ?? 0) < -4)
    .slice(0, 5);
  const flagged = runDetail.queries.filter((query) => query.flags.length > 0);

  const markdownReport = [`# ${clientName} · ${runDetail.run.surface.toUpperCase()} run`, '', `- Run ID: ${runDetail.run.runId}`, `- Model: ${runDetail.run.modelName}`, `- Completed: ${runDetail.run.finishedAt?.toISOString() ?? 'in progress'}`, `- Overall score: ${runDetail.run.overallScore.toFixed(1)}`, `- Visibility: ${runDetail.run.visibilityPct.toFixed(1)}%`, '', '## Highlights', wins.length === 0 ? '- No major wins this run.' : wins.map((query) => `- ✅ ${query.text} (+${(query.deltas?.scoreDelta ?? 0).toFixed(1)} pts)`).join('\n'), '', '## Regression watch', declines.length === 0 ? '- No meaningful declines.' : declines.map((query) => `- ⚠️ ${query.text} (${(query.deltas?.scoreDelta ?? 0).toFixed(1)} pts)`).join('\n'), '', '## Flagged queries', flagged.length === 0 ? '- No evaluator flags recorded.' : flagged.map((query) => `- ❗ ${query.text}: ${query.flags.join(', ')}`).join('\n'), '', '## Full query table', '| Query | Presence | LLM Rank | Link Rank | SOV | Score | Δ Score |', '| ----- | -------- | -------- | --------- | --- | ----- | ------- |'];

  runDetail.queries.forEach((query) => {
    markdownReport.push(
      `| ${query.text} | ${query.presence ? 'Yes' : 'No'} | ${query.llmRank ?? '—'} | ${
        query.linkRank ?? '—'
      } | ${toPercent(query.sov ? query.sov * 100 : null)} | ${query.score.toFixed(1)} | ${
        (query.deltas?.scoreDelta ?? 0) >= 0 ? '+' : ''
      }${(query.deltas?.scoreDelta ?? 0).toFixed(1)} |`
    );
  });

  const markdown = markdownReport.join('\n');

  // Generate filename with client name and run details
  const dateStr = runDetail.run.finishedAt
    ? new Date(runDetail.run.finishedAt).toISOString().split('T')[0]
    : 'in-progress';
  const filename = `${clientName.replace(/[^a-z0-9]/gi, '_')}_${runDetail.run.surface}_${dateStr}.md`;

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}




