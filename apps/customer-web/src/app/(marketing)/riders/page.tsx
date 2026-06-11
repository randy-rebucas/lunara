import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import { ButtonLink } from '../../../components/ui/button-link';

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
      title="Drive with Lunara"
      description="Earn on your schedule as a pickup and delivery rider on the Lunara network."
      wide
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {PERKS.map((item) => (
          <article key={item.title} className="card h-full">
            <div className="card-body">
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="card mt-10">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">How onboarding works</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card-elevated mt-10">
        <div className="card-body bg-gradient-to-br from-secondary/5 to-accent/5 sm:py-8">
          <h2 className="text-xl font-semibold text-slate-900">Join the rider fleet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Rider accounts are created by Lunara operations after review. Email us with your name,
            phone number, city, and vehicle type to start your application.
          </p>
          <div className="btn-row mt-6">
            <ButtonLink
              href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara rider application')}`}
              size="lg"
            >
              Apply to drive
            </ButtonLink>
            <ButtonLink href="/faq" variant="outline" size="lg">
              Read FAQ
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Existing riders: use the Lunara Rider mobile app to sign in and manage your shift.
          </p>
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
