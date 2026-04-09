// ABOUTME: Lightweight SVG line chart for snapshot value history.
// ABOUTME: No external chart library — pure SVG with hover tooltips.

import { useState, useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  tooltip?: string;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  unit?: string;
  emptyMessage?: string;
}

export function LineChart({
  data,
  width = 500,
  height = 200,
  color = '#AF6025',
  unit = '',
  emptyMessage = 'No data yet',
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { path, points, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', points: [], yTicks: [] };
    }

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;
    const paddedRange = paddedMax - paddedMin;

    const pts = data.map((d, i) => ({
      x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
      y: padding.top + chartH - ((d.value - paddedMin) / paddedRange) * chartH,
    }));

    const pathD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const val = paddedMin + (paddedRange * i) / (tickCount - 1);
      const y = padding.top + chartH - ((val - paddedMin) / paddedRange) * chartH;
      return { value: val, y };
    });

    return { path: pathD, points: pts, yTicks: ticks };
  }, [data, chartW, chartH, padding.left, padding.top]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-poe-text-muted"
        style={{ width, height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className="select-none"
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="rgba(42,42,62,0.4)"
            strokeDasharray="4 4"
          />
          <text
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-poe-text-muted"
            fontSize={10}
          >
            {tick.value.toFixed(1)}{unit}
          </text>
        </g>
      ))}

      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

      {/* Area fill */}
      {points.length > 1 && (
        <path
          d={`${path} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`}
          fill={color}
          fillOpacity={0.08}
        />
      )}

      {/* Data points + hover zones */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={hoveredIndex === i ? '#FFD700' : color}
            stroke={hoveredIndex === i ? color : 'none'}
            strokeWidth={2}
            className="transition-all duration-100"
          />
          {/* Invisible hover target */}
          <rect
            x={p.x - 15}
            y={padding.top}
            width={30}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
          {/* X-axis label */}
          <text
            x={p.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-poe-text-muted"
            fontSize={9}
          >
            {data[i].label}
          </text>
        </g>
      ))}

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <g>
          <rect
            x={Math.min(points[hoveredIndex].x - 40, width - padding.right - 80)}
            y={points[hoveredIndex].y - 30}
            width={80}
            height={22}
            rx={3}
            fill="#1A1A2E"
            stroke="rgba(42,42,62,0.6)"
          />
          <text
            x={Math.min(points[hoveredIndex].x, width - padding.right - 40)}
            y={points[hoveredIndex].y - 15}
            textAnchor="middle"
            className="fill-poe-currency"
            fontSize={11}
            fontWeight={500}
          >
            {data[hoveredIndex].tooltip ?? `${data[hoveredIndex].value.toFixed(1)}${unit}`}
          </text>
        </g>
      )}
    </svg>
  );
}
