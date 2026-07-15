import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, MapPin, Sparkles } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { resolveMediaUrl } from '@lunara/utils';
import { MarketingShell } from '../../../components/marketing/marketing-shell';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingHeroGlow,
  MarketingSectionIcon,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import {
  EXPANDING_AREAS,
  fetchActiveServiceAreas,
} from '../../../components/marketing/home-page-data';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../components/ui/button-link';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Laundry service areas in Metro Manila',
  description: `See where ${appConfig.name} offers laundry pickup and delivery in Metro Manila — live branches, coverage radius, and expanding areas.`,
  path: '/locations',
});

export default async function LocationsPage() {
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const serviceAreas = await fetchActiveServiceAreas(apiBase);

  const cityCount = new Set(serviceAreas.map((b) => b.city)).size;
  const avgRadius =
    serviceAreas.length > 0
      ? Math.round(serviceAreas.reduce((sum, b) => sum + b.radiusKm, 0) / serviceAreas.length)
      : 0;

  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40 bg-surface/60">
        <MarketingHeroGlow />
        <div className="marketing-container relative py-12 text-center sm:py-16">
          <span className="badge-primary">Metro Manila</span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Service locations
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Lunara partner branches and pickup zones across Metro Manila. Enter your address when
            booking to confirm coverage.
          </p>

          <MarketingStatRow
            className="mx-auto mt-8 max-w-md"
            align="center"
            stats={[
              { icon: Building2, label: `${serviceAreas.length} active ${serviceAreas.length === 1 ? 'branch' : 'branches'}` },
              { icon: MapPin, label: `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} covered` },
              { icon: Sparkles, label: `~${avgRadius} km avg. radius` },
            ]}
          />
        </div>
      </section>

      {/* ── Body ── */}
      <section className="marketing-container py-12 sm:py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {serviceAreas.map((branch) => {
            const logoUrl = resolveMediaUrl(branch.logoUrl, process.env.NEXT_PUBLIC_API_URL);
            return (
              <Link
                key={branch.id}
                href={`/service-areas/${branch.id}`}
                className="card flex h-full flex-col transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="card-body flex flex-1 flex-col">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt={`${branch.name} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="badge-primary w-fit">{branch.province}</span>
                      <h3 className="mt-1 truncate text-lg font-semibold text-slate-900">{branch.name}</h3>
                    </div>
                  </div>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{branch.area}</p>

                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    ~{branch.radiusKm} km service radius
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="card mt-10">
          <div className="card-body text-center sm:text-left">
            <div className="flex justify-center sm:justify-start">
              <MarketingSectionIcon icon={Sparkles} title="Expanding soon" />
            </div>
            <p className="mt-3 text-sm text-muted">
              We are growing across the Philippines. These areas are on our roadmap — join the
              waitlist by booking with your address or contacting support.
            </p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {EXPANDING_AREAS.map((city) => (
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

        <MarketingCtaPanel
          className="mt-10"
          title="Check coverage at your address"
          description="Availability depends on your pin location and nearest active branch. Sign up and add your address to see if pickup and delivery are available today."
          align="center"
        >
          <MarketingActions align="center" gap="loose">
            <ButtonLink href="/signup" size="lg" layout="responsive">
              Check my address
            </ButtonLink>
            <ButtonLink href="/signup" variant="outline" size="lg" layout="responsive">
              Book laundry
            </ButtonLink>
          </MarketingActions>
        </MarketingCtaPanel>

        <MarketingBackLink
          extra={
            <>
              {' · '}
              <Link href="/partners" className="link-primary">
                Partner with us
              </Link>
            </>
          }
        />
      </section>
    </MarketingShell>
  );
}
