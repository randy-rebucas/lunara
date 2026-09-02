import type { OrderCardListProps } from '@lunara/blocks';

export function OrderCardListPreview({ title, emptyStateText, orders, ctaLabel }: OrderCardListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      {orders.length === 0 ? (
        <p className="text-[8px] text-muted">{emptyStateText ?? 'No orders'}</p>
      ) : (
        <div className="space-y-1.5">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-bold text-slate-900">{order.orderNumber}</p>
                <p className="text-[7px] font-semibold uppercase text-primary">{order.status}</p>
              </div>
              {order.itemsSummary ? <p className="text-[8px] text-muted">{order.itemsSummary}</p> : null}
              {order.showStepper ? <div className="mt-1 h-1 w-full rounded-full bg-border"><div className="h-1 w-3/5 rounded-full bg-primary" /></div> : null}
            </div>
          ))}
        </div>
      )}
      {ctaLabel ? <p className="mt-1 text-center text-[8px] font-semibold text-primary">{ctaLabel}</p> : null}
    </div>
  );
}
