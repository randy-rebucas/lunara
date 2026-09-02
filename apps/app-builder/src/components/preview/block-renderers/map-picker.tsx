import type { MapPickerProps } from '@lunara/blocks';

export function MapPickerPreview({ mode, centerLabel, markerLabel }: MapPickerProps) {
  return (
    <div className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-muted/40 ring-1 ring-border/60">
      <p className="text-[9px] font-semibold text-slate-900">📍 {markerLabel ?? 'Location'}</p>
      {centerLabel ? <p className="text-[7px] text-muted">{centerLabel}</p> : null}
      <p className="text-[7px] uppercase text-muted">{mode}</p>
    </div>
  );
}
