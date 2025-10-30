'use client';

type TablePaginationProps = {
  current: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export default function TablePagination({
  current,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange
}: TablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const pageSizeOptions = [25, 50, 100];

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white/80 px-4 py-3 sm:flex-row">
      <div className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{start}</span> -{' '}
        <span className="font-semibold text-slate-900">{end}</span> of{' '}
        <span className="font-semibold text-slate-900">{total}</span>
      </div>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(current - 1)}
            disabled={current === 1}
            className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-900">{current}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </span>
          <button
            onClick={() => onPageChange(current + 1)}
            disabled={current === totalPages}
            className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-neutral-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}



