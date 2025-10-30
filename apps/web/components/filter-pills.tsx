'use client';

type FilterOption = {
  value: string;
  label: string;
  icon?: string;
};

type FilterPillsProps = {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
};

export default function FilterPills({ label, options, value, onChange }: FilterPillsProps) {
  const activeCount = value !== 'all' ? 1 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
        {activeCount > 0 && (
          <span className="text-xs text-slate-500">({activeCount} active)</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
              }`}
            >
              {option.icon && <span>{option.icon}</span>}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}



