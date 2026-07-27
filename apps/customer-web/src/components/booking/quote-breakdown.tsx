import type { MultiServiceQuoteBreakdown, QuoteBreakdown } from '@lunara/utils';
import { BranchPricingMode, formatCurrency } from '@lunara/utils';

function serviceLabelAndDetail(quote: QuoteBreakdown) {
  const serviceLabel =
    quote.pricingMode === BranchPricingMode.FLAT_BAG
      ? `${quote.serviceLabel} — ${quote.bagLabel} bag`
      : quote.serviceLabel;
  const serviceDetail = quote.garmentSelections?.length
    ? `${quote.garmentSelections.reduce((sum, g) => sum + g.quantity, 0)} garment${quote.garmentSelections.length === 1 && quote.garmentSelections[0].quantity === 1 ? '' : 's'}`
    : quote.pricingMode === BranchPricingMode.FLAT_BAG
      ? `Up to ${quote.weightKg} kg`
      : quote.pricingMode === BranchPricingMode.FIXED
        ? 'Fixed price'
        : quote.pricingMode === BranchPricingMode.PER_PIECE
          ? `${quote.pieceCount ?? 0} pieces (estimated)`
          : quote.pricingMode === BranchPricingMode.PER_PAIR
            ? `${quote.pieceCount ?? 0} pairs (estimated)`
            : quote.pricingMode === BranchPricingMode.PER_ITEM
              ? `${quote.pieceCount ?? 0} items (estimated)`
              : `${quote.weightKg} kg (estimated)`;
  return { serviceLabel, serviceDetail };
}

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
  quote: MultiServiceQuoteBreakdown;
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
      {quote.services.map((serviceQuote, idx) => {
        const { serviceLabel, serviceDetail } = serviceLabelAndDetail(serviceQuote);
        return (
          <BreakdownRow
            key={idx}
            label={serviceLabel}
            detail={serviceDetail}
            value={formatCurrency(serviceQuote.serviceSubtotal)}
          />
        );
      })}
      {quote.addons.map((addon) => {
        const detail = addon.percent
          ? `+${addon.percent}%`
          : addon.unit === BranchPricingMode.PER_KG
            ? `${addon.quantity ?? 0} kg`
            : addon.unit === BranchPricingMode.PER_LOAD
              ? `×${addon.quantity ?? 0} load${addon.quantity === 1 ? '' : 's'}`
              : addon.unit === BranchPricingMode.PER_PIECE
                ? `×${addon.quantity ?? 0} piece${addon.quantity === 1 ? '' : 's'}`
                : addon.unit === BranchPricingMode.PER_PAIR
                  ? `×${addon.quantity ?? 0} pair${addon.quantity === 1 ? '' : 's'}`
                  : addon.unit === BranchPricingMode.PER_ITEM
                    ? `×${addon.quantity ?? 0} item${addon.quantity === 1 ? '' : 's'}`
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
