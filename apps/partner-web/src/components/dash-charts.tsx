'use client';

/**
 * Dependency-free SVG chart primitives for the partner dashboard.
 * Colors come from Lunara design tokens (CSS vars) so tenant branding applies.
 * Pattern mirrors apps/admin-web/src/components/datacenter/dash-charts.tsx.
 */

import { formatChartDay, formatPeso } from '../lib/format-peso';

const VIEW_W = 480;
const VIEW_H = 200;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(value));
  const scaled = value / mag;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * mag;
}

export function RevenueLineChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = niceMax(Math.max(1, ...data.map((d) => d.revenue)));
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const points = data.map((d, i) => `${x(i)},${y(d.revenue)}`).join(' ');
  const areaPoints = `${PAD_L},${PAD_T + innerH} ${points} ${VIEW_W - PAD_R},${PAD_T + innerH}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Revenue per day over the last ${data.length} days. Peak ${formatPeso(max, true)}.`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={y(t)}
            y2={y(t)}
            stroke="#e2e8f0"
            strokeWidth={1}
            strokeDasharray={t === 0 ? undefined : '3 4'}
          />
          <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
            {formatPeso(t, true)}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={d.date} x={x(i)} y={VIEW_H - 6} textAnchor="middle" fontSize={10} fill="#94a3b8">
          {formatChartDay(d.date)}
        </text>
      ))}
      <polygon points={areaPoints} fill="var(--color-primary)" opacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.revenue)} r={3} fill="var(--color-primary)">
          <title>{`${formatChartDay(d.date)} — ${formatPeso(d.revenue)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export interface DonutSegment {
  key: string;
  label: string;
  count: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <svg
      viewBox="0 0 140 140"
      className="mx-auto h-auto w-full max-w-[180px]"
      role="img"
      aria-label={`${centerLabel}: ${centerValue}. ${segments.map((s) => `${s.label} ${s.count}`).join(', ')}.`}
    >
      <circle cx={70} cy={70} r={R} fill="none" stroke="#f1f5f9" strokeWidth={16} />
      {total > 0
        ? segments
            .filter((s) => s.count > 0)
            .map((s) => {
              const frac = s.count / total;
              const el = (
                <circle
                  key={s.key}
                  cx={70}
                  cy={70}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={16}
                  strokeDasharray={`${frac * C} ${C}`}
                  strokeDashoffset={-offset * C}
                  transform="rotate(-90 70 70)"
                >
                  <title>{`${s.label}: ${s.count} (${Math.round(frac * 100)}%)`}</title>
                </circle>
              );
              offset += frac;
              return el;
            })
        : null}
      <text x={70} y={66} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">
        {centerValue}
      </text>
      <text x={70} y={82} textAnchor="middle" fontSize={10} fill="#64748b">
        {centerLabel}
      </text>
    </svg>
  );
}

const DONUT_COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-secondary)', '#f59e0b', '#94a3b8'];

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  return (
    <ul className="space-y-1.5">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-slate-700">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.label}</span>
          </span>
          <span className="shrink-0 font-medium text-slate-900">
            {total > 0 ? Math.round((s.count / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function withDonutColors(services: { key: string; label: string; count: number }[]): DonutSegment[] {
  return services.map((s, i) => ({ ...s, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
}
