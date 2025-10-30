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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);

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

  const handleRunCompleted = () => {
    // Refresh the page when a run completes to show new results
    router.refresh();
  };

  const handleExportPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!latestRunId || isExportingPdf) return;
    
    setIsExportingPdf(true);
    try {
      const response = await fetch(`/api/reports/${latestRunId}/export?format=pdf`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `report_${latestRunId}.pdf`
        : `report_${latestRunId}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportMarkdown = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!latestRunId || isExportingMarkdown) return;
    
    setIsExportingMarkdown(true);
    try {
      const response = await fetch(`/api/reports/${latestRunId}/export`);
      
      if (!response.ok) {
        throw new Error('Failed to generate markdown');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `report_${latestRunId}.md`
        : `report_${latestRunId}.md`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Markdown export failed:', error);
      alert('Failed to export markdown. Please try again.');
    } finally {
      setIsExportingMarkdown(false);
    }
  };

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
      { label: 'Export PDF', icon: '📄', action: handleExportPdf, download: true, disabled: !latestRunId || isExportingPdf, loading: isExportingPdf },
      { label: 'Export Markdown', icon: '📊', action: handleExportMarkdown, download: true, disabled: !latestRunId || isExportingMarkdown, loading: isExportingMarkdown },
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
                  {...('download' in action && { download: action.download })}
                  onClick={'scroll' in action && action.scroll ? (e) => {
                e.preventDefault();
                const target = document.querySelector(action.href!);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                }
              } : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    ('primary' in action && action.primary)
                      ? 'bg-brand px-5 py-2 font-semibold text-white shadow-card hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'border border-neutral-200 bg-white/80 text-slate-700 hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {action.icon && <span>{action.icon}</span>}
                  {action.label}
                </Link>
              );
            }
            
            if ('action' in action) {
              return (
                <button
                  key={index}
                  onClick={action.action}
                  disabled={'disabled' in action && action.disabled}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  ('primary' in action && action.primary)
                    ? 'bg-brand px-5 py-2 font-semibold text-white shadow-card hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'border border-neutral-200 bg-white/80 text-slate-700 hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {action.icon && <span>{action.icon}</span>}
                {'loading' in action && action.loading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Generating...</span>
                  </>
                ) : (
                  action.label
                )}
                {isRunning && ('primary' in action && action.primary) && <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-white"></span>}
              </button>
              );
            }
            
            return null;
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
      {(isExportingPdf || isExportingMarkdown) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            <span className="text-sm font-semibold text-blue-900">
              {isExportingPdf ? 'Generating PDF report...' : 'Exporting markdown report...'}
            </span>
          </div>
          <span className="text-xs text-blue-700">This may take a few moments</span>
        </div>
      )}
      <RunStatusIndicator clientId={clientId} onRunDetected={handleRunDetected} onRunCompleted={handleRunCompleted} />
    </div>
  );
}

