import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { FaqList } from '../../../components/marketing/faq-list';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import { ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `FAQ — ${appConfig.name}`,
  description: `Common questions about booking laundry pickup and delivery with ${appConfig.name}.`,
};

export default function FaqPage() {
  return (
    <MarketingContentPage
      title="Frequently asked questions"
      description="Quick answers about booking, payments, tracking, and support."
    >
      <FaqList />

      <div className="card-elevated mt-12">
        <div className="card-body text-center sm:py-8">
          <h2 className="text-lg font-semibold text-slate-900">Still need help?</h2>
          <p className="mt-2 text-sm text-muted">
            Reach our support team at{' '}
            <a href={`mailto:${appConfig.supportEmail}`} className="link-primary">
              {appConfig.supportEmail}
            </a>
            , or sign in to open a support ticket from your dashboard.
          </p>
          <div className="btn-row mt-6 justify-center">
            <ButtonLink href="/signup" size="sm">
              Get started
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="sm">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/marketing" className="link-primary">
          ← Back to home
        </Link>
      </p>
    </MarketingContentPage>
  );
}
