import type { BalanceCardProps } from '@lunara/blocks';

export function BalanceCardPreview({ label, amount, currency = '₱', subLabel, ctaLabel }: BalanceCardProps) {
  return (
    <div className="rounded-xl bg-primary p-3">
      <p className="text-[8px] text-white/85">{label}</p>
      <p className="text-[16px] font-bold text-white">
        {currency}
        {amount}
      </p>
      {subLabel ? <p className="text-[8px] text-white/80">{subLabel}</p> : null}
      {ctaLabel ? (
        <div className="mt-2 inline-block rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-primary">
          {ctaLabel}
        </div>
      ) : null}
    </div>
  );
}
