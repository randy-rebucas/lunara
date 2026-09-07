/**
 * Shared tone → className map for colored stat tiles across datacenter boards.
 * Extracted from the ~16 board files that previously each redefined this
 * identical constant locally.
 *
 * Note: `live-tracking-board.tsx` intentionally keeps its own local variant
 * (it adds `text-*` classes to each tone) and should NOT be migrated here.
 */
export const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

/**
 * Shared shape for the status-pill / "system state" copy blocks repeated
 * across several boards (e.g. `opsCopy`, `promoCopy`, `pipelineCopy`).
 * Each board keeps its own states/labels/content — only the shape is shared.
 */
export interface StatusPillConfig {
  label: string;
  detail: string;
  dot: string;
  bar: string;
}

export type StatusPillCopy<State extends string> = Record<State, StatusPillConfig>;
