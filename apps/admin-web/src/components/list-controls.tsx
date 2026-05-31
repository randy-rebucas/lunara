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
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  limit: number;
  onLimitChange: (value: number) => void;
  limitOptions?: number[];
  total: number;
  filtered: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-4">
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
