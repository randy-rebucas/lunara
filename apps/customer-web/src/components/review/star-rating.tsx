'use client';

export function StarRating({
  value,
  onChange,
  size = 'lg',
  readOnly = false,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'md' | 'lg';
  readOnly?: boolean;
}) {
  const starClass = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`${starClass} transition ${
            readOnly ? 'cursor-default' : 'hover:scale-110'
          } ${star <= value ? 'text-amber-400' : 'text-slate-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
