import Link from 'next/link';

export function SectionHeading({
  title,
  href,
  linkLabel = 'View all →',
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {href ? (
        <Link href={href} className="link-primary shrink-0 text-sm">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
