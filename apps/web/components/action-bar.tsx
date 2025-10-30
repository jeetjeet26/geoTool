'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RunStatusIndicator from './run-status-indicator';

type ActionBarProps = {
  clientId: string;
  page: 'insights' | 'queries' | 'runs' | 'compare';
  latestRunId?: string;
};

// No need for separate function, handled inline

export default function ActionBar({ clientId, page, latestRunId }: ActionBarProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [runTriggered, setRunTriggered] = useState(false);

  const handleRunCrawl = async () => {
    setIsRunning(true);
    setRunTriggered(true);
    try {
      const formData = new FormData();
      formData.append('clientId', clientId);
      
      const response = await fetch('/api/runs/trigger', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        setRunTriggered(false);
        throw new Error('Failed to trigger run');
      }

      router.refresh();
      // Don't set isRunning to false immediately - let the status indicator take over
      setTimeout(() => {
        setIsRunning(false);
      }, 3000); // Keep button disabled for 3 seconds to give DB time to register the run
    } catch (error) {
      console.error('Failed to start run:', error);
      alert('Failed to start run. Please try again.');
      setIsRunning(false);
      setRunTriggered(false);
    }
  };

  const handleRunDetected = () => {
    setRunTriggered(false);
  };

  const exportUrl = latestRunId 
    ? `/api/reports/${latestRunId}/export`
    : null;

  const actions = {
    insights: [
      { label: 'Settings', icon: '⚙️', href: `/clients/${clientId}/settings` }
    ],
    queries: [
      { label: 'Add Query', icon: '➕', href: `#add-query`, scroll: true },
      { label: 'Settings', icon: '⚙️', href: `/clients/${clientId}/settings` }
    ],
    runs: [
      { label: 'Run Crawl', icon: '▶', action: handleRunCrawl, primary: true, disabled: isRunning },
      { label: 'Export All', icon: '📊', href: exportUrl, download: true, disabled: !exportUrl },
      { label: 'Set Baseline', icon: '📈', href: `/clients/${clientId}/settings#baseline` },
      { label: 'Settings', icon: '⚙️', href: `/clients/${clientId}/settings` }
    ],
    compare: [
      { label: 'Settings', icon: '⚙️', href: `/clients/${clientId}/settings` }
    ]
  };

  const pageActions = actions[page] || actions.insights;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {pageActions.map((action, index) => {
            if (action.href) {
              return (
                <Link
                  key={index}
                  href={action.href}
                  download={action.download}
              onClick={action.scroll ? (e) => {
                e.preventDefault();
                const target = document.querySelector(action.href!);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                }
              } : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    action.primary
                      ? 'bg-brand px-5 py-2 font-semibold text-white shadow-card hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'border border-neutral-200 bg-white/80 text-slate-700 hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {action.icon && <span>{action.icon}</span>}
                  {action.label}
                </Link>
              );
            }
            
            return (
              <button
                key={index}
                onClick={action.action}
                disabled={action.disabled}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  action.primary
                    ? 'bg-brand px-5 py-2 font-semibold text-white shadow-card hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'border border-neutral-200 bg-white/80 text-slate-700 hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
                {isRunning && action.primary && <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-white"></span>}
              </button>
            );
          })}
        </div>
      </div>
      {runTriggered && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-brand"></div>
            <span className="text-sm font-semibold text-brand">Starting crawl...</span>
          </div>
        </div>
      )}
      <RunStatusIndicator clientId={clientId} onRunDetected={handleRunDetected} />
    </div>
  );
}

