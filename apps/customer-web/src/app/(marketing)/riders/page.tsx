import type { Metadata } from 'next';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingInfoCard,
} from '../../../components/marketing/marketing-design';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonAnchor, ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `Drive with ${appConfig.name}`,
  description: `Join ${appConfig.name} as a pickup and delivery rider. Flexible shifts, clear tasks, and earnings tracking in the Lunara Rider app.`,
};

const PERKS = [
  {
    title: 'Clear daily tasks',
    description:
      'Accept pickup and delivery assignments from dispatch with customer addresses, order details, and step-by-step handoff flows.',
  },
  {
    title: 'Earnings & wallet',
    description:
      'Track daily and weekly earnings in the rider app. Manage your wallet balance and request payouts to GCash or bank.',
  },
  {
    title: 'Proof at every stop',
    description:
      'Built-in pickup and delivery confirmation, photo proof, signatures, and QR scanning for fast, accountable handoffs.',
  },
  {
    title: 'Operations support',
    description:
      'Work with Lunara dispatch for routing help, schedule changes, and support when something unexpected comes up.',
  },
] as const;

const STEPS = [
  'Apply with your contact details and vehicle type (motorcycle, car, or bicycle where applicable).',
  'Complete onboarding and document verification with our operations team.',
  'Download the Lunara Rider app, sign in, and go online when you are ready to work.',
  'Accept tasks, complete pickups and deliveries, and track earnings from the app.',
] as const;

export default function RidersPage() {
  return (
    <MarketingContentPage
      badge="For riders"
      title="Drive with Lunara"
      description="Earn on your schedule as a pickup and delivery rider on the Lunara network."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {PERKS.map((item) => (
          <MarketingFeatureCard key={item.title} title={item.title} description={item.description} />
        ))}
      </div>

      <MarketingInfoCard title="How onboarding works" className="mt-10">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </MarketingInfoCard>

      <MarketingCtaPanel
        className="mt-10"
        badge="Join the fleet"
        badgeVariant="secondary"
        variant="secondary"
        title="Join the rider fleet"
        description="Rider accounts are created by Lunara operations after review. Email us with your name, phone number, city, and vehicle type to start your application."
        footer="Existing riders: use the Lunara Rider mobile app to sign in and manage your shift."
      >
        <MarketingActions gap="loose">
          <ButtonAnchor
            href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara rider application')}`}
            size="lg"
            layout="responsive"
          >
            Apply to drive
          </ButtonAnchor>
          <ButtonLink href="/faq" variant="outline" size="lg" layout="responsive">
            Read FAQ
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink />
    </MarketingContentPage>
  );
}
