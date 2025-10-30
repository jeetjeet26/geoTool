'use client';

import { useMemo } from 'react';

type DataPoint = {
  x: number;
  y: number;
  label?: string;
  size?: number;
  color?: string;
};

type CorrelationScatterProps = {
  data: DataPoint[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  showTrendline?: boolean;
};

export default function CorrelationScatter({
  data,
  xLabel,
  yLabel,
  width = 400,
  height = 300,
  showTrendline = true
}: CorrelationScatterProps) {
  const chart = useMemo(() => {
    if (data.length === 0) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        points: [] as Array<{ x: number; y: number; original: DataPoint }>,
        trendline: null as { slope: number; intercept: number } | null
      };
    }

    const xValues = data.map((d) => d.x);
    const yValues = data.map((d) => d.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    const points = data.map((point) => ({
      x: point.x,
      y: point.y,
      original: point
    }));

    // Simple linear regression for trendline
    let trendline: { slope: number; intercept: number } | null = null;
    if (showTrendline && data.length > 1) {
      const n = data.length;
      const sumX = xValues.reduce((a, b) => a + b, 0);
      const sumY = yValues.reduce((a, b) => a + b, 0);
      const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
      const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      trendline = { slope, intercept };
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      xRange,
      yRange,
      points,
      trendline
    };
  }, [data, showTrendline]);

  const paddingX = 50;
  const paddingY = 40;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-slate-400">
        No data
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <g key={pct}>
            <line
              x1={paddingX}
              y1={paddingY + pct * usableHeight}
              x2={paddingX + usableWidth}
              y2={paddingY + pct * usableHeight}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <line
              x1={paddingX + pct * usableWidth}
              y1={paddingY}
              x2={paddingX + pct * usableWidth}
              y2={paddingY + usableHeight}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Trendline */}
        {chart.trendline && chart.yRange && (
          <line
            x1={paddingX}
            y1={paddingY + usableHeight - ((chart.trendline.slope * chart.minX + chart.trendline.intercept - chart.minY) / chart.yRange) * usableHeight}
            x2={paddingX + usableWidth}
            y2={paddingY + usableHeight - ((chart.trendline.slope * chart.maxX + chart.trendline.intercept - chart.minY) / chart.yRange) * usableHeight}
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity="0.6"
          />
        )}

        {/* Data points */}
        {chart.xRange && chart.yRange && chart.points.map((point, index) => {
          const x = paddingX + ((point.x - chart.minX) / chart.xRange) * usableWidth;
          const y = paddingY + usableHeight - ((point.y - chart.minY) / chart.yRange) * usableHeight;
          const size = point.original.size ?? 4;
          const color = point.original.color ?? '#0284c7';

          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={size}
              fill={color}
              fillOpacity="0.7"
              stroke="white"
              strokeWidth="1"
              className="transition-all hover:r-6 hover:opacity-100"
            >
              {point.original.label && (
                <title>{point.original.label}</title>
              )}
            </circle>
          );
        })}

        {/* Axes */}
        <line
          x1={paddingX}
          y1={paddingY}
          x2={paddingX}
          y2={paddingY + usableHeight}
          stroke="#64748b"
          strokeWidth="2"
        />
        <line
          x1={paddingX}
          y1={paddingY + usableHeight}
          x2={paddingX + usableWidth}
          y2={paddingY + usableHeight}
          stroke="#64748b"
          strokeWidth="2"
        />

        {/* Labels */}
        <text
          x={paddingX + usableWidth / 2}
          y={height - 8}
          className="text-xs fill-slate-600"
          textAnchor="middle"
        >
          {xLabel}
        </text>
        <text
          x={12}
          y={paddingY + usableHeight / 2}
          className="text-xs fill-slate-600"
          textAnchor="middle"
          transform={`rotate(-90, 12, ${paddingY + usableHeight / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

