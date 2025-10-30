import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { config as loadEnv } from 'dotenv';

import { getRunDetailWithDiffById, prisma } from '@geo/db';
import type { QueryRow, RunDetail } from '@geo/db';

import { isDirectCliInvocation } from './utils/is-direct-invoke.js';

loadEnv();

interface ReportOptions {
  runId: string;
}

function parseArgs(argv: string[]): ReportOptions {
  const args = argv.slice(2);
  let runId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--run') {
      runId = args[++index];
    }
  }

  if (!runId) {
    throw new Error('Missing required argument --run <id>');
  }

  return { runId };
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function listTopWins(queries: QueryRow[], take: number) {
  const sorted = [...queries]
    .map((row) => ({ row, value: row.deltas?.scoreDelta ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, take)
    .filter((item) => item.value > 0);

  if (sorted.length === 0) {
    return '- No significant wins this run.';
  }

  return sorted
    .map((item) => `- ${item.row.text} (+${item.value.toFixed(1)})`)
    .join('\n');
}

function listTopLosses(queries: QueryRow[], take: number) {
  const sorted = [...queries]
    .map((row) => ({ row, value: row.deltas?.scoreDelta ?? 0 }))
    .sort((a, b) => a.value - b.value)
    .slice(0, take)
    .filter((item) => item.value < 0);

  if (sorted.length === 0) {
    return '- No significant losses this run.';
  }

  return sorted
    .map((item) => `- ${item.row.text} (${item.value.toFixed(1)})`)
    .join('\n');
}

function recommendFixes(queries: QueryRow[], take: number): string {
  const ranked = queries
    .filter((row) => !row.presence || row.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length || a.score - b.score)
    .slice(0, take);

  if (ranked.length === 0) {
    return '- All clear! No priority fixes detected.';
  }

  return ranked
    .map((row) => {
      const reasons: string[] = [];
      if (!row.presence) reasons.push('missing presence');
      if (row.flags.length > 0) reasons.push(row.flags.join('/'));
      if (row.linkRank === null) reasons.push('no brand link');
      return `- ${row.text} — ${reasons.join(', ')}`;
    })
    .join('\n');
}

function renderMarkdown(detail: RunDetail): string {
  const totalQueries = detail.queries.length;

  return `# LLM SERP Report — Run ${detail.run.runId}

**Surface:** ${detail.run.surface.toUpperCase()}  
**Model:** ${detail.run.modelName}  
**Score:** ${formatScore(detail.run.overallScore)}  
**Visibility:** ${formatPercent(detail.run.visibilityPct)}  
**Queries:** ${totalQueries}

## Executive Summary
- Overall score: ${formatScore(detail.run.overallScore)}
- Visibility: ${formatPercent(detail.run.visibilityPct)}
- Top flags: ${detail.queries.filter((row) => row.flags.length > 0).length}

## Top Wins
${listTopWins(detail.queries, 5)}

## Top Losses
${listTopLosses(detail.queries, 5)}

## Fix First
${recommendFixes(detail.queries, 5)}

## Appendix — Query Breakdown
| Query | Presence | LLM Rank | Link Rank | SOV | Score | Δ Score |
| --- | --- | --- | --- | --- | --- | --- |
${detail.queries
  .map((row) =>
    `| ${row.text} | ${row.presence ? 'Yes' : 'No'} | ${row.llmRank ?? '—'} | ${row.linkRank ?? '—'} | ${
      row.sov !== null ? formatPercent(row.sov * 100) : '—'
    } | ${formatScore(row.score)} | ${row.deltas?.scoreDelta ? row.deltas.scoreDelta.toFixed(1) : '0.0'} |`
  )
  .join('\n')}
`;
}

async function writeReportFiles(markdown: string, runId: string) {
  const reportDir = path.resolve(process.cwd(), 'reports');
  await mkdir(reportDir, { recursive: true });

  const mdPath = path.join(reportDir, `run-${runId}.md`);
  const htmlPath = path.join(reportDir, `run-${runId}.html`);

  await writeFile(mdPath, markdown, 'utf8');
  await writeFile(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><title>Run ${runId} Report</title></head><body><pre>${markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre></body></html>`,
    'utf8'
  );

  return { mdPath, htmlPath };
}

export async function generateReport(): Promise<void> {
  const options = parseArgs(process.argv);
  const detail = await getRunDetailWithDiffById(options.runId);

  if (!detail) {
    throw new Error(`Run ${options.runId} not found`);
  }

  const markdown = renderMarkdown(detail);
  const files = await writeReportFiles(markdown, options.runId);

  console.log(`Report generated:\n- ${files.mdPath}\n- ${files.htmlPath}`);
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  generateReport()
    .catch((error) => {
      console.error('Report generation failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
