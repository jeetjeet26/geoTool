'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

type ActiveRun = {
  runId: string;
  surface: string;
  modelName: string;
  startedAt: Date;
};

type RunStatusIndicatorProps = {
  clientId: string;
  onRunDetected?: () => void;
};

export default function RunStatusIndicator({ clientId, onRunDetected }: RunStatusIndicatorProps) {
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/runs/status?clientId=${clientId}`);
        const data = await response.json();
        const runs = data.activeRuns || [];
        
        // If we detected runs and previously had none, notify parent
        if (runs.length > 0 && activeRuns.length === 0 && onRunDetected) {
          onRunDetected();
        }
        
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
  }, [clientId, onRunDetected, activeRuns.length]);

  if (activeRuns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-brand"></div>
        <span className="text-sm font-semibold text-brand">Run in progress</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-brand">
        {activeRuns.map((run) => (
          <span key={run.runId}>
            {run.surface.charAt(0).toUpperCase() + run.surface.slice(1)} · {run.modelName} · Started{' '}
            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
          </span>
        ))}
      </div>
    </div>
  );
}

