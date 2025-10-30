'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

type ActiveRun = {
  runId: string;
  surface: string;
  modelName: string;
  startedAt: string;
  totalQueries: number | null;
  completedQueries: number;
};

type RunStatusIndicatorProps = {
  clientId: string;
  onRunDetected?: () => void;
  onRunCompleted?: () => void;
};

export default function RunStatusIndicator({ clientId, onRunDetected, onRunCompleted }: RunStatusIndicatorProps) {
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [previousRunCount, setPreviousRunCount] = useState(0);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/runs/status?clientId=${clientId}`);
        const data = await response.json();
        const runs = ((data.activeRuns || []) as ActiveRun[]).map((run) => ({
          ...run,
          totalQueries: run.totalQueries ?? null,
          completedQueries: run.completedQueries ?? 0
        }));
        
        // If we detected runs and previously had none, notify parent
        if (runs.length > 0 && activeRuns.length === 0 && onRunDetected) {
          onRunDetected();
        }
        
        // If we had active runs and now we don't, a run just completed
        if (previousRunCount > 0 && runs.length === 0 && onRunCompleted) {
          onRunCompleted();
        }
        
        setPreviousRunCount(runs.length);
        setActiveRuns(runs);

        // Continue polling if there are active runs
        if (runs.length > 0 && !pollInterval) {
          pollInterval = setInterval(checkStatus, 2000); // Poll every 2 seconds
        } else if (runs.length === 0 && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      } catch (error) {
        console.error('Failed to check run status:', error);
      }
    };

    // Initial check
    checkStatus();

    // Set up polling interval
    pollInterval = setInterval(checkStatus, 2000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [clientId, onRunDetected, onRunCompleted, activeRuns.length, previousRunCount]);

  if (activeRuns.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-brand/30 bg-brand-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-brand"></div>
        <span className="text-sm font-semibold text-brand">Run in progress</span>
      </div>
      <div className="flex flex-col gap-3 text-xs text-brand">
        {activeRuns.map((run) => {
          const totalQueries = run.totalQueries ?? 0;
          const completedQueries = run.completedQueries ?? 0;
          const hasTotals = totalQueries > 0;
          const progressFraction = hasTotals ? Math.min(completedQueries / totalQueries, 1) : null;
          const percentComplete = progressFraction !== null ? Math.round(progressFraction * 100) : null;
          const progressWidth = progressFraction !== null ? `${Math.max(progressFraction * 100, 4)}%` : '25%';

          return (
            <div key={run.runId} className="flex w-full flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-semibold text-brand">
                <span>
                  {run.surface.charAt(0).toUpperCase() + run.surface.slice(1)} · {run.modelName}
                </span>
                <span>
                  {percentComplete !== null ? `${percentComplete}%` : 'Starting…'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-brand/20">
                <div
                  className={`h-full bg-brand ${progressFraction === null ? 'animate-pulse' : ''}`}
                  style={{ width: progressWidth, transition: 'width 500ms ease-out' }}
                ></div>
              </div>
              <span className="text-[11px] text-brand/70">
                {hasTotals
                  ? `Processed ${completedQueries} of ${totalQueries} queries`
                  : 'Preparing queries…'}{' '}
                · Started {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

