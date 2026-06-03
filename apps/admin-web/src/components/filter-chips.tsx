'use client';

import { formatSlugLabel } from '../lib/format-label';

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  formatLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  formatLabel?: (option: T) => string;
}) {
  const label = formatLabel ?? ((o: T) => (o ? formatSlugLabel(o) : 'All'));

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
      {options.map((option) => (
        <button
          key={option || 'all'}
          type="button"
          onClick={() => onChange(option)}
          className={`capitalize ${value === option ? 'filter-chip-active' : 'filter-chip'}`}
          aria-pressed={value === option}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}
