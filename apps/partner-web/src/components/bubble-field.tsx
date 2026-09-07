'use client';

export interface Bubble {
  left: string;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

/** Rising soap-bubble field used behind the dark brand panel and light form panel on the
 * login and signup screens — shared so both surfaces stay visually identical. */
export const DARK_PANEL_BUBBLES: readonly Bubble[] = [
  { left: '4%', size: 24, duration: 16, delay: 0, drift: 16 },
  { left: '14%', size: 46, duration: 22, delay: 3, drift: -18 },
  { left: '26%', size: 16, duration: 12, delay: 6, drift: 12 },
  { left: '36%', size: 60, duration: 26, delay: 1, drift: 24 },
  { left: '48%', size: 20, duration: 14, delay: 8, drift: -14 },
  { left: '58%', size: 38, duration: 20, delay: 4, drift: 18 },
  { left: '70%', size: 14, duration: 11, delay: 2, drift: -10 },
  { left: '80%', size: 52, duration: 24, delay: 7, drift: 20 },
  { left: '90%', size: 22, duration: 15, delay: 5, drift: -16 },
];

export const LIGHT_PANEL_BUBBLES: readonly Bubble[] = [
  { left: '3%', size: 20, duration: 17, delay: 1, drift: 12 },
  { left: '15%', size: 40, duration: 23, delay: 5, drift: -16 },
  { left: '30%', size: 14, duration: 12, delay: 8, drift: 10 },
  { left: '44%', size: 50, duration: 25, delay: 2, drift: 20 },
  { left: '58%', size: 18, duration: 14, delay: 6, drift: -12 },
  { left: '70%', size: 34, duration: 19, delay: 0, drift: 16 },
  { left: '84%', size: 16, duration: 13, delay: 4, drift: -10 },
  { left: '94%', size: 44, duration: 21, delay: 7, drift: 18 },
];

export function BubbleField({ bubbles, className }: { bubbles: readonly Bubble[]; className: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className={className}
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            ['--bubble-drift' as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
