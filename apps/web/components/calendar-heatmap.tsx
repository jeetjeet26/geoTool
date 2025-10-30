'use client';

import { useMemo } from 'react';

type CalendarHeatmapProps = {
  data: Array<{ date: Date | string; value: number; label?: string }>;
  days?: number;
  colorScheme?: 'blue' | 'green' | 'red';
};

export default function CalendarHeatmap({
  data,
  days = 90,
  colorScheme = 'blue'
}: CalendarHeatmapProps) {
  const chart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateMap = new Map<string, { value: number; label?: string }>();
    data.forEach((item) => {
      const date = item.date instanceof Date ? item.date : new Date(item.date);
      const key = date.toISOString().split('T')[0];
      dateMap.set(key, { value: item.value, label: item.label });
    });

    const squares: Array<{
      date: Date;
      value: number | null;
      label?: string;
      intensity: number;
    }> = [];

    const maxValue = Math.max(...data.map((d) => d.value), 1);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const entry = dateMap.get(key);

      squares.push({
        date,
        value: entry?.value ?? null,
        label: entry?.label,
        intensity: entry ? entry.value / maxValue : 0
      });
    }

    return { squares, maxValue };
  }, [data, days]);

  const getColor = (intensity: number) => {
    if (intensity === 0) return '#f1f5f9';
    const colors = {
      blue: ['#dbeafe', '#93c5fd', '#3b82f6', '#1e40af'],
      green: ['#dcfce7', '#86efac', '#22c55e', '#15803d'],
      red: ['#fee2e2', '#fca5a5', '#ef4444', '#b91c1c']
    };
    const scheme = colors[colorScheme];
    if (intensity < 0.33) return scheme[0];
    if (intensity < 0.66) return scheme[1];
    if (intensity < 0.9) return scheme[2];
    return scheme[3];
  };

  const weeks = Math.ceil(chart.squares.length / 7);
  const cellSize = 12;
  const gap = 2;

  return (
    <div className="space-y-2">
      <svg width={weeks * (cellSize + gap)} height={7 * (cellSize + gap)} className="overflow-visible">
        {chart.squares.map((square, index) => {
          const week = Math.floor(index / 7);
          const day = index % 7;
          const x = week * (cellSize + gap);
          const y = day * (cellSize + gap);

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={getColor(square.intensity)}
              stroke="#ffffff"
              strokeWidth="1"
              rx="2"
              className="transition-opacity hover:opacity-80"
            >
              <title>
                {square.label
                  ? `${square.date.toLocaleDateString()}: ${square.label} (${square.value})`
                  : `${square.date.toLocaleDateString()}: ${square.value ?? 0}`}
              </title>
            </rect>
          );
        })}

        {/* Day labels */}
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <text
            key={index}
            x={-8}
            y={index * (cellSize + gap) + cellSize / 2 + 4}
            className="text-[9px] fill-slate-500"
            textAnchor="end"
          >
            {day}
          </text>
        ))}
      </svg>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{days} days ago</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0, 0.33, 0.66, 0.9].map((intensity) => (
              <div
                key={intensity}
                className="h-3 w-3 rounded"
                style={{ backgroundColor: getColor(intensity) }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

