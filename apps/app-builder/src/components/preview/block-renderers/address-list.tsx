import type { AddressListProps } from '@lunara/blocks';

export function AddressListPreview({ title, addresses, allowAdd, addLabel }: AddressListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="space-y-1">
        {addresses.map((address) => (
          <div key={address.id} className="rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-bold text-slate-900">{address.label}</p>
              {address.isDefault ? <span className="text-[7px] font-semibold text-primary">Default</span> : null}
            </div>
            <p className="truncate text-[8px] text-muted">{address.line1}</p>
          </div>
        ))}
      </div>
      {allowAdd ? (
        <div className="mt-1 rounded-lg border border-dashed border-primary/60 p-1.5 text-center text-[8px] font-semibold text-primary">
          {addLabel ?? 'Add address'}
        </div>
      ) : null}
    </div>
  );
}
