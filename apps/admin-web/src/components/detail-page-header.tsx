import Link from 'next/link';

export function DetailPageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
}: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary"
      >
        ← {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="dc-eyebrow">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
