import type { FilterChipListProps } from '@lunara/blocks';

export function FilterChipListPreview({ options, selectedId }: FilterChipListProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <span
          key={option.id}
          className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
            option.id === selectedId ? 'bg-primary text-white' : 'bg-surface text-slate-700 ring-1 ring-border/60'
          }`}
        >
          {option.label}
          {option.count != null ? ` (${option.count})` : ''}
        </span>
      ))}
    </div>
  );
}
