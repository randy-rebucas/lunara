import type { TileGridProps } from '@lunara/blocks';

export function TileGridPreview({ title, columns = 4, tiles }: TileGridProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => (
          <div key={tile.id} className="rounded-lg bg-surface p-1.5 text-center ring-1 ring-border/60">
            <p className="truncate text-[7px] font-semibold text-slate-800">{tile.label}</p>
            {tile.value ? <p className="text-[8px] font-bold text-primary">{tile.value}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
