import type { QuoteBreakdown } from '@lunara/utils';
import { formatCurrency } from '@lunara/utils';

function BreakdownRow({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${emphasis ? 'text-base font-bold' : 'text-sm'}`}
    >
      <dt className={emphasis ? 'text-slate-900' : 'text-muted'}>
        <span>{label}</span>
        {detail ? <span className="mt-0.5 block text-xs font-normal text-muted">{detail}</span> : null}
      </dt>
      <dd className={emphasis ? 'shrink-0 text-primary' : 'shrink-0 text-slate-900'}>{value}</dd>
    </div>
  );
}

interface QuoteBreakdownPanelProps {
  quote: QuoteBreakdown;
  showMinimumWarning?: boolean;
  totalLabel?: string;
}

export function QuoteBreakdownPanel({
  quote,
  showMinimumWarning = true,
  totalLabel = 'Estimated total',
}: QuoteBreakdownPanelProps) {
  return (
    <dl className="space-y-2">
      <BreakdownRow
        label={`${quote.serviceLabel} — ${quote.bagLabel} bag`}
        detail={`Up to ${quote.weightKg} kg`}
        value={formatCurrency(quote.serviceSubtotal)}
      />
      {quote.addons.map((addon) => (
        <BreakdownRow key={addon.id} label={addon.label} value={formatCurrency(addon.price)} />
      ))}
      <div className="border-t border-border/30 pt-2">
        <BreakdownRow label="Delivery fee" value={formatCurrency(quote.deliveryFee)} />
      </div>
      {quote.discount > 0 && (
        <BreakdownRow
          label={quote.promotionTitle ? `Discount — ${quote.promotionTitle}` : 'Discount'}
          detail={quote.couponCode ? `Code ${quote.couponCode}` : undefined}
          value={`−${formatCurrency(quote.discount)}`}
        />
      )}
      <div className="border-t border-border/30 pt-2">
        <BreakdownRow label={totalLabel} value={formatCurrency(quote.total)} emphasis />
      </div>
      {showMinimumWarning && !quote.meetsMinimum && (
        <p className="text-xs text-amber-800">
          Below minimum order of {formatCurrency(quote.minimumOrderAmount)}. Choose a larger bag
          or add add-ons to continue.
        </p>
      )}
    </dl>
  );
}
