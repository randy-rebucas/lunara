interface Node {
  icon: string;
  label: string;
  x: number;
  y: number;
}

// 5 nodes evenly spaced in a circle around the center (percent coordinates on a 0-100 canvas).
const NODES: Node[] = [
  { icon: '/images/icons/operations.png', label: 'Operations', x: 50, y: 6 },
  { icon: '/images/icons/customer-support.png', label: 'Customers', x: 91.4, y: 34 },
  { icon: '/images/icons/partner.png', label: 'Partners', x: 75.8, y: 89 },
  { icon: '/images/icons/dispatcher.png', label: 'Dispatch', x: 24.2, y: 89 },
  { icon: '/images/icons/finance.png', label: 'Finance', x: 8.6, y: 34 },
];

export function AuroraOrb() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px] py-4">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(165,180,252,0.15)" strokeWidth="0.4" />
        {NODES.map((node) => (
          <line
            key={node.label}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="rgba(165,180,252,0.25)"
            strokeWidth="0.5"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 -m-10 animate-ping rounded-full bg-indigo-500/10 [animation-duration:2.5s]" />
        <span className="absolute inset-0 -m-5 rounded-full bg-indigo-500/10" />
        <span className="absolute inset-0 -m-1 rounded-full ring-1 ring-indigo-400/30" />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative hero graphic, not a routed asset */}
        <img
          src="/images/avatars/aurora.png"
          alt=""
          aria-hidden
          className="relative h-28 w-28 rounded-full shadow-lg shadow-indigo-500/40"
        />
      </div>

      {NODES.map(({ icon, label, x, y }) => (
        <div
          key={label}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/60 p-2 ring-1 ring-indigo-400/25 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative hero graphic, not a routed asset */}
            <img src={icon} alt="" aria-hidden className="h-full w-full object-contain" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
