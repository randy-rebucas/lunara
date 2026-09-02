import type { ReceiptCardProps } from '@lunara/blocks';

export function ReceiptCardPreview({ orderNumber, amount, timestamp, methodLabel, shareLabel }: ReceiptCardProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-surface p-2 ring-1 ring-border/60">
      <p className="text-[12px] font-bold text-primary">✓</p>
      <p className="text-[11px] font-bold text-slate-900">{amount}</p>
      <p className="text-[7px] text-muted">{orderNumber}</p>
      <p className="text-[7px] text-muted">{timestamp}</p>
      {methodLabel ? <p className="text-[7px] text-muted">Paid via {methodLabel}</p> : null}
      {shareLabel ? <p className="mt-0.5 text-[7px] font-semibold text-primary">{shareLabel}</p> : null}
    </div>
  );
}
