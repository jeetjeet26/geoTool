'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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

type QueryFiltersProps = {
  queries: QueryRow[];
  onFilteredChange?: (filtered: QueryRow[]) => void;
};

export default function QueryFilters({ queries, onFilteredChange }: QueryFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [presenceFilter, setPresenceFilter] = useState(searchParams.get('presence') || 'all');
  const [flagsFilter, setFlagsFilter] = useState(searchParams.get('flags') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'score-delta');

  const filteredAndSorted = useMemo(() => {
    let filtered = [...queries];

    // Apply filters
    if (typeFilter !== 'all') {
      filtered = filtered.filter((q) => q.type === typeFilter);
    }

    if (presenceFilter === 'yes') {
      filtered = filtered.filter((q) => q.presence);
    } else if (presenceFilter === 'no') {
      filtered = filtered.filter((q) => !q.presence);
    }

    if (flagsFilter === 'has') {
      filtered = filtered.filter((q) => q.flags.length > 0);
    } else if (flagsFilter === 'none') {
      filtered = filtered.filter((q) => q.flags.length === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score-delta':
          const aDelta = a.deltas?.scoreDelta ?? 0;
          const bDelta = b.deltas?.scoreDelta ?? 0;
          return bDelta - aDelta; // Descending
        case 'score':
          return b.score - a.score; // Descending
        case 'presence':
          if (a.presence === b.presence) return 0;
          return a.presence ? -1 : 1; // Presence first
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  }, [queries, typeFilter, presenceFilter, flagsFilter, sortBy]);

  // Notify parent of filtered results
  useMemo(() => {
    onFilteredChange?.(filteredAndSorted);
  }, [filteredAndSorted, onFilteredChange]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  };

  const uniqueTypes = Array.from(new Set(queries.map((q) => q.type)));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white/80 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Filter:</span>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            updateFilter('type', e.target.value);
          }}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
        >
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={presenceFilter}
          onChange={(e) => {
            setPresenceFilter(e.target.value);
            updateFilter('presence', e.target.value);
          }}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
        >
          <option value="all">All presence</option>
          <option value="yes">With presence</option>
          <option value="no">No presence</option>
        </select>

        <select
          value={flagsFilter}
          onChange={(e) => {
            setFlagsFilter(e.target.value);
            updateFilter('flags', e.target.value);
          }}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
        >
          <option value="all">All flags</option>
          <option value="has">Has flags</option>
          <option value="none">No flags</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            updateFilter('sort', e.target.value);
          }}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
        >
          <option value="score-delta">Score Δ (impact)</option>
          <option value="score">Score (high to low)</option>
          <option value="presence">Presence</option>
          <option value="type">Type</option>
        </select>
      </div>

      <div className="text-xs text-slate-500">
        Showing {filteredAndSorted.length} of {queries.length}
      </div>
    </div>
  );
}

