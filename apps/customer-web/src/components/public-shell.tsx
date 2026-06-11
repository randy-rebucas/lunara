import { MarketingContentBody, MarketingPageHero } from './marketing/marketing-design';
import { MarketingShell } from './marketing/marketing-shell';

export function PublicShell({
  children,
  title,
  description,
  badge,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <MarketingShell>
      <MarketingPageHero badge={badge} title={title} description={description} narrow glow />
      <section className="marketing-container pb-16 sm:pb-20">
        <MarketingContentBody narrow>
          <article className="card-elevated">
            <div className="card-body legal-prose">{children}</div>
          </article>
        </MarketingContentBody>
      </section>
    </MarketingShell>
  );
}
