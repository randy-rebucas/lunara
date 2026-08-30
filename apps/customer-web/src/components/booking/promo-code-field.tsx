'use client';

import { Button } from '@lunara/ui';

interface PromoCodeFieldProps {
  value: string;
  appliedCode?: string;
  appliedTitle?: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  onApply: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}

export function PromoCodeField({
  value,
  appliedCode,
  appliedTitle,
  loading = false,
  onValueChange,
  onApply,
  onRemove,
}: PromoCodeFieldProps) {
  const isApplied = Boolean(appliedCode);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900">Promo code</p>
        <p className="mt-0.5 text-xs text-muted">Apply a code from Deals or a friend referral.</p>
      </div>
      {isApplied ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="font-semibold text-primary">{appliedCode}</p>
            {appliedTitle ? <p className="text-xs text-muted">{appliedTitle}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void onRemove()} disabled={loading}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME10"
            className="input-field min-w-0 flex-1 uppercase tracking-wide"
            aria-label="Promo code"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onApply()}
            disabled={loading || !value.trim()}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
