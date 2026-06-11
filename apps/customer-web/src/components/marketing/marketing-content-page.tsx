import { MarketingContentBody, MarketingPageHero } from './marketing-design';
import { MarketingShell } from './marketing-shell';

export function MarketingContentPage({
  title,
  description,
  badge,
  children,
  wide,
  narrow,
  heroActions,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: React.ReactNode;
  wide?: boolean;
  narrow?: boolean;
  heroActions?: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <MarketingPageHero
        badge={badge}
        title={title}
        description={description}
        wide={wide}
        narrow={narrow}
        glow
      >
        {heroActions}
      </MarketingPageHero>
      <section className="marketing-container pb-16 pt-0 sm:pb-20">
        <MarketingContentBody wide={wide} narrow={narrow}>
          {children}
        </MarketingContentBody>
      </section>
    </MarketingShell>
  );
}
