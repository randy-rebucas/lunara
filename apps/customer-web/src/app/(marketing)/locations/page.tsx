import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import { ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `Service areas — ${appConfig.name}`,
  description: `See where ${appConfig.name} offers laundry pickup and delivery in Metro Manila.`,
};

/** Public-facing service areas aligned with operational branch seeds. */
const SERVICE_AREAS = [
  {
    name: 'Lunara Makati',
    city: 'Makati',
    province: 'Metro Manila',
    area: 'Makati CBD, Legazpi, Salcedo, and nearby barangays',
    radiusKm: 12,
  },
  {
    name: 'Lunara Quezon City',
    city: 'Quezon City',
    province: 'Metro Manila',
    area: 'Timog, Kamuning, South Triangle, and surrounding areas',
    radiusKm: 14,
  },
  {
    name: 'Lunara BGC',
    city: 'Taguig',
    province: 'Metro Manila',
    area: 'Bonifacio Global City, McKinley Hill, and nearby communities',
    radiusKm: 10,
  },
] as const;

const EXPANDING = [
  'Pasig & Ortigas',
  'Manila & Ermita',
  'Parañaque & Las Piñas',
  'Cebu Metro',
] as const;

export default function LocationsPage() {
  return (
    <MarketingContentPage
      title="Service locations"
      description="Lunara partner branches and pickup zones across Metro Manila. Enter your address when booking to confirm coverage."
      wide
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SERVICE_AREAS.map((branch) => (
          <article key={branch.name} className="card flex h-full flex-col">
            <div className="card-body flex flex-1 flex-col">
              <span className="badge-primary w-fit">{branch.province}</span>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{branch.name}</h2>
              <p className="mt-1 text-sm font-medium text-primary">
                {branch.city}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{branch.area}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Approx. {branch.radiusKm} km service radius from branch
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="card mt-10">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">Expanding soon</h2>
          <p className="mt-2 text-sm text-muted">
            We are growing across the Philippines. These areas are on our roadmap — join the waitlist
            by booking with your address or contacting support.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {EXPANDING.map((city) => (
              <li
                key={city}
                className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-slate-700 ring-1 ring-border/60"
              >
                {city}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-elevated mt-10">
        <div className="card-body text-center sm:py-8">
          <h2 className="text-lg font-semibold text-slate-900">Check coverage at your address</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Availability depends on your pin location and nearest active branch. Sign up and add your
            address to see if pickup and delivery are available today.
          </p>
          <div className="btn-row mt-6 justify-center">
            <ButtonLink href="/signup" size="lg">
              Check my address
            </ButtonLink>
            <ButtonLink href="/book" variant="outline" size="lg">
              Book laundry
            </ButtonLink>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/marketing" className="link-primary">
          ← Back to home
        </Link>
        {' · '}
        <Link href="/partners" className="link-primary">
          Partner with us
        </Link>
      </p>
    </MarketingContentPage>
  );
}
