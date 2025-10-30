'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TrendPoint = {
  date: string;
  score: number;
  visibility: number;
};

type TrendChartProps = {
  points: TrendPoint[];
};

const DEFAULT_CHART_WIDTH = 560; // fallback before measuring
const CHART_HEIGHT = 180;
const PADDING_X = 32;
const PADDING_Y = 24;

function formatDateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function createPolyline(points: TrendPoint[], key: 'score' | 'visibility', chartWidth: number) {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => (key === 'score' ? point.score : point.visibility));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const usableWidth = chartWidth - PADDING_X * 2;
  const usableHeight = CHART_HEIGHT - PADDING_Y * 2;

  return points
    .map((point, index) => {
      const value = key === 'score' ? point.score : point.visibility;
      const normalized = (value - minValue) / valueRange;
      const x = PADDING_X + (usableWidth / Math.max(points.length - 1, 1)) * index;
      const y = CHART_HEIGHT - PADDING_Y - normalized * usableHeight;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function TrendChart({ points }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(DEFAULT_CHART_WIDTH);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) setChartWidth(width);
      }
    });
    observer.observe(element);
    // initial
    setChartWidth(element.clientWidth || DEFAULT_CHART_WIDTH);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    if (points.length === 0) {
      return {
        scoreLine: '',
        visibilityLine: '',
        labels: [] as { x: number; text: string }[],
        minScore: 0,
        maxScore: 0,
        minVisibility: 0,
        maxVisibility: 0
      };
    }

    const labels = points.map((point, index) => {
      const usableWidth = chartWidth - PADDING_X * 2;
      const x = PADDING_X + (usableWidth / Math.max(points.length - 1, 1)) * index;
      return {
        x,
        text: formatDateLabel(point.date)
      };
    });

    const scoreValues = points.map((point) => point.score);
    const visibilityValues = points.map((point) => point.visibility);

    return {
      scoreLine: createPolyline(points, 'score', chartWidth),
      visibilityLine: createPolyline(points, 'visibility', chartWidth),
      labels,
      minScore: Math.min(...scoreValues),
      maxScore: Math.max(...scoreValues),
      minVisibility: Math.min(...visibilityValues),
      maxVisibility: Math.max(...visibilityValues)
    };
  }, [points, chartWidth]);

  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-neutral-200">
        <p className="text-sm text-slate-500">Trend data will appear after at least two runs.</p>
      </div>
    );
  }

  const handleMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(x);
    // find nearest point index
    const usableWidth = chartWidth - PADDING_X * 2;
    const pct = Math.max(0, Math.min(1, (x - PADDING_X) / Math.max(1, usableWidth)));
    const idx = Math.round(pct * (Math.max(points.length - 1, 0)));
    setHoverIndex(points.length ? Math.max(0, Math.min(points.length - 1, idx)) : null);
  };

  const handleMouseLeave = () => {
    setHoverX(null);
    setHoverIndex(null);
  };

  const guidelineX = hoverIndex !== null
    ? (PADDING_X + ((chartWidth - PADDING_X * 2) / Math.max(points.length - 1, 1)) * hoverIndex)
    : null;

  return (
    <div ref={containerRef} className="relative">
      <svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
        role="img"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <title>Run trend chart showing score and visibility</title>
        <defs>
          <linearGradient id="score-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1f2937" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#1f2937" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="visibility-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g>
          <polyline
            points={chart.visibilityLine}
            fill="none"
            stroke="#0284c7"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={chart.scoreLine}
            fill="none"
            stroke="#111827"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {guidelineX !== null && (
          <line x1={guidelineX} y1={PADDING_Y - 6} x2={guidelineX} y2={CHART_HEIGHT - PADDING_Y + 6} stroke="#94a3b8" strokeDasharray="4 3" />
        )}

        {chart.labels.map((label) => (
          <text
            key={label.x}
            x={label.x}
            y={CHART_HEIGHT - 4}
            textAnchor="middle"
            className="text-[10px] fill-slate-500"
          >
            {label.text}
          </text>
        ))}
      </svg>

      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-neutral-200 bg-white/95 px-2 py-1 text-xs text-slate-700 shadow-md"
          style={{ left: guidelineX ?? 0, top: 8 }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium text-slate-900">{formatDateLabel(points[hoverIndex].date)}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-slate-900" /> {points[hoverIndex].score.toFixed(1)}
            <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" /> {points[hoverIndex].visibility.toFixed(1)}%
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-slate-900" /> Score {chart.minScore.toFixed(1)} –{' '}
          {chart.maxScore.toFixed(1)}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" /> Visibility {chart.minVisibility.toFixed(1)}% –{' '}
          {chart.maxVisibility.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}




