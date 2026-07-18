'use client';

/**
 * Dependency-free SVG chart primitives for the admin overview dashboard.
 * Colors come from Lunara design tokens (CSS vars) so tenant branding applies.
 */

import { formatChartDay, formatPeso } from '../../lib/format-peso';

export interface TrendPoint {
  date: string;
  created: number;
  completed: number;
  cancelled: number;
}

const TREND_SERIES = [
  { key: 'created', label: 'Total orders', color: 'var(--color-primary)' },
  { key: 'completed', label: 'Completed', color: 'var(--color-accent)' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
] as const;

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(value));
  const scaled = value / mag;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * mag;
}

export function TrendLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {TREND_SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: s.color }}
            aria-hidden
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.created, d.completed, d.cancelled))));
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Orders per day over the last ${data.length} days. Peak ${Math.max(...data.map((d) => d.created))} orders.`}
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
            {t}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={d.date} x={x(i)} y={VIEW_H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
          {formatChartDay(d.date)}
        </text>
      ))}
      {TREND_SERIES.map((s) => (
        <polyline
          key={s.key}
          points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {data.map((d, i) =>
        TREND_SERIES.map((s) => (
          <circle key={`${d.date}-${s.key}`} cx={x(i)} cy={y(d[s.key])} r={3} fill={s.color}>
            <title>{`${formatChartDay(d.date)} — ${s.label}: ${d[s.key]}`}</title>
          </circle>
        )),
      )}
    </svg>
  );
}

export interface CompareSeries {
  label: string;
  color: string;
  dashed?: boolean;
  values: number[];
}

/** Generic multi-series line chart with arbitrary x labels (e.g. hours of day). */
export function CompareLineChart({
  labels,
  series,
  formatValue = (n) => String(n),
  labelEvery = 4,
  ariaLabel,
}: {
  labels: string[];
  series: CompareSeries[];
  formatValue?: (value: number) => string;
  labelEvery?: number;
  ariaLabel?: string;
}) {
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const n = labels.length;
  const x = (i: number) => PAD_L + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => max * f);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel ?? `${series.map((s) => s.label).join(' vs ')} across ${n} points`}
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
          <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
            {formatValue(t)}
          </text>
        </g>
      ))}
      {labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text key={label + i} x={x(i)} y={VIEW_H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {label}
          </text>
        ) : null,
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray={s.dashed ? '5 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {series.map((s) =>
        s.values.map((v, i) =>
          v > 0 ? (
            <circle key={`${s.label}-${i}`} cx={x(i)} cy={y(v)} r={2.5} fill={s.color}>
              <title>{`${labels[i]} — ${s.label}: ${formatValue(v)}`}</title>
            </circle>
          ) : null,
        ),
      )}
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

export function RevenueBarChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const slot = innerW / data.length;
  const barW = Math.min(34, slot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Revenue per day over the last ${data.length} days. Peak ${formatPeso(max, true)}.`}
    >
      {[0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={PAD_T + innerH - f * innerH}
            y2={PAD_T + innerH - f * innerH}
            stroke="#e2e8f0"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <text
            x={PAD_L - 6}
            y={PAD_T + innerH - f * innerH + 3}
            textAnchor="end"
            fontSize={9}
            fill="#94a3b8"
          >
            {formatPeso(max * f, true)}
          </text>
        </g>
      ))}
      <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="#e2e8f0" />
      {data.map((d, i) => {
        const h = (d.revenue / max) * innerH;
        const cx = PAD_L + slot * i + slot / 2;
        return (
          <g key={d.date}>
            <rect
              x={cx - barW / 2}
              y={PAD_T + innerH - h}
              width={barW}
              height={Math.max(h, d.revenue > 0 ? 2 : 0)}
              rx={4}
              fill="var(--color-primary)"
              opacity={0.85}
            >
              <title>{`${formatChartDay(d.date)}: ${formatPeso(d.revenue)}`}</title>
            </rect>
            <text x={cx} y={VIEW_H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
              {formatChartDay(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
