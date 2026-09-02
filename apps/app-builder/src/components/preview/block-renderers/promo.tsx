import type { PromoProps } from '@lunara/blocks';

export function PromoPreview({ title, description, code }: PromoProps) {
  return (
    <div className="rounded-lg border border-dashed border-primary/50 p-2">
      <p className="text-[9px] font-bold text-primary">{title}</p>
      {description ? <p className="mt-0.5 text-[8px] text-slate-900">{description}</p> : null}
      {code ? (
        <span className="mt-1 inline-block rounded bg-primary px-1.5 py-0.5 text-[7px] font-bold tracking-wide text-white">
          {code}
        </span>
      ) : null}
    </div>
  );
}
