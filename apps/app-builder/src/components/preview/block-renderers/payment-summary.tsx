import type { PaymentSummaryProps } from '@lunara/blocks';

export function PaymentSummaryPreview({ lineItems, total, status, methodLabel, ctaLabel }: PaymentSummaryProps) {
  return (
    <div className="rounded-xl bg-surface p-2 ring-1 ring-border/60">
      {lineItems.map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex justify-between text-[8px] text-muted">
          <span>{item.label}</span>
          <span>{item.amount}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-border/60 pt-1 text-[9px] font-bold text-slate-900">
        <span>Total</span>
        <span>{total}</span>
      </div>
      {methodLabel ? <p className="text-[7px] text-muted">Via {methodLabel}</p> : null}
      {status ? <p className="text-[7px] font-semibold uppercase text-primary">{status}</p> : null}
      {ctaLabel ? (
        <div className="mt-1.5 rounded-md bg-primary py-1 text-center text-[8px] font-semibold text-white">
          {ctaLabel}
        </div>
      ) : null}
    </div>
  );
}
