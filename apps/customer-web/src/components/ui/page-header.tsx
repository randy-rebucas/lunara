import Link from 'next/link';

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link href={backHref} className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary">
          ← {backLabel}
        </Link>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
    </header>
  );
}
