import type { TransactionListProps } from '@lunara/blocks';

export function TransactionListPreview({ title, transactions }: TransactionListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="divide-y divide-border/60 rounded-lg bg-surface ring-1 ring-border/60">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-1.5 py-1">
            <p className="truncate text-[8px] font-medium text-slate-800">{tx.label}</p>
            <p className={`text-[8px] font-bold ${tx.direction === 'credit' ? 'text-primary' : 'text-red-500'}`}>
              {tx.direction === 'credit' ? '+' : '-'}
              {tx.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
