'use client';

type LoadingSkeletonProps = {
  type?: 'table' | 'card' | 'metric';
  rows?: number;
};

export default function LoadingSkeleton({ type = 'table', rows = 5 }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 rounded-lg border border-neutral-200 bg-white/80 p-4">
            <div className="h-4 flex-1 rounded bg-neutral-200"></div>
            <div className="h-4 w-20 rounded bg-neutral-200"></div>
            <div className="h-4 w-16 rounded bg-neutral-200"></div>
            <div className="h-4 w-12 rounded bg-neutral-200"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="animate-pulse space-y-4 rounded-2xl border border-neutral-200 bg-white/95 p-6">
        <div className="h-6 w-3/4 rounded bg-neutral-200"></div>
        <div className="h-4 w-full rounded bg-neutral-200"></div>
        <div className="h-4 w-5/6 rounded bg-neutral-200"></div>
      </div>
    );
  }

  if (type === 'metric') {
    return (
      <div className="animate-pulse space-y-3 rounded-xl border border-neutral-200 bg-white/80 p-5">
        <div className="h-4 w-24 rounded bg-neutral-200"></div>
        <div className="h-10 w-32 rounded bg-neutral-200"></div>
        <div className="h-4 w-full rounded bg-neutral-200"></div>
      </div>
    );
  }

  return null;
}



