'use client';

import { useState } from 'react';
import QueryFilters from './query-filters';

type QueryRow = {
  queryId: string;
  text: string;
  type: string;
  presence: boolean;
  llmRank: number | null;
  linkRank: number | null;
  sov: number | null;
  flags: string[];
  score: number;
  breakdown: {
    position: number;
    link: number;
    sov: number;
    accuracy: number;
  };
  deltas?: {
    presenceDelta: number;
    llmRankDelta: number | null;
    linkRankDelta: number | null;
    sovDelta: number | null;
    scoreDelta: number | null;
  };
};

type FilteredQueriesTableProps = {
  queries: QueryRow[];
};

function formatDelta(value: number | null | undefined, { percent = false } = {}) {
  if (value === null || value === undefined) return '—';
  const precision = percent ? 1 : Number.isInteger(value) ? 0 : 1;
  const formatted = value.toFixed(precision);
  if (value > 0) return `+${formatted}`;
  if (percent) return formatted;
  return formatted;
}

export default function FilteredQueriesTable({ queries }: FilteredQueriesTableProps) {
  const [filteredQueries, setFilteredQueries] = useState<QueryRow[]>(queries);

  return (
    <>
      <QueryFilters queries={queries} onFilteredChange={setFilteredQueries} />

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
            {filteredQueries.map((query) => (
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
                    <div className="text-xs text-slate-500">
                      {formatDelta((query.deltas.sovDelta ?? 0) * 100, { percent: true })}%
                    </div>
                  )}
                </td>
                <td className="text-right">
                  {query.score.toFixed(1)}
                  <div className="text-xs text-slate-500">
                    Pos {query.breakdown.position.toFixed(0)} · Link {query.breakdown.link.toFixed(0)} · SOV{' '}
                    {query.breakdown.sov.toFixed(0)} · Acc {query.breakdown.accuracy.toFixed(0)}
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
    </>
  );
}

