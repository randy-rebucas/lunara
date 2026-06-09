import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { BrandMark } from '@lunara/ui';

export function PublicShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="laundry-bg min-h-screen">
      <header className="page-container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark variant="customer" compact size="sm" />
          <span className="font-bold tracking-tight text-primary">{appConfig.name}</span>
        </Link>
        <Link href="/login" className="link-primary text-sm">
          Sign in
        </Link>
      </header>

      <main className="page-container pb-16 pt-2">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          ) : null}
          <article className="card mt-8">
            <div className="card-body legal-prose">{children}</div>
          </article>
        </div>
      </main>
    </div>
  );
}
