'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import FilterPills from './filter-pills';

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
  useEffect(() => {
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
  const activeFilterCount = [typeFilter, presenceFilter, flagsFilter].filter((f) => f !== 'all').length;

  const clearAll = () => {
    setTypeFilter('all');
    setPresenceFilter('all');
    setFlagsFilter('all');
    const params = new URLSearchParams();
    if (sortBy !== 'score-delta') {
      params.set('sort', sortBy);
    }
    router.push(`?${params.toString()}`);
  };

  const typeOptions = [
    { value: 'all', label: 'All' },
    ...uniqueTypes.map((type) => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))
  ];

  const presenceOptions = [
    { value: 'all', label: 'All' },
    { value: 'yes', label: 'With presence', icon: '✓' },
    { value: 'no', label: 'No presence', icon: '✗' }
  ];

  const flagsOptions = [
    { value: 'all', label: 'All' },
    { value: 'has', label: 'Has flags', icon: '⚠️' },
    { value: 'none', label: 'No flags', icon: '✓' }
  ];

  const sortOptions = [
    { value: 'score-delta', label: 'Score Δ' },
    { value: 'score', label: 'Score' },
    { value: 'presence', label: 'Presence' },
    { value: 'type', label: 'Type' }
  ];

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FilterPills
          label="Type"
          options={typeOptions}
          value={typeFilter}
          onChange={(value) => {
            setTypeFilter(value);
            updateFilter('type', value);
          }}
        />

        <FilterPills
          label="Presence"
          options={presenceOptions}
          value={presenceFilter}
          onChange={(value) => {
            setPresenceFilter(value);
            updateFilter('presence', value);
          }}
        />

        <FilterPills
          label="Flags"
          options={flagsOptions}
          value={flagsFilter}
          onChange={(value) => {
            setFlagsFilter(value);
            updateFilter('flags', value);
          }}
        />

        <FilterPills
          label="Sort"
          options={sortOptions}
          value={sortBy}
          onChange={(value) => {
            setSortBy(value);
            updateFilter('sort', value);
          }}
        />
      </div>

      <div className="border-t border-neutral-200 pt-3 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-900">{filteredAndSorted.length}</span> of{' '}
        <span className="font-semibold text-slate-900">{queries.length}</span> queries
      </div>
    </div>
  );
}


