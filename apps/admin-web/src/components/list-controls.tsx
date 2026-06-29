'use client';

export function ListControls({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  limit,
  onLimitChange,
  limitOptions = [25, 50, 100],
  total,
  filtered,
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = 'Status',
  filter2Value,
  onFilter2Change,
  filter2Options,
  filter2Label = 'Type',
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  limit: number;
  onLimitChange: (value: number) => void;
  limitOptions?: number[];
  total: number;
  filtered: number;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: { value: string; label: string; count?: number }[];
  filterLabel?: string;
  filter2Value?: string;
  onFilter2Change?: (value: string) => void;
  filter2Options?: { value: string; label: string; count?: number }[];
  filter2Label?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      {filterOptions && onFilterChange ? (
        <div>
          <label htmlFor="list-filter" className="form-label">
            {filterLabel}
          </label>
          <select
            id="list-filter"
            className="input-field"
            value={filterValue ?? ''}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}{opt.count != null ? ` (${opt.count})` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {filter2Options && onFilter2Change ? (
        <div>
          <label htmlFor="list-filter2" className="form-label">
            {filter2Label}
          </label>
          <select
            id="list-filter2"
            className="input-field"
            value={filter2Value ?? ''}
            onChange={(e) => onFilter2Change(e.target.value)}
          >
            {filter2Options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}{opt.count != null ? ` (${opt.count})` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="list-search" className="form-label">
          Search
        </label>
        <input
          id="list-search"
          type="search"
          className="input-field w-full"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="list-limit" className="form-label">
          Show
        </label>
        <select
          id="list-limit"
          className="input-field"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {limitOptions.map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
      </div>
      <p className="pb-2 text-sm text-muted">
        Showing {filtered} of {total}
      </p>
    </div>
  );
}

export function filterBySearch<T>(
  items: T[],
  search: string,
  fields: ((item: T) => string | undefined)[],
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    fields.some((field) => (field(item) ?? '').toLowerCase().includes(q)),
  );
}
