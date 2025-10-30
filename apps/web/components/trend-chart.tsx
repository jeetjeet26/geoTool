'use client';

import { useMemo } from 'react';

type TrendPoint = {
  date: string;
  score: number;
  visibility: number;
};

type TrendChartProps = {
  points: TrendPoint[];
};

const CHART_WIDTH = 560;
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

function createPolyline(points: TrendPoint[], key: 'score' | 'visibility') {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => (key === 'score' ? point.score : point.visibility));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const usableWidth = CHART_WIDTH - PADDING_X * 2;
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
      const usableWidth = CHART_WIDTH - PADDING_X * 2;
      const x = PADDING_X + (usableWidth / Math.max(points.length - 1, 1)) * index;
      return {
        x,
        text: formatDateLabel(point.date)
      };
    });

    const scoreValues = points.map((point) => point.score);
    const visibilityValues = points.map((point) => point.visibility);

    return {
      scoreLine: createPolyline(points, 'score'),
      visibilityLine: createPolyline(points, 'visibility'),
      labels,
      minScore: Math.min(...scoreValues),
      maxScore: Math.max(...scoreValues),
      minVisibility: Math.min(...visibilityValues),
      maxVisibility: Math.max(...visibilityValues)
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-neutral-200">
        <p className="text-sm text-slate-500">Trend data will appear after at least two runs.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg width={CHART_WIDTH} height={CHART_HEIGHT} role="img">
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




