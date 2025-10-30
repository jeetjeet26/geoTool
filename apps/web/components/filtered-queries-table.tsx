'use client';

import { useState } from 'react';
import QueryFilters from './query-filters';
import ScoreBreakdown from './score-breakdown';
import DeltaBadge from './delta-badge';
import TablePagination from './table-pagination';

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
  annotations?: Record<
    string,
    Array<{
      id: string;
      tags: string[];
      note: string | null;
      updatedAt: string;
    }>
  >;
};

export default function FilteredQueriesTable({ queries, annotations = {} }: FilteredQueriesTableProps) {
  const [filteredQueries, setFilteredQueries] = useState<QueryRow[]>(queries);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const paginatedQueries = filteredQueries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (filtered: QueryRow[]) => {
    setFilteredQueries(filtered);
    setCurrentPage(1);
  };

  return (
    <>
      <QueryFilters queries={queries} onFilteredChange={handleFilterChange} />

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
              <th>Annotations</th>
              <th className="text-right">Δ Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedQueries.map((query) => (
              <tr key={query.queryId}>
                <td>
                  <div className="font-medium text-slate-900">{query.text}</div>
                  {query.flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {query.flags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {query.type}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className={query.presence ? 'font-semibold text-green-700' : 'text-slate-500'}>
                      {query.presence ? 'Yes' : 'No'}
                    </span>
                    {query.deltas && (
                      <DeltaBadge value={query.deltas.presenceDelta} type="score" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-slate-900">{query.llmRank ?? '—'}</span>
                    {query.deltas?.llmRankDelta !== null && query.deltas?.llmRankDelta !== undefined && (
                      <DeltaBadge value={query.deltas.llmRankDelta} type="rank" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-slate-900">{query.linkRank ?? '—'}</span>
                    {query.deltas?.linkRankDelta !== null && query.deltas?.linkRankDelta !== undefined && (
                      <DeltaBadge value={query.deltas.linkRankDelta} type="rank" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-slate-900">
                      {query.sov !== null ? `${(query.sov * 100).toFixed(1)}%` : '—'}
                    </span>
                    {query.deltas?.sovDelta !== null && query.deltas?.sovDelta !== undefined && (
                      <DeltaBadge value={(query.deltas.sovDelta ?? 0) * 100} type="percent" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <ScoreBreakdown score={query.score} breakdown={query.breakdown} compact />
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {(annotations[query.queryId] ?? []).map((annotation) => (
                      <span
                        key={annotation.id}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        {annotation.tags.join(', ')}
                      </span>
                    ))}
                    {(annotations[query.queryId] ?? []).length === 0 && (
                      <span className="text-xs text-slate-500">No notes</span>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <DeltaBadge value={query.deltas?.scoreDelta} type="score" showZero />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredQueries.length > pageSize && (
        <TablePagination
          current={currentPage}
          total={filteredQueries.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </>
  );
}

