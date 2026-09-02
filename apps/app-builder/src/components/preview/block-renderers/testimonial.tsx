import type { TestimonialProps } from '@lunara/blocks';

export function TestimonialPreview({ quote, authorName, authorRole }: TestimonialProps) {
  return (
    <div className="rounded-lg bg-muted/20 p-2">
      <p className="text-[9px] italic text-slate-900">&ldquo;{quote}&rdquo;</p>
      <p className="mt-1 text-[8px] font-semibold text-primary">
        {authorName}
        {authorRole ? <span className="font-normal text-muted"> · {authorRole}</span> : null}
      </p>
    </div>
  );
}
