'use client';

import { useMemo, useState } from 'react';
import QueryFilters from './query-filters';
import ScoreBreakdown from './score-breakdown';
import DeltaBadge from './delta-badge';
import TablePagination from './table-pagination';
import Sparkline from './sparkline';

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
  const [sort, setSort] = useState<
    | { key: 'text' | 'type' | 'presence' | 'llmRank' | 'linkRank' | 'sov' | 'score' | 'deltaScore'; dir: 'asc' | 'desc' }
    | null
  >(null);
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'presence' | 'flags'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const sortedQueries = useMemo(() => {
    if (!sort) return filteredQueries;
    const arr = [...filteredQueries];
    arr.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'text':
          return a.text.localeCompare(b.text) * dir;
        case 'type':
          return a.type.localeCompare(b.type) * dir;
        case 'presence':
          return ((a.presence ? 1 : 0) - (b.presence ? 1 : 0)) * dir;
        case 'llmRank': {
          const av = a.llmRank ?? Number.POSITIVE_INFINITY;
          const bv = b.llmRank ?? Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        case 'linkRank': {
          const av = a.linkRank ?? Number.POSITIVE_INFINITY;
          const bv = b.linkRank ?? Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        case 'sov': {
          const av = a.sov ?? -Infinity;
          const bv = b.sov ?? -Infinity;
          return (av - bv) * dir;
        }
        case 'score':
          return (a.score - b.score) * dir;
        case 'deltaScore': {
          const av = a.deltas?.scoreDelta ?? 0;
          const bv = b.deltas?.scoreDelta ?? 0;
          return (av - bv) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredQueries, sort]);

  const groupedQueries = useMemo(() => {
    if (groupBy === 'none') {
      return { groups: [{ key: 'all', items: sortedQueries }] };
    }

    const groupsMap = new Map<string, QueryRow[]>();
    
    sortedQueries.forEach((query) => {
      let key: string;
      if (groupBy === 'type') {
        key = query.type;
      } else if (groupBy === 'presence') {
        key = query.presence ? 'present' : 'absent';
      } else if (groupBy === 'flags') {
        key = query.flags.length > 0 ? 'flagged' : 'clean';
      } else {
        key = 'all';
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(query);
    });

    const groups = Array.from(groupsMap.entries()).map(([key, items]) => ({
      key,
      items,
      aggregate: {
        avgScore: items.reduce((sum, q) => sum + q.score, 0) / items.length,
        presenceRate: items.filter((q) => q.presence).length / items.length,
        flaggedCount: items.filter((q) => q.flags.length > 0).length
      }
    })).sort((a, b) => {
      if (groupBy === 'type') return a.key.localeCompare(b.key);
      if (groupBy === 'presence') return a.key === 'present' ? -1 : 1;
      if (groupBy === 'flags') return a.key === 'flagged' ? -1 : 1;
      return 0;
    });

    return { groups };
  }, [sortedQueries, groupBy]);

  const paginatedQueries = useMemo(() => {
    if (groupBy === 'none') {
      return groupedQueries.groups[0]!.items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }

    // For grouped view, show all groups but paginate within each
    const allItems: Array<{ type: 'group' | 'item'; data: any }> = [];
    groupedQueries.groups.forEach((group) => {
      const isExpanded = expandedGroups.has(group.key);
      allItems.push({ type: 'group', data: group });
      if (isExpanded) {
        group.items.forEach((item) => allItems.push({ type: 'item', data: item }));
      }
    });

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return allItems.slice(start, end);
  }, [groupedQueries, currentPage, pageSize, groupBy, expandedGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Reset to page 1 when filters change
  const handleFilterChange = (filtered: QueryRow[]) => {
    setFilteredQueries(filtered);
    setCurrentPage(1);
  };

  const toggleSort = (key: NonNullable<typeof sort>['key']) => {
    setCurrentPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null; // remove sort on third click
    });
  };

  const renderSortIcon = (key: NonNullable<typeof sort>['key']) => {
    if (!sort || sort.key !== key) return <span aria-hidden className="opacity-40">⇅</span>;
    return sort.dir === 'asc' ? <span aria-hidden>▲</span> : <span aria-hidden>▼</span>;
  };

  const rankHeatClass = (value: number | null) => {
    if (value === null) return '';
    if (value <= 3) return 'bg-green-100';
    if (value <= 10) return 'bg-emerald-50';
    return 'bg-neutral-50';
  };

  return (
    <>
      <QueryFilters queries={queries} onFilteredChange={handleFilterChange} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value as typeof groupBy);
              setCurrentPage(1);
              setExpandedGroups(new Set());
            }}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <option value="none">None</option>
            <option value="type">Type</option>
            <option value="presence">Presence</option>
            <option value="flags">Flags</option>
          </select>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => {
            const rows = sortedQueries.map((q) => ({
              Query: q.text,
              Type: q.type,
              Presence: q.presence ? 'Yes' : 'No',
              LLMRank: q.llmRank ?? '',
              LinkRank: q.linkRank ?? '',
              SOV: q.sov !== null ? (q.sov * 100).toFixed(1) + '%' : '',
              Score: q.score.toFixed(1),
              DeltaScore: q.deltas?.scoreDelta !== null && q.deltas?.scoreDelta !== undefined ? q.deltas!.scoreDelta!.toFixed(1) : ''
            }));
            const header = Object.keys(rows[0] ?? { Query: '', Type: '' }).join(',');
            const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'queries_export.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export current view (CSV)
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('text')}
                  aria-sort={sort?.key === 'text' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Query {renderSortIcon('text')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('type')}
                  aria-sort={sort?.key === 'type' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Type {renderSortIcon('type')}
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('presence')}
                  aria-sort={sort?.key === 'presence' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Presence {renderSortIcon('presence')}
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('llmRank')}
                  aria-sort={sort?.key === 'llmRank' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  LLM Rank {renderSortIcon('llmRank')}
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('linkRank')}
                  aria-sort={sort?.key === 'linkRank' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Link Rank {renderSortIcon('linkRank')}
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('sov')}
                  aria-sort={sort?.key === 'sov' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  SOV {renderSortIcon('sov')}
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('score')}
                  aria-sort={sort?.key === 'score' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Score {renderSortIcon('score')}
                </button>
              </th>
              <th>Annotations</th>
              <th className="text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort('deltaScore')}
                  aria-sort={sort?.key === 'deltaScore' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Δ Score {renderSortIcon('deltaScore')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {groupBy === 'none' ? (
              paginatedQueries.map((query) => (
                <TableRow key={query.queryId} query={query} annotations={annotations} />
              ))
            ) : (
              paginatedQueries.map((item, index) => {
                if (item.type === 'group') {
                  const group = item.data;
                  const isExpanded = expandedGroups.has(group.key);
                  return (
                    <tr key={`group-${group.key}`} className="bg-slate-50/50">
                      <td colSpan={9} className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900 hover:text-slate-700"
                        >
                          <span>
                            {group.key === 'present' ? 'Present' : group.key === 'absent' ? 'Absent' : group.key === 'flagged' ? 'Flagged' : group.key === 'clean' ? 'Clean' : group.key.charAt(0).toUpperCase() + group.key.slice(1)} ({group.items.length})
                          </span>
                          <span className="text-xs text-slate-500">
                            Avg score: {group.aggregate.avgScore.toFixed(1)} • Presence: {(group.aggregate.presenceRate * 100).toFixed(0)}%
                            {group.aggregate.flaggedCount > 0 && ` • ${group.aggregate.flaggedCount} flagged`}
                          </span>
                          <span>{isExpanded ? '▼' : '▶'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                } else {
                  return <TableRow key={item.data.queryId} query={item.data} annotations={annotations} />;
                }
              })
            )}
          </tbody>
        </table>
      </div>

      {groupBy === 'none' && filteredQueries.length > pageSize && (
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

function TableRow({ query, annotations }: { query: QueryRow; annotations: Record<string, Array<{ id: string; tags: string[]; note: string | null; updatedAt: string }>> }) {
  const rankHeatClass = (value: number | null) => {
    if (value === null) return '';
    if (value <= 3) return 'bg-green-100';
    if (value <= 10) return 'bg-emerald-50';
    return 'bg-neutral-50';
  };

  return (
    <tr>
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
                      <span className={query.presence ? 'mr-1 inline-block h-2 w-2 rounded-full bg-green-500' : 'mr-1 inline-block h-2 w-2 rounded-full bg-neutral-300'} aria-hidden />
                      {query.presence ? 'Yes' : 'No'}
                    </span>
                    {query.deltas && (
                      <DeltaBadge value={query.deltas.presenceDelta} type="score" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className={`flex flex-col items-end gap-1 ${rankHeatClass(query.llmRank)} rounded px-1`}>
                    <span className="font-medium text-slate-900">{query.llmRank ?? '—'}</span>
                    {query.deltas?.llmRankDelta !== null && query.deltas?.llmRankDelta !== undefined && (
                      <DeltaBadge value={query.deltas.llmRankDelta} type="rank" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className={`flex flex-col items-end gap-1 ${rankHeatClass(query.linkRank)} rounded px-1`}>
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
                    {query.sov !== null && (
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sky-100">
                        <div className="h-full bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, query.sov * 100))}%` }} />
                      </div>
                    )}
                    {query.deltas?.sovDelta !== null && query.deltas?.sovDelta !== undefined && (
                      <DeltaBadge value={(query.deltas.sovDelta ?? 0) * 100} type="percent" />
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <ScoreBreakdown score={query.score} breakdown={query.breakdown} compact />
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, query.score))}%` }} />
                    </div>
                  </div>
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
                  <div className="flex flex-col items-end gap-1">
                    <DeltaBadge value={query.deltas?.scoreDelta} type="score" showZero />
                    {query.deltas?.scoreDelta !== null && query.deltas?.scoreDelta !== undefined && (
                      <Sparkline
                        values={[query.score - (query.deltas.scoreDelta ?? 0), query.score]}
                        width={50}
                        height={16}
                        strokeColor={query.deltas.scoreDelta > 0 ? '#10b981' : query.deltas.scoreDelta < 0 ? '#ef4444' : '#64748b'}
                      />
                    )}
                  </div>
                </td>
              </tr>
  );
}

