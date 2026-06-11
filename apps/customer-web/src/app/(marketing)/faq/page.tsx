import type { Metadata } from 'next';
import { appConfig } from '@lunara/config';
import { FaqList } from '../../../components/marketing/faq-list';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import { MarketingBackLink, MarketingCtaPanel } from '../../../components/marketing/marketing-design';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonAnchor, ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `FAQ — ${appConfig.name}`,
  description: `Common questions about booking laundry pickup and delivery with ${appConfig.name}.`,
};

export default function FaqPage() {
  return (
    <MarketingContentPage
      badge="Help center"
      title="Frequently asked questions"
      description="Quick answers about booking, payments, tracking, and support. Jump to a topic below or browse all questions."
    >
      <FaqList />

      <MarketingCtaPanel
        className="mt-14"
        badge="Need a hand?"
        title="Still need help?"
        description={
          <>
            Email us at{' '}
            <a href={`mailto:${appConfig.supportEmail}`} className="link-primary">
              {appConfig.supportEmail}
            </a>{' '}
            or sign in to open a support ticket from your dashboard.
          </>
        }
        align="center"
      >
        <MarketingActions align="center" gap="loose">
          <ButtonAnchor
            href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara support request')}`}
            size="lg"
            layout="responsive"
          >
            Email support
          </ButtonAnchor>
          <ButtonLink href="/login" variant="outline" size="lg" layout="responsive">
            Sign in
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink />
    </MarketingContentPage>
  );
}
