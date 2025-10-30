'use client';

import { useMemo } from 'react';

type RiskHeatmapProps = {
  data: Array<{ flag: string; queryType: string; count: number; severity?: 'low' | 'medium' | 'high' }>;
};

export default function RiskHeatmap({ data }: RiskHeatmapProps) {
  const chart = useMemo(() => {
    const flags = Array.from(new Set(data.map((d) => d.flag))).sort();
    const types = Array.from(new Set(data.map((d) => d.queryType))).sort();
    const maxCount = Math.max(...data.map((d) => d.count), 1);

    const matrix = flags.map((flag) =>
      types.map((type) => {
        const entry = data.find((d) => d.flag === flag && d.queryType === type);
        return {
          flag,
          type,
          count: entry?.count ?? 0,
          severity: entry?.severity ?? 'low',
          intensity: entry ? entry.count / maxCount : 0
        };
      })
    );

    return { flags, types, matrix, maxCount };
  }, [data]);

  const getColor = (intensity: number, severity?: 'low' | 'medium' | 'high') => {
    if (intensity === 0) return '#f8fafc';
    if (severity === 'high') {
      if (intensity < 0.5) return '#fecaca';
      if (intensity < 0.8) return '#f87171';
      return '#dc2626';
    }
    if (severity === 'medium') {
      if (intensity < 0.5) return '#fed7aa';
      if (intensity < 0.8) return '#fb923c';
      return '#ea580c';
    }
    if (intensity < 0.5) return '#fef3c7';
    if (intensity < 0.8) return '#facc15';
    return '#ca8a04';
  };

  const cellSize = 60;
  const padding = 8;

  if (chart.flags.length === 0 || chart.types.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-slate-400">
        No risk data
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto">
        <svg
          width={Math.max(400, chart.types.length * cellSize + padding * 2)}
          height={chart.flags.length * cellSize + padding * 2 + 30}
          className="overflow-visible"
        >
          {/* Column headers */}
          {chart.types.map((type, colIndex) => (
            <text
              key={type}
              x={padding + colIndex * cellSize + cellSize / 2}
              y={20}
              className="text-xs fill-slate-700 font-medium"
              textAnchor="middle"
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </text>
          ))}

          {/* Row headers */}
          {chart.flags.map((flag, rowIndex) => (
            <text
              key={flag}
              x={padding - 4}
              y={padding + rowIndex * cellSize + cellSize / 2 + 4}
              className="text-xs fill-slate-700 font-medium"
              textAnchor="end"
            >
              {flag}
            </text>
          ))}

          {/* Cells */}
          {chart.matrix.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const x = padding + colIndex * cellSize;
              const y = padding + rowIndex * cellSize + 30;

              return (
                <g key={`${cell.flag}-${cell.type}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellSize - 4}
                    height={cellSize - 4}
                    fill={getColor(cell.intensity, cell.severity)}
                    stroke="#ffffff"
                    strokeWidth="1"
                    rx="4"
                    className="transition-all hover:stroke-slate-900 hover:stroke-2"
                  />
                  <text
                    x={x + (cellSize - 4) / 2}
                    y={y + (cellSize - 4) / 2 + 4}
                    className="text-sm fill-slate-900 font-semibold"
                    textAnchor="middle"
                  >
                    {cell.count}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Risk distribution by flag and query type</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-yellow-200" /> Low
          </span>
          <span className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-orange-300" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-red-400" /> High
          </span>
        </div>
      </div>
    </div>
  );
}


