import type { Metadata } from 'next';
import { appConfig } from '@lunara/config';
import { MarketingShell } from '../../../components/marketing/marketing-shell';
import { ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `${appConfig.name} — Laundry pickup & delivery`,
  description:
    'Book door-to-door laundry in minutes. Track pickup, washing, and delivery live. Pay with GCash, card, wallet, or cash.',
};

const FEATURES = [
  {
    title: 'Book in minutes',
    description:
      'Choose wash, dry clean, or express service. Pick a time slot and confirm — no shop-hopping required.',
    badge: 'badge-primary',
    label: 'Booking',
  },
  {
    title: 'Door-to-door service',
    description:
      'Riders pick up and deliver at your home or office. Pin your address for accurate routing.',
    badge: 'badge-secondary',
    label: 'Pickup & delivery',
  },
  {
    title: 'Live order tracking',
    description:
      'Follow every step from dispatch to shop processing, out for delivery, and delivered.',
    badge: 'badge-accent',
    label: 'Tracking',
  },
  {
    title: 'Flexible payments',
    description: 'Pay with GCash, card, Lunara wallet, or cash on pickup or delivery.',
    badge: 'badge-primary',
    label: 'Payments',
  },
  {
    title: 'Wallet & history',
    description: 'Top up your wallet, view past orders, and manage refunds or support in one place.',
    badge: 'badge-secondary',
    label: 'Account',
  },
  {
    title: 'Real-time alerts',
    description: 'Get notified when your rider is on the way or your order status changes.',
    badge: 'badge-accent',
    label: 'Notifications',
  },
] as const;

const STEPS = [
  {
    step: '1',
    title: 'Sign up with your phone',
    description: 'Create an account in seconds with OTP verification. Add your name and delivery address.',
  },
  {
    step: '2',
    title: 'Book your laundry',
    description: 'Select a service, schedule pickup, and confirm your order with a clear price breakdown.',
  },
  {
    step: '3',
    title: 'We handle the rest',
    description: 'A rider collects your laundry. Partner shops process it while you track progress live.',
  },
  {
    step: '4',
    title: 'Delivered back to you',
    description: 'Get fresh laundry returned to your door. Pay your way and rate your experience.',
  },
] as const;

const PAYMENTS = ['GCash', 'Credit / debit card', 'Lunara wallet', 'Cash on pickup or delivery'] as const;

export default function MarketingPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="marketing-container pb-16 pt-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge-primary">Philippines · Door-to-door laundry</span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Laundry made{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              simple
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted sm:text-xl">
            {appConfig.name} connects you with trusted laundry partners and riders — book pickup,
            track every step, and pay securely from your phone or browser.
          </p>
          <div className="btn-row mt-10 justify-center">
            <ButtonLink href="/signup" size="lg" className="w-full sm:min-w-[200px]">
              Get started free
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg" className="w-full sm:min-w-[200px]">
              Sign in
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required to sign up · Works on web and mobile
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { value: '3 min', label: 'Average booking time' },
            { value: 'Live', label: 'Order status updates' },
            { value: '4+', label: 'Ways to pay' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <div className="card-body py-5">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/40 bg-surface/60 py-16 sm:py-20">
        <div className="marketing-container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything you need</h2>
            <p className="mt-3 text-muted">
              From booking to delivery, {appConfig.name} keeps laundry off your to-do list.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card h-full transition-shadow hover:shadow-[var(--shadow-elevated)]">
                <div className="card-body">
                  <span className={feature.badge}>{feature.label}</span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="marketing-container py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
          <p className="mt-3 text-muted">Four steps from dirty laundry to fresh and delivered.</p>
        </div>
        <ol className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          {STEPS.map((item) => (
            <li key={item.step} className="card">
              <div className="card-body flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
                  aria-hidden
                >
                  {item.step}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Payments */}
      <section id="payments" className="border-t border-border/40 bg-surface/60 py-16 sm:py-20">
        <div className="marketing-container">
          <div className="card-elevated mx-auto max-w-3xl">
            <div className="card-body text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Pay your way
              </h2>
              <p className="mt-3 text-muted">
                Choose the payment method that works for you — online or in person.
              </p>
              <ul className="mt-8 flex flex-wrap justify-center gap-3">
                {PAYMENTS.map((method) => (
                  <li
                    key={method}
                    className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-border/60"
                  >
                    {method}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="marketing-container py-16 sm:py-24">
        <div className="card-elevated overflow-hidden">
          <div className="card-body bg-gradient-to-br from-primary/5 via-surface to-secondary/5 text-center sm:py-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Ready to skip the laundromat?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted">
              Join {appConfig.name} today. Sign up with your mobile number and book your first pickup
              in minutes.
            </p>
            <div className="btn-row mt-8 justify-center">
              <ButtonLink href="/signup" size="lg" className="w-full sm:min-w-[200px]">
                Create free account
              </ButtonLink>
              <ButtonLink href="/book" variant="outline" size="lg" className="w-full sm:min-w-[200px]">
                Book laundry
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
