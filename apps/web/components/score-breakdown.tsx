'use client';

import { useState } from 'react';

type ScoreBreakdownProps = {
  score: number;
  breakdown: {
    position: number;
    link: number;
    sov: number;
    accuracy: number;
  };
  compact?: boolean;
};

export default function ScoreBreakdown({ score, breakdown, compact = false }: ScoreBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          title="View score breakdown"
        >
          <span>{score.toFixed(1)}</span>
          <span className="opacity-60">ⓘ</span>
        </button>
        
        {isExpanded && (
          <div className="absolute right-0 z-10 mt-2 min-w-[200px] rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Position</span>
                <span className="font-semibold text-slate-900">{breakdown.position.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Link</span>
                <span className="font-semibold text-slate-900">{breakdown.link.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">SOV</span>
                <span className="font-semibold text-slate-900">{breakdown.sov.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Accuracy</span>
                <span className="font-semibold text-slate-900">{breakdown.accuracy.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Score: {score.toFixed(1)}</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          {isExpanded ? 'Hide' : 'Show'} breakdown
        </button>
      </div>
      
      {isExpanded && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white/80 p-3">
          <div className="space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">Position</span>
                <span className="font-semibold text-slate-900">{breakdown.position.toFixed(0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-slate-900 transition-all"
                  style={{ width: `${breakdown.position}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">Link</span>
                <span className="font-semibold text-slate-900">{breakdown.link.toFixed(0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${breakdown.link}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">SOV</span>
                <span className="font-semibold text-slate-900">{breakdown.sov.toFixed(0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${breakdown.sov}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">Accuracy</span>
                <span className="font-semibold text-slate-900">{breakdown.accuracy.toFixed(0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${breakdown.accuracy}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



