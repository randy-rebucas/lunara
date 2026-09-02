import type { HeroProps } from '@lunara/blocks';

export function HeroPreview({ headline, subheadline, ctaLabel }: HeroProps) {
  return (
    <div className="rounded-xl bg-primary p-3">
      <p className="text-[11px] font-bold leading-tight text-white">{headline}</p>
      {subheadline ? <p className="mt-1 text-[9px] text-white/85">{subheadline}</p> : null}
      {ctaLabel ? (
        <div className="mt-2 inline-block rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-primary">
          {ctaLabel}
        </div>
      ) : null}
    </div>
  );
}
