'use client';

type DeltaBadgeProps = {
  value: number | null | undefined;
  type?: 'score' | 'rank' | 'percent';
  showZero?: boolean;
};

export default function DeltaBadge({ value, type = 'score', showZero = false }: DeltaBadgeProps) {
  if (value === null || value === undefined || (value === 0 && !showZero)) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const formatValue = () => {
    if (type === 'percent') {
      return `${absValue.toFixed(1)}%`;
    }
    if (type === 'rank') {
      return absValue.toFixed(0);
    }
    return absValue.toFixed(1);
  };

  const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
  const colorClass = isPositive
    ? 'font-semibold text-green-600'
    : isNegative
    ? 'font-semibold text-red-600'
    : 'text-slate-500';

  const sign = isPositive ? '+' : '';

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
      {arrow && <span>{arrow}</span>}
      <span>
        {sign}
        {formatValue()}
      </span>
    </span>
  );
}


