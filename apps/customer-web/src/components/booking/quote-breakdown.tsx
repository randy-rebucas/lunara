import type { QuoteBreakdown } from '@lunara/utils';
import { BranchPricingMode, formatCurrency } from '@lunara/utils';

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
  const serviceLabel =
    quote.pricingMode === BranchPricingMode.FLAT_BAG
      ? `${quote.serviceLabel} — ${quote.bagLabel} bag`
      : quote.serviceLabel;
  const serviceDetail =
    quote.pricingMode === BranchPricingMode.FLAT_BAG
      ? `Up to ${quote.weightKg} kg`
      : quote.pricingMode === BranchPricingMode.PER_PIECE
        ? `${quote.pieceCount ?? 0} pieces (estimated)`
        : `${quote.weightKg} kg (estimated)`;
  return (
    <dl className="space-y-2">
      <BreakdownRow
        label={serviceLabel}
        detail={serviceDetail}
        value={formatCurrency(quote.serviceSubtotal)}
      />
      {quote.addons.map((addon) => {
        const detail =
          addon.unit === BranchPricingMode.PER_KG
            ? `${addon.quantity ?? 0} kg`
            : addon.unit === BranchPricingMode.PER_LOAD
              ? `×${addon.quantity ?? 0} load${addon.quantity === 1 ? '' : 's'}`
              : addon.unit === BranchPricingMode.PER_PIECE
                ? `×${addon.quantity ?? 0} piece${addon.quantity === 1 ? '' : 's'}`
                : undefined;
        return (
          <BreakdownRow
            key={addon.id}
            label={addon.label}
            detail={detail}
            value={formatCurrency(addon.price)}
          />
        );
      })}
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
