'use client';

import { useMemo } from 'react';

type DistributionChartProps = {
  values: number[];
  bins?: number;
  label?: string;
  showStats?: boolean;
  height?: number;
};

export default function DistributionChart({
  values,
  bins = 20,
  label,
  showStats = true,
  height = 120
}: DistributionChartProps) {
  const chart = useMemo(() => {
    if (values.length === 0) {
      return {
        bins: [] as Array<{ min: number; max: number; count: number }>,
        min: 0,
        max: 0,
        mean: 0,
        median: 0
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binWidth = range / bins;

    const binData: Array<{ min: number; max: number; count: number }> = Array.from({ length: bins }, (_, i) => ({
      min: min + i * binWidth,
      max: min + (i + 1) * binWidth,
      count: 0
    }));

    values.forEach((value) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        bins - 1
      );
      binData[binIndex].count++;
    });

    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

    return {
      bins: binData,
      min,
      max,
      mean,
      median
    };
  }, [values, bins]);

  const maxCount = Math.max(...chart.bins.map((b) => b.count), 1);
  const paddingX = 40;
  const paddingY = showStats ? 30 : 10;
  const usableWidth = 300 - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  if (values.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-slate-400">
        No data
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium text-slate-700">{label}</div>
      )}
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 300 ${height}`} className="overflow-visible">
          {/* Bars */}
          {chart.bins.map((bin, index) => {
            const barWidth = usableWidth / chart.bins.length;
            const x = paddingX + index * barWidth;
            const barHeight = (bin.count / maxCount) * usableHeight;
            const y = paddingY + usableHeight - barHeight;

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth * 0.9}
                height={barHeight}
                fill="#0284c7"
                fillOpacity="0.6"
                className="transition-opacity hover:opacity-100"
              />
            );
          })}

          {/* Mean line */}
          {showStats && (
            <line
              x1={paddingX + ((chart.mean - chart.min) / (chart.max - chart.min || 1)) * usableWidth}
              y1={paddingY}
              x2={paddingX + ((chart.mean - chart.min) / (chart.max - chart.min || 1)) * usableWidth}
              y2={paddingY + usableHeight}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* Median line */}
          {showStats && (
            <line
              x1={paddingX + ((chart.median - chart.min) / (chart.max - chart.min || 1)) * usableWidth}
              y1={paddingY}
              x2={paddingX + ((chart.median - chart.min) / (chart.max - chart.min || 1)) * usableWidth}
              y2={paddingY + usableHeight}
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* X-axis labels */}
          <text
            x={paddingX}
            y={height - 4}
            className="text-[9px] fill-slate-500"
            textAnchor="middle"
          >
            {chart.min.toFixed(1)}
          </text>
          <text
            x={paddingX + usableWidth}
            y={height - 4}
            className="text-[9px] fill-slate-500"
            textAnchor="middle"
          >
            {chart.max.toFixed(1)}
          </text>
        </svg>

        {/* Stats overlay */}
        {showStats && (
          <div className="absolute top-2 right-2 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Mean: {chart.mean.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> Median: {chart.median.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

