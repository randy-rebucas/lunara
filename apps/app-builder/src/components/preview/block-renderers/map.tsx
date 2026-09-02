import type { MapProps } from '@lunara/blocks';

export function MapPreview({ title, address }: MapProps) {
  return (
    <div className="rounded-lg bg-muted/20 p-2">
      {title ? <p className="text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <p className="mt-0.5 truncate text-[8px] text-muted">{address || 'No address set'}</p>
    </div>
  );
}
