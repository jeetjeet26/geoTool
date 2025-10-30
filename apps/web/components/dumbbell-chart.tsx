'use client';

import { useMemo, useState } from 'react';

type DumbbellPoint = {
  id: string;
  label: string;
  fullLabel?: string; // Full text for tooltips
  left: number;
  right: number;
  leftLabel?: string;
  rightLabel?: string;
};

type DumbbellChartProps = {
  data: DumbbellPoint[];
  leftLabel: string;
  rightLabel: string;
  height?: number;
  showValues?: boolean;
  sortBy?: 'none' | 'left' | 'right' | 'delta' | 'label';
};

export default function DumbbellChart({
  data,
  leftLabel,
  rightLabel,
  height = 300,
  showValues = true,
  sortBy: initialSortBy = 'delta'
}: DumbbellChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'none' | 'left' | 'right' | 'delta' | 'label'>(initialSortBy);

  const sortedData = useMemo(() => {
    if (sortBy === 'none') return data;
    
    const sorted = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'left':
          return b.left - a.left;
        case 'right':
          return b.right - a.right;
        case 'delta':
          return (b.right - b.left) - (a.right - a.left);
        case 'label':
          return a.label.localeCompare(b.label);
        default:
          return 0;
      }
    });
    return sorted;
  }, [data, sortBy]);

  // Calculate proper dimensions
  const svgWidth = 800;
  const labelWidth = 280; // Space for labels on left
  const chartAreaStart = labelWidth + 20;
  const chartAreaWidth = svgWidth - chartAreaStart - 80;
  const paddingTop = 40;
  const paddingBottom = 50;
  const minRowHeight = 32; // Minimum spacing between rows
  const calculatedHeight = Math.max(height, sortedData.length * minRowHeight + paddingTop + paddingBottom);
  const rowHeight = (calculatedHeight - paddingTop - paddingBottom) / Math.max(sortedData.length, 1);

  const chart = useMemo(() => {
    if (sortedData.length === 0) {
      return {
        min: 0,
        max: 0,
        points: [] as Array<DumbbellPoint & { leftX: number; rightX: number; y: number; delta: number }>
      };
    }

    const allValues = [...sortedData.map((d) => d.left), ...sortedData.map((d) => d.right)];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const points = sortedData.map((point, index) => {
      const leftX = chartAreaStart + ((point.left - min) / range) * chartAreaWidth;
      const rightX = chartAreaStart + ((point.right - min) / range) * chartAreaWidth;
      const y = paddingTop + index * rowHeight + rowHeight / 2;
      const delta = point.right - point.left;

      return {
        ...point,
        leftX,
        rightX,
        y,
        delta
      };
    });

    return { min, max, points };
  }, [sortedData, chartAreaStart, chartAreaWidth, rowHeight]);

  // Smart truncation: try to break at word boundaries
  const truncateLabel = (text: string, maxLength: number = 35): string => {
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  };

  if (sortedData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-slate-400">
        No data
      </div>
    );
  }

  const hoveredPoint = chart.points.find((p) => p.id === hoveredId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">{leftLabel}</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
            }}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <option value="delta">Sort by delta</option>
            <option value="left">Sort by {leftLabel}</option>
            <option value="right">Sort by {rightLabel}</option>
            <option value="label">Sort by name</option>
            <option value="none">No sort</option>
          </select>
        </div>
        <span className="text-xs font-medium text-slate-600">{rightLabel}</span>
      </div>
      <div className="relative overflow-x-auto">
        <svg width={svgWidth} height={calculatedHeight} viewBox={`0 0 ${svgWidth} ${calculatedHeight}`} className="overflow-visible">
          {/* X-axis label */}
          <text x={svgWidth / 2} y={calculatedHeight - 10} className="text-xs fill-slate-600 font-medium" textAnchor="middle">
            Score
          </text>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const x = chartAreaStart + pct * chartAreaWidth;
            return (
              <line
                key={pct}
                x1={x}
                y1={paddingTop - 10}
                x2={x}
                y2={calculatedHeight - paddingBottom}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={pct === 0 || pct === 1 ? '0' : '2 2'}
              />
            );
          })}

          {/* Dumbbell lines and dots */}
          {chart.points.map((point) => {
            const isPositive = point.right > point.left;
            const color = isPositive ? '#10b981' : point.right < point.left ? '#ef4444' : '#64748b';
            const isHovered = hoveredId === point.id;

            return (
              <g
                key={point.id}
                onMouseEnter={() => setHoveredId(point.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                {/* Connecting line */}
                <line
                  x1={point.leftX}
                  y1={point.y}
                  x2={point.rightX}
                  y2={point.y}
                  stroke={color}
                  strokeWidth={isHovered ? '3' : '2'}
                  opacity={isHovered ? '0.5' : '0.3'}
                />

                {/* Left dot */}
                <circle
                  cx={point.leftX}
                  cy={point.y}
                  r={isHovered ? '8' : '6'}
                  fill="#64748b"
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* Right dot */}
                <circle
                  cx={point.rightX}
                  cy={point.y}
                  r={isHovered ? '8' : '6'}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all"
                />

                {/* Label - use text element with proper clipping */}
                <text
                  x={10}
                  y={point.y + 4}
                  className={`text-xs fill-slate-700 ${isHovered ? 'font-semibold' : ''}`}
                  textAnchor="start"
                  style={{ fontSize: '11px' }}
                >
                  {truncateLabel(point.label, 35)}
                </text>

                {/* Values */}
                {showValues && (
                  <>
                    <text
                      x={point.leftX}
                      y={point.y - 14}
                      className={`text-[10px] fill-slate-600 ${isHovered ? 'font-semibold' : ''}`}
                      textAnchor="middle"
                    >
                      {point.leftLabel ?? point.left.toFixed(1)}
                    </text>
                    <text
                      x={point.rightX}
                      y={point.y - 14}
                      className={`text-[10px] fill-slate-600 font-semibold ${isHovered ? 'text-xs' : ''}`}
                      textAnchor="middle"
                    >
                      {point.rightLabel ?? point.right.toFixed(1)}
                    </text>
                    {/* Delta indicator */}
                    {isHovered && (
                      <text
                        x={(point.leftX + point.rightX) / 2}
                        y={point.y + 20}
                        className="text-[9px] fill-slate-500 font-medium"
                        textAnchor="middle"
                      >
                        Δ {point.delta > 0 ? '+' : ''}{point.delta.toFixed(1)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Scale labels */}
          <text x={chartAreaStart} y={calculatedHeight - 20} className="text-[10px] fill-slate-500" textAnchor="middle">
            {chart.min.toFixed(1)}
          </text>
          <text x={chartAreaStart + chartAreaWidth} y={calculatedHeight - 20} className="text-[10px] fill-slate-500" textAnchor="middle">
            {chart.max.toFixed(1)}
          </text>
        </svg>

        {/* HTML Tooltip for better positioning */}
        {hoveredPoint && (hoveredPoint.fullLabel || hoveredPoint.label.length > 35) && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-neutral-200 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${(hoveredPoint.leftX / svgWidth) * 100}%`,
              top: `${hoveredPoint.y - 30}px`,
              transform: 'translateX(-50%)',
              maxWidth: '300px'
            }}
          >
            <div className="font-medium mb-1">{hoveredPoint.fullLabel || hoveredPoint.label}</div>
            <div className="text-[10px] text-slate-300">
              {leftLabel}: {hoveredPoint.leftLabel ?? hoveredPoint.left.toFixed(1)} → {rightLabel}: {hoveredPoint.rightLabel ?? hoveredPoint.right.toFixed(1)}
              {hoveredPoint.delta !== 0 && (
                <span className={`ml-2 ${hoveredPoint.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({hoveredPoint.delta > 0 ? '+' : ''}{hoveredPoint.delta.toFixed(1)})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

