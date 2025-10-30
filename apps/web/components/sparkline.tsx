'use client';

import { useMemo } from 'react';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  showArea?: boolean;
};

export default function Sparkline({
  values,
  width = 60,
  height = 20,
  strokeColor = '#1f2937',
  showArea = false
}: SparklineProps) {
  const path = useMemo(() => {
    if (values.length === 0) return '';
    if (values.length === 1) {
      const y = height / 2;
      return `M 0,${y} L ${width},${y}`;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 2;

    const points = values.map((value, index) => {
      const x = padding + ((width - padding * 2) / (values.length - 1)) * index;
      const normalized = (value - min) / range;
      const y = height - padding - normalized * (height - padding * 2);
      return `${x},${y}`;
    });

    return points.join(' ');
  }, [values, width, height]);

  const areaPath = useMemo(() => {
    if (!showArea || path === '' || values.length === 0) return '';
    const coords = path.split(' ').map((p) => p.split(',').map(Number));
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (!first || !last) return '';
    return `${path} L ${last[0]},${height} L ${first[0]},${height} Z`;
  }, [path, height, showArea, values.length]);

  if (values.length === 0) {
    return (
      <div className="flex h-5 items-center justify-center text-xs text-slate-400">—</div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Trend sparkline">
      {showArea && areaPath && (
        <path
          d={areaPath}
          fill={strokeColor}
          fillOpacity="0.1"
          stroke="none"
        />
      )}
      <polyline
        points={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

