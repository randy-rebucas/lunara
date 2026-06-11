import { MarketingShell } from './marketing-shell';

export function MarketingContentPage({
  title,
  description,
  children,
  wide,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <MarketingShell>
      <section className="marketing-container py-12 sm:py-16">
        <div className={wide ? 'mx-auto max-w-5xl' : 'mx-auto max-w-3xl'}>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 text-lg leading-relaxed text-muted">{description}</p>
          ) : null}
          <div className="mt-10">{children}</div>
        </div>
      </section>
    </MarketingShell>
  );
}
